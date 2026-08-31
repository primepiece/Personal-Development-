import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  coachSignals,
  dailyActions,
  dailyReviews,
  goalRecurrence,
  goals,
  lifeCategories,
  standards,
  visionEntries,
} from "@/db/schema";
import { computeAdherence } from "@/lib/behavior/adherence";
import { describeSignal } from "@/lib/scoring/labels";
import { computeWeeklyPriorities } from "@/lib/weekly/priorities";
import { toDateKey } from "@/lib/today/date";
import type { AllowedRefs } from "@/lib/coach/types";
import type { AllowedPillarIds, MorningEvidenceBundle, WeeklyGoalCategoryById } from "./types";

const RECENT_ACTIVITY_WINDOW_DAYS = 7;
const RECENT_REVIEWS_MAX = 5;

/**
 * Assembles the entire deterministic input handed to the model, plus the
 * three allowlists the fail-closed validator checks the model's output
 * against: real evidence ids (reusing the exact id->table pattern from
 * lib/coach/evidence.ts), real active pillar ids, and real active weekly
 * goal ids (the only goals a recommendation may link to, matching what
 * daily_actions itself allows).
 *
 * Deliberately has no dependency on a Weekly Review existing — Day 1 has
 * none, and Morning Brief has to work under exactly that condition. Every
 * section here is either a raw query or a reused deterministic function
 * (computeAdherence, computeWeeklyPriorities), never a signal that
 * requires history to have accumulated first.
 */
