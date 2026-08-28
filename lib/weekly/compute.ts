import { and, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  categoryScores,
  coachSignals,
  dailyActions,
  dailyReviews,
  goalRecurrence,
  goals,
  lifeCategories,
  trajectoryCheckpoints,
  trajectoryMetrics,
  weeklyReviews,
} from "@/db/schema";
import { computeAdherence } from "@/lib/behavior/adherence";
import { classifyMaturity, daysBetween } from "@/lib/scoring/evidence";
import type { ScoreConfidence } from "@/lib/scoring/compute";
import { computeTrajectoryState } from "@/lib/scoring/trajectory";
import { describeSignal } from "@/lib/scoring/labels";
import { computeMetricTrajectory, type MetricDirection, type PaceStatus } from "@/lib/trajectory/compute";
import { toDateKey } from "@/lib/today/date";
import { endOfDay, endOfWeek, isoWeek } from "./date";
import { buildWeeklyInsights } from "./insights";
import { computeWeeklyPriorities } from "./priorities";
import type { SignalSummary, WeeklyReviewSnapshot } from "./types";

const DEADLINE_WINDOW_DAYS = 14;
// Mirrors lib/signals/detect.ts's ADHERENCE_TREND_THRESHOLD, intentionally duplicated
// rather than imported — M5 stays fully isolated from M3's verified detector logic.
const RECURRENCE_TREND_THRESHOLD = 20;
const CONSIDERED_PERIODS = 5;

function evidenceField<T>(evidence: unknown, key: string): T {
  return (evidence as Record<string, unknown>)[key] as T;
}

type SignalRow = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  importance: number;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  goalId: string | null;
  evidence: unknown;
  detectedAt: Date;
  resolvedAt: Date | null;
  status: string;
};

function toSignalSummary(s: SignalRow): SignalSummary {
  return {
    id: s.id,
    type: s.type,
    severity: s.severity,
    importance: s.importance,
    categoryName: s.categoryName,
    categorySlug: s.categorySlug,
    description: describeSignal(s),
    detectedAt: s.detectedAt.toISOString(),
    resolvedAt: s.resolvedAt ? s.resolvedAt.toISOString() : null,
  };
}

/**
 * Computes a full Weekly Review, historically faithful to the reviewed
 * week: every "as of" comparison below uses `asOf` (the end of the
 * reviewed week), not real time, so regenerating an old week's review
 * months later still describes that week, not today. The one exception
 * is `computeWeeklyPriorities`, deliberately forward-looking — see its
 * own doc comment in lib/weekly/priorities.ts.
 */