export async function buildMorningEvidenceBundle(
  dateKey: string,
  now: Date = new Date(),
): Promise<{
  bundle: MorningEvidenceBundle;
  allowedRefs: AllowedRefs;
  allowedPillarIds: AllowedPillarIds;
  weeklyGoalCategoryById: WeeklyGoalCategoryById;
}> {
  const allowedRefs: AllowedRefs = new Map();
  const allow = (table: string, id: string | null | undefined) => {
    if (id) allowedRefs.set(id, table);
  };

  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - RECENT_ACTIVITY_WINDOW_DAYS);
  const windowStartKey = toDateKey(windowStart);

  const pillarRows = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.isActive, true))
    .orderBy(lifeCategories.sortOrder);
  const allowedPillarIds: AllowedPillarIds = new Set(pillarRows.map((p) => p.id));

  // ---------------------------------------------------------------
  // Recent activity, split by day-vs-today so the model can both judge
  // neglect (recentPrimeActions/recentActivityDays) and avoid recommending
  // something already on today's list (todaysExistingActions).
  // ---------------------------------------------------------------
  const recentActionRows = await db
    .select({
      date: dailyActions.date,
      title: dailyActions.title,
      categoryId: dailyActions.categoryId,
      categoryName: lifeCategories.name,
      linkedGoalId: dailyActions.linkedGoalId,
      status: dailyActions.status,
    })
    .from(dailyActions)
    .innerJoin(lifeCategories, eq(lifeCategories.id, dailyActions.categoryId))
    .where(and(gte(dailyActions.date, windowStartKey), lt(dailyActions.date, dateKey)));

  const todaysActionRows = await db
    .select({
      title: dailyActions.title,
      categoryName: lifeCategories.name,
      linkedGoalId: dailyActions.linkedGoalId,
    })
    .from(dailyActions)
    .innerJoin(lifeCategories, eq(lifeCategories.id, dailyActions.categoryId))
    .where(eq(dailyActions.date, dateKey));

  const recentCompletionRows = await db
    .select({ date: behaviorCompletions.date, categoryId: goals.categoryId })
    .from(behaviorCompletions)
    .innerJoin(goals, eq(goals.id, behaviorCompletions.goalId))
    .where(
      and(
        eq(behaviorCompletions.completed, true),
        gte(behaviorCompletions.date, windowStartKey),
        lt(behaviorCompletions.date, dateKey),
      ),
    );

  const activityDaysByCategory = new Map<string, Set<string>>();
  for (const row of recentActionRows) {
    if (row.status !== "done") continue;
    const set = activityDaysByCategory.get(row.categoryId) ?? new Set<string>();
    set.add(row.date);
    activityDaysByCategory.set(row.categoryId, set);
  }
  for (const row of recentCompletionRows) {
    const set = activityDaysByCategory.get(row.categoryId) ?? new Set<string>();
    set.add(row.date);
    activityDaysByCategory.set(row.categoryId, set);
  }

  // ---------------------------------------------------------------
  // Pillar hierarchy — Vision (context only), Standards, and every active
  // goal (any tier) with priority and deadline math already computed, so
  // the model never has to do date arithmetic itself.
  // ---------------------------------------------------------------
  const weeklyGoalCategoryById: WeeklyGoalCategoryById = new Map();
  const pillars: MorningEvidenceBundle["pillars"] = [];
  for (const p of pillarRows) {
    const [vision] = await db.select().from(visionEntries).where(eq(visionEntries.categoryId, p.id)).limit(1);

    const standardRows = await db
      .select()
      .from(standards)
      .where(and(eq(standards.categoryId, p.id), eq(standards.isActive, true)));
    for (const s of standardRows) allow("standards", s.id);

    const goalRows = await db
      .select({
        id: goals.id,
        tier: goals.tier,
        kind: goals.kind,
        title: goals.title,
        priority: goals.priority,
        targetDate: goals.targetDate,
      })
      .from(goals)
      .where(and(eq(goals.categoryId, p.id), eq(goals.status, "active")));

    const activeGoals = goalRows.map((g) => {
      allow("goals", g.id);
      if (g.tier === "weekly") weeklyGoalCategoryById.set(g.id, p.id);
      const daysUntilTarget = g.targetDate
        ? Math.round((new Date(`${g.targetDate}T00:00:00`).getTime() - now.getTime()) / 86400000)
        : null;
      return {
        id: g.id,
        tier: g.tier,
        kind: g.kind,
        title: g.title,
        priority: g.priority,
        targetDate: g.targetDate,
        daysUntilTarget,
      };
    });

    pillars.push({
      categoryId: p.id,
      categoryName: p.name,
      whyItMatters: vision?.whyItMatters || null,
      standards: standardRows.map((s) => ({ id: s.id, statement: s.statement })),
      activeGoals,
      recentActivityDays: activityDaysByCategory.get(p.id)?.size ?? 0,
    });
  }

  // ---------------------------------------------------------------
  // Weekly priorities — the same deterministic, forward-looking ranking
  // (severity, importance, deadline risk, repeated neglect, trajectory
  // gap) the Weekly Review's "Weekly Priority" section uses, computed
  // live against right now. This is the ranking backbone for the brief;
  // its own refs are folded into allowedRefs so the model can cite them.
  // ---------------------------------------------------------------
  const priorityItems = await computeWeeklyPriorities(now);
  for (const item of priorityItems) for (const ref of item.refs) allow(ref.table, ref.id);
  const weeklyPriorities = priorityItems.map((item) => ({
    rank: item.rank,
    kind: item.kind,
    label: item.label,
    categoryName: item.categoryName,
    score: item.score,
    factors: item.factors,
  }));

  // ---------------------------------------------------------------
  // Unresolved signals — the full current picture (mirrors coach evidence.ts).
  // ---------------------------------------------------------------
  const signalRows = await db
    .select({
      id: coachSignals.id,
      type: coachSignals.type,
      severity: coachSignals.severity,
      importance: coachSignals.importance,
      categoryName: lifeCategories.name,
      evidence: coachSignals.evidence,
      detectedAt: coachSignals.detectedAt,
      status: coachSignals.status,
    })
    .from(coachSignals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, coachSignals.categoryId))
    .where(inArray(coachSignals.status, ["new", "active", "acknowledged"]));

  const unresolvedSignals = signalRows.map((s) => {
    allow("coach_signals", s.id);
    return {
      id: s.id,
      type: s.type,
      severity: s.severity,
      importance: s.importance,
      categoryName: s.categoryName,
      description: describeSignal(s),
      detectedAt: s.detectedAt.toISOString(),
      status: s.status,
    };
  });

  // ---------------------------------------------------------------
  // Recurring behaviours — current-period adherence for every active
  // weekly behavior goal, same computeAdherence M2 already uses on Today.
  // ---------------------------------------------------------------
  const behaviorGoalRows = await db
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

  const recurringBehaviours: MorningEvidenceBundle["recurringBehaviours"] = [];
  for (const goal of behaviorGoalRows) {
    const [recurrence] = await db.select().from(goalRecurrence).where(eq(goalRecurrence.goalId, goal.id)).limit(1);
    if (!recurrence) continue;
    const completions = await db.select().from(behaviorCompletions).where(eq(behaviorCompletions.goalId, goal.id));
    const report = computeAdherence(recurrence, goal.createdAt, completions, now);
    recurringBehaviours.push({
      goalId: goal.id,
      goalTitle: goal.title,
      categoryName: goal.categoryName,
      period: recurrence.period,
      targetFrequency: recurrence.targetFrequency,
      currentCount: report.current.count,
      currentTarget: report.current.target,
      currentMet: report.current.met,
      doneToday: completions.some((c) => c.date === dateKey && c.completed),
      streak: report.streak,
    });
  }

  // ---------------------------------------------------------------
  // Recent Prime Actions (evidence for neglect + "don't repeat myself")
  // and recent evening reviews (qualitative context on recent days).
  // ---------------------------------------------------------------
  const recentPrimeActions = recentActionRows.map((r) => ({
    date: r.date,
    title: r.title,
    categoryName: r.categoryName,
    linkedGoalId: r.linkedGoalId,
    status: r.status,
  }));

  const todaysExistingActions = todaysActionRows.map((r) => ({
    title: r.title,
    categoryName: r.categoryName,
    linkedGoalId: r.linkedGoalId,
  }));

  const reviewRows = await db
    .select()
    .from(dailyReviews)
    .where(lt(dailyReviews.date, dateKey))
    .orderBy(desc(dailyReviews.date))
    .limit(RECENT_REVIEWS_MAX);
  const recentEveningReviews = reviewRows.map((r) => ({
    date: r.date,
    rawText: r.rawText,
    energyRating: r.energyRating,
    dayRating: r.dayRating,
  }));

  return {
    bundle: {
      date: dateKey,
      pillars,
      weeklyPriorities,
      unresolvedSignals,
      recurringBehaviours,
      recentPrimeActions,
      recentEveningReviews,
      todaysExistingActions,
    },
    allowedRefs,
    allowedPillarIds,
    weeklyGoalCategoryById,
  };
}