export async function computeWeeklyReview(
  weekStart: Date,
  now: Date = new Date(),
): Promise<WeeklyReviewSnapshot> {
  const weekEnd = endOfWeek(weekStart);
  const weekStartKey = toDateKey(weekStart);
  const weekEndKey = toDateKey(weekEnd);
  const asOf = endOfDay(weekEndKey);
  const { week: isoWeekNum, year: isoYear } = isoWeek(weekStart);

  const pillars = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.isActive, true))
    .orderBy(lifeCategories.sortOrder);

  // ---------------------------------------------------------------
  // Signals — the full set, plus an "active as of weekEnd" derivation
  // (detectedAt <= asOf and not yet resolved by asOf). This is the one
  // approximation the historical view relies on: status transitions
  // like acknowledged/suppressed aren't themselves timestamped, only
  // detectedAt/resolvedAt are, so "active as of a past date" is judged
  // purely on the detection/resolution window.
  // ---------------------------------------------------------------
  const allSignalsRaw: SignalRow[] = await db
    .select({
      id: coachSignals.id,
      type: coachSignals.type,
      severity: coachSignals.severity,
      importance: coachSignals.importance,
      categoryId: coachSignals.categoryId,
      categoryName: lifeCategories.name,
      categorySlug: lifeCategories.slug,
      goalId: coachSignals.goalId,
      evidence: coachSignals.evidence,
      detectedAt: coachSignals.detectedAt,
      resolvedAt: coachSignals.resolvedAt,
      status: coachSignals.status,
    })
    .from(coachSignals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, coachSignals.categoryId));

  const activeAsOfWeekEnd = allSignalsRaw.filter(
    (s) => s.detectedAt <= asOf && (!s.resolvedAt || s.resolvedAt > asOf),
  );

  // ---------------------------------------------------------------
  // Trajectory State — the same pure function the dashboard uses, fed
  // pillar confidence and active signals as they stood at week end.
  // ---------------------------------------------------------------
  const pillarConfidencesAsOfWeekEnd = await Promise.all(
    pillars.map(async (p) => {
      const [latest] = await db
        .select()
        .from(categoryScores)
        .where(and(eq(categoryScores.categoryId, p.id), lte(categoryScores.computedAt, asOf)))
        .orderBy(desc(categoryScores.computedAt))
        .limit(1);
      return { categoryId: p.id, score: latest?.score ?? null, confidence: (latest?.confidence ?? "insufficient") as ScoreConfidence };
    }),
  );

  const trajectory = computeTrajectoryState({
    pillarConfidences: pillarConfidencesAsOfWeekEnd.map((s) => s.confidence),
    activeSignals: activeAsOfWeekEnd,
  });

  // ---------------------------------------------------------------
  // Prime Actions
  // ---------------------------------------------------------------
  const weekActions = await db
    .select({
      id: dailyActions.id,
      title: dailyActions.title,
      status: dailyActions.status,
      priority: dailyActions.priority,
      date: dailyActions.date,
      categoryId: dailyActions.categoryId,
      categoryName: lifeCategories.name,
    })
    .from(dailyActions)
    .innerJoin(lifeCategories, eq(lifeCategories.id, dailyActions.categoryId))
    .where(and(gte(dailyActions.date, weekStartKey), lte(dailyActions.date, weekEndKey)));

  const doneCount = weekActions.filter((a) => a.status === "done").length;
  const unfinished = weekActions
    .filter((a) => a.status === "pending")
    .sort((a, b) => b.priority - a.priority || a.date.localeCompare(b.date))
    .slice(0, 5)
    .map((a) => ({ id: a.id, title: a.title, categoryName: a.categoryName, priority: a.priority, date: a.date }));

  const primeActions: WeeklyReviewSnapshot["primeActions"] = {
    total: weekActions.length,
    done: doneCount,
    completionRate: weekActions.length > 0 ? Math.round((doneCount / weekActions.length) * 1000) / 10 : null,
    unfinished,
  };

  // ---------------------------------------------------------------
  // Recurring Behaviours — adherence pinned to the reviewed week's end,
  // so "current period" means that week, not whatever "now" is.
  // ---------------------------------------------------------------
  const behaviorGoals = await db
    .select({
      id: goals.id,
      title: goals.title,
      categoryId: goals.categoryId,
      categoryName: lifeCategories.name,
      createdAt: goals.createdAt,
    })
    .from(goals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
    .where(and(eq(goals.tier, "weekly"), eq(goals.kind, "behavior"), eq(goals.status, "active")));

  const recurringBehaviours: WeeklyReviewSnapshot["recurringBehaviours"] = [];
  for (const goal of behaviorGoals) {
    const [recurrence] = await db.select().from(goalRecurrence).where(eq(goalRecurrence.goalId, goal.id)).limit(1);
    if (!recurrence) continue;

    const completions = await db.select().from(behaviorCompletions).where(eq(behaviorCompletions.goalId, goal.id));
    const report = computeAdherence(recurrence, goal.createdAt, completions, asOf);
    const current = report.current;

    const considered = report.history.slice(0, CONSIDERED_PERIODS);
    const observationCount = considered.length;
    const spanDays = observationCount > 0 ? daysBetween(new Date(considered[considered.length - 1].start), asOf) : 0;
    const maturity = classifyMaturity(spanDays, observationCount);

    let trend: "improving" | "declining" | null = null;
    if (maturity !== "baseline" && report.history.length >= 3) {
      const recent = report.history[0];
      const priorWindow = report.history.slice(1, 4);
      const recentRate = (recent.count / recent.target) * 100;
      const priorAvg = priorWindow.reduce((sum, p) => sum + (p.count / p.target) * 100, 0) / priorWindow.length;
      const diff = recentRate - priorAvg;
      if (diff <= -RECURRENCE_TREND_THRESHOLD) trend = "declining";
      else if (diff >= RECURRENCE_TREND_THRESHOLD) trend = "improving";
    }

    recurringBehaviours.push({
      goalId: goal.id,
      goalTitle: goal.title,
      categoryName: goal.categoryName,
      period: recurrence.period,
      targetFrequency: recurrence.targetFrequency,
      periodCount: current.count,
      periodMet: current.met,
      trend,
      maturity,
    });
  }

  // ---------------------------------------------------------------
  // Trajectory metrics — computed once here, reused by the GOALS and
  // PILLARS sections below so a metric's trajectory is only ever
  // computed a single time per review.
  // ---------------------------------------------------------------
  const allMetrics = await db
    .select({
      id: trajectoryMetrics.id,
      name: trajectoryMetrics.name,
      unit: trajectoryMetrics.unit,
      categoryId: trajectoryMetrics.categoryId,
      categoryName: lifeCategories.name,
      direction: trajectoryMetrics.direction,
      targetValue: trajectoryMetrics.targetValue,
      targetDate: trajectoryMetrics.targetDate,
      linkedGoalId: trajectoryMetrics.linkedGoalId,
    })
    .from(trajectoryMetrics)
    .innerJoin(lifeCategories, eq(lifeCategories.id, trajectoryMetrics.categoryId))
    .where(eq(trajectoryMetrics.isActive, true));

  const linkedGoalIds = allMetrics.map((m) => m.linkedGoalId).filter((id): id is string => !!id);
  const linkedGoalTitles = new Map<string, string>();
  if (linkedGoalIds.length > 0) {
    const rows = await db.select({ id: goals.id, title: goals.title }).from(goals).where(inArray(goals.id, linkedGoalIds));
    for (const g of rows) linkedGoalTitles.set(g.id, g.title);
  }

  const metricTrajectories = await Promise.all(
    allMetrics.map(async (m) => {
      const checkpointsAll = await db.select().from(trajectoryCheckpoints).where(eq(trajectoryCheckpoints.metricId, m.id));
      // Historical honesty: only checkpoints logged by this week's end count toward a past review.
      const checkpointsAsOf = checkpointsAll.filter((c) => c.asOfDate <= weekEndKey);
      const trajectory = computeMetricTrajectory(
        { direction: m.direction as MetricDirection, targetValue: m.targetValue, targetDate: m.targetDate },
        checkpointsAsOf,
        asOf,
      );
      const touchedThisWeek = checkpointsAll.some((c) => c.asOfDate >= weekStartKey && c.asOfDate <= weekEndKey);
      return { metric: m, trajectory, touchedThisWeek };
    }),
  );

  // ---------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------
  const completedGoalsRaw = await db
    .select({ id: goals.id, title: goals.title, categoryName: lifeCategories.name, updatedAt: goals.updatedAt })
    .from(goals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
    .where(eq(goals.status, "done"));
  const completed = completedGoalsRaw
    .filter((g) => g.updatedAt >= weekStart && g.updatedAt <= asOf)
    .map((g) => ({ id: g.id, title: g.title, categoryName: g.categoryName }));

  const neglected = activeAsOfWeekEnd
    .filter((s) => s.type === "priority_neglected" && s.goalId)
    .map((s) => ({
      id: s.goalId as string,
      title: evidenceField<string>(s.evidence, "goalTitle"),
      categoryName: s.categoryName,
      daysSinceTouch: evidenceField<number>(s.evidence, "daysSinceTouch"),
    }));

  const datedGoals = await db
    .select({ id: goals.id, title: goals.title, categoryName: lifeCategories.name, targetDate: goals.targetDate })
    .from(goals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
    .where(and(eq(goals.status, "active"), isNotNull(goals.targetDate)));

  const approachingDeadline = datedGoals
    .map((g) => {
      const daysUntil = Math.round((new Date(g.targetDate as string).getTime() - weekEnd.getTime()) / 86400000);
      return { id: g.id, title: g.title, categoryName: g.categoryName, targetDate: g.targetDate as string, daysUntil };
    })
    .filter((g) => g.daysUntil <= DEADLINE_WINDOW_DAYS);

  const outcomeOnPace: WeeklyReviewSnapshot["goals"]["outcomeOnPace"] = [];
  const outcomeBehindPace: WeeklyReviewSnapshot["goals"]["outcomeBehindPace"] = [];
  for (const { metric, trajectory } of metricTrajectories) {
    if (!metric.linkedGoalId || !trajectory.pace) continue;
    const title = linkedGoalTitles.get(metric.linkedGoalId) ?? "Unknown goal";
    const entry = { goalId: metric.linkedGoalId, title, metricName: metric.name, status: trajectory.pace.status };
    if (trajectory.pace.status === "behind_pace") outcomeBehindPace.push(entry);
    else outcomeOnPace.push(entry);
  }

  // ---------------------------------------------------------------
  // Pillars
  // ---------------------------------------------------------------
  const weekCompletionRows = await db
    .select({ date: behaviorCompletions.date, categoryId: goals.categoryId })
    .from(behaviorCompletions)
    .innerJoin(goals, eq(goals.id, behaviorCompletions.goalId))
    .where(
      and(
        eq(behaviorCompletions.completed, true),
        gte(behaviorCompletions.date, weekStartKey),
        lte(behaviorCompletions.date, weekEndKey),
      ),
    );

  const pillarsOut: WeeklyReviewSnapshot["pillars"] = pillars.map((p) => {
    const days = new Set<string>();
    for (const a of weekActions) if (a.categoryId === p.id && a.status === "done") days.add(a.date);
    for (const c of weekCompletionRows) if (c.categoryId === p.id) days.add(c.date);

    const scoreEntry = pillarConfidencesAsOfWeekEnd.find((s) => s.categoryId === p.id);
    const outcomeEvidence = metricTrajectories
      .filter((mt) => mt.metric.categoryId === p.id)
      .map((mt) => ({ metricName: mt.metric.name, statusLabel: mt.trajectory.statusLabel }));

    return {
      categoryId: p.id,
      categoryName: p.name,
      categorySlug: p.slug,
      activityDays: days.size,
      meaningfulActivity: days.size > 0,
      score: scoreEntry?.score ?? null,
      confidence: scoreEntry?.confidence ?? "insufficient",
      outcomeEvidence,
    };
  });

  // ---------------------------------------------------------------
  // Signals section
  // ---------------------------------------------------------------
  const newThisWeek = allSignalsRaw
    .filter((s) => s.detectedAt >= weekStart && s.detectedAt <= asOf)
    .map(toSignalSummary);
  const highImportanceActive = activeAsOfWeekEnd
    .filter((s) => s.severity === "critical" || s.importance >= 4)
    .map(toSignalSummary);
  // Current status, not a historical reconstruction — see the doc comment above allSignalsRaw.
  const acknowledgedUnresolved = allSignalsRaw.filter((s) => s.status === "acknowledged").map(toSignalSummary);
  const resolvedThisWeek = allSignalsRaw
    .filter((s) => s.resolvedAt && s.resolvedAt >= weekStart && s.resolvedAt <= asOf)
    .map(toSignalSummary);

  // ---------------------------------------------------------------
  // Trajectory metrics section — "important movements": touched this
  // week, or carrying a real (non-baseline) pace reading either way, so
  // a behind-pace metric doesn't vanish just for not being checkpointed
  // in this exact week.
  // ---------------------------------------------------------------
  const trajectoryMetricsOut: WeeklyReviewSnapshot["trajectoryMetrics"] = metricTrajectories
    .filter((mt) => mt.touchedThisWeek || mt.trajectory.pace)
    .map(({ metric, trajectory, touchedThisWeek }) => ({
      metricId: metric.id,
      name: metric.name,
      categoryName: metric.categoryName,
      unit: metric.unit,
      touchedThisWeek,
      requiredMonthlyChange: trajectory.pace?.requiredMonthlyChange ?? null,
      observedMonthlyChange: trajectory.pace?.observedMonthlyChange ?? null,
      status: (trajectory.pace?.status ?? (trajectory.maturity === "baseline" ? "insufficient" : "no_target")) as
        | PaceStatus
        | "insufficient"
        | "no_target",
      statusReason: trajectory.statusReason,
    }));

  // ---------------------------------------------------------------
  // Daily reviews
  // ---------------------------------------------------------------
  const reviewRows = await db
    .select()
    .from(dailyReviews)
    .where(and(gte(dailyReviews.date, weekStartKey), lte(dailyReviews.date, weekEndKey)));
  const energyRatings = reviewRows.map((r) => r.energyRating).filter((v): v is number => v !== null);
  const dayRatings = reviewRows.map((r) => r.dayRating).filter((v): v is number => v !== null);

  const dailyReviewsOut: WeeklyReviewSnapshot["dailyReviews"] = {
    completedCount: reviewRows.length,
    possibleDays: 7,
    avgEnergyRating: energyRatings.length > 0 ? Math.round((energyRatings.reduce((a, b) => a + b, 0) / energyRatings.length) * 10) / 10 : null,
    avgDayRating: dayRatings.length > 0 ? Math.round((dayRatings.reduce((a, b) => a + b, 0) / dayRatings.length) * 10) / 10 : null,
    entries: reviewRows.map((r) => ({ date: r.date, rawText: r.rawText, energyRating: r.energyRating, dayRating: r.dayRating })),
  };

  const base: Omit<WeeklyReviewSnapshot, "insights" | "priorities"> = {
    weekStartDate: weekStartKey,
    weekEndDate: weekEndKey,
    isoWeek: isoWeekNum,
    isoYear,
    trajectory,
    primeActions,
    recurringBehaviours,
    goals: { completed, neglected, approachingDeadline, outcomeOnPace, outcomeBehindPace },
    pillars: pillarsOut,
    signals: { newThisWeek, highImportanceActive, acknowledgedUnresolved, resolvedThisWeek },
    trajectoryMetrics: trajectoryMetricsOut,
    dailyReviews: dailyReviewsOut,
  };

  const insights = buildWeeklyInsights(base);
  const priorities = await computeWeeklyPriorities(now);

  return { ...base, insights, priorities };
}

/** The only place that writes to weekly_reviews — insert-only, never an update. */
export async function snapshotWeeklyReview(weekStart: Date, now: Date = new Date()) {
  const snapshot = await computeWeeklyReview(weekStart, now);
  const [row] = await db
    .insert(weeklyReviews)
    .values({
      weekStartDate: snapshot.weekStartDate,
      weekEndDate: snapshot.weekEndDate,
      computedAt: now,
      trajectoryState: snapshot.trajectory.state,
      snapshot,
    })
    .returning();
  return row;
}

export async function getLatestWeeklyReview(weekStartKey: string) {
  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.weekStartDate, weekStartKey))
    .orderBy(desc(weeklyReviews.computedAt))
    .limit(1);
  return row;
}

export async function getWeeklyReviewHistory(weekStartKey: string) {
  return db
    .select({ id: weeklyReviews.id, computedAt: weeklyReviews.computedAt, trajectoryState: weeklyReviews.trajectoryState })
    .from(weeklyReviews)
    .where(eq(weeklyReviews.weekStartDate, weekStartKey))
    .orderBy(desc(weeklyReviews.computedAt));
}
