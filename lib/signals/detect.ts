import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  coachSignalReferences,
  coachSignals,
  dailyActions,
  goalRecurrence,
  goals,
  lifeCategories,
  type signalSeverityEnum,
  type signalTypeEnum,
} from "@/db/schema";
import { computeAdherence } from "@/lib/behavior/adherence";
import { toDateKey } from "@/lib/today/date";
import { daysBetween } from "@/lib/scoring/evidence";

type SignalType = (typeof signalTypeEnum.enumValues)[number];
type SignalSeverity = (typeof signalSeverityEnum.enumValues)[number];

const PRIORITY_NEGLECT_DAYS = 3;
const PILLAR_NEGLECT_DAYS = 5;
const DEADLINE_WINDOW_DAYS = 14;
const ADHERENCE_TREND_THRESHOLD = 20; // percentage points
const STREAK_THRESHOLD = 3;
const ACTION_RATE_DROP_THRESHOLD = 25; // percentage points

type Evidence = Record<string, unknown>;
type Ref = { table: string; id: string };

/**
 * The one place a signal gets written, and the whole lifecycle lives
 * here: new → active → (acknowledged | suppressed) → resolved. A still-
 * true condition never duplicates its live row (detected_at stays
 * original); a no-longer-true one resolves; a condition the user
 * suppressed stays quiet even while still true; a condition that returns
 * after resolving is a genuine recurrence and gets a fresh `new` row,
 * not a resurrected old one.
 */
async function reconcile(params: {
  type: SignalType;
  categoryId: string;
  goalId: string | null;
  shouldBeActive: boolean;
  severity: SignalSeverity;
  importance: number;
  evidence: Evidence;
  refs: Ref[];
}) {
  const { type, categoryId, goalId, shouldBeActive, severity, importance, evidence, refs } = params;
  const goalMatch = goalId ? eq(coachSignals.goalId, goalId) : isNull(coachSignals.goalId);

  const [existing] = await db
    .select()
    .from(coachSignals)
    .where(and(eq(coachSignals.type, type), eq(coachSignals.categoryId, categoryId), goalMatch))
    .orderBy(desc(coachSignals.detectedAt))
    .limit(1);

  if (shouldBeActive) {
    if (!existing || existing.status === "resolved") {
      await insertSignal({ type, categoryId, goalId, severity, importance, evidence, refs });
    } else if (existing.status === "new") {
      await db.update(coachSignals).set({ status: "active" }).where(eq(coachSignals.id, existing.id));
    }
    // suppressed, active, acknowledged: leave alone.
  } else if (existing && existing.status !== "resolved") {
    // Includes suppressed: a condition the user silenced still resolves once it's genuinely no
    // longer true — suppression mutes the signal, it doesn't override reality.
    await db
      .update(coachSignals)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(coachSignals.id, existing.id));
  }
}

async function insertSignal(params: {
  type: SignalType;
  categoryId: string;
  goalId: string | null;
  severity: SignalSeverity;
  importance: number;
  evidence: Evidence;
  refs: Ref[];
}) {
  const [signal] = await db
    .insert(coachSignals)
    .values({
      type: params.type,
      categoryId: params.categoryId,
      goalId: params.goalId,
      severity: params.severity,
      importance: params.importance,
      evidence: params.evidence,
    })
    .returning();

  if (params.refs.length > 0) {
    await db.insert(coachSignalReferences).values(
      params.refs.map((ref) => ({ signalId: signal.id, refTable: ref.table, refId: ref.id })),
    );
  }
  return signal;
}

async function detectPriorityNeglected(now: Date) {
  const weeklyGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.tier, "weekly"), eq(goals.status, "active"), gte(goals.priority, 4)));

  for (const goal of weeklyGoals) {
    const [lastAction] = await db
      .select({ date: dailyActions.date })
      .from(dailyActions)
      .where(and(eq(dailyActions.linkedGoalId, goal.id), eq(dailyActions.status, "done")))
      .orderBy(desc(dailyActions.date))
      .limit(1);

    const [lastCompletion] = await db
      .select({ date: behaviorCompletions.date })
      .from(behaviorCompletions)
      .where(and(eq(behaviorCompletions.goalId, goal.id), eq(behaviorCompletions.completed, true)))
      .orderBy(desc(behaviorCompletions.date))
      .limit(1);

    const lastTouchKey = [lastAction?.date, lastCompletion?.date].filter(Boolean).sort().pop();
    const lastTouch = lastTouchKey ? new Date(lastTouchKey) : goal.createdAt;
    const days = daysBetween(lastTouch, now);

    const shouldBeActive = days >= PRIORITY_NEGLECT_DAYS;
    const severity: SignalSeverity =
      (goal.priority === 5 && days >= 7) || days >= 14 ? "critical" : "warning";

    await reconcile({
      type: "priority_neglected",
      categoryId: goal.categoryId,
      goalId: goal.id,
      shouldBeActive,
      severity,
      importance: goal.priority,
      evidence: { goalTitle: goal.title, priority: goal.priority, daysSinceTouch: days },
      refs: [{ table: "goals", id: goal.id }],
    });
  }
}

function signedDaysUntil(target: Date, now: Date): number {
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function detectDeadlineAtRisk(now: Date) {
  const dated = await db
    .select()
    .from(goals)
    .where(and(eq(goals.status, "active"), isNotNull(goals.targetDate)));

  for (const goal of dated) {
    if (!goal.targetDate) continue;
    const daysUntil = signedDaysUntil(new Date(goal.targetDate), now);
    const shouldBeActive = daysUntil <= DEADLINE_WINDOW_DAYS;
    const severity: SignalSeverity = daysUntil <= 3 ? "critical" : "warning";

    await reconcile({
      type: "deadline_at_risk",
      categoryId: goal.categoryId,
      goalId: goal.id,
      shouldBeActive,
      severity,
      importance: goal.priority,
      evidence: { goalTitle: goal.title, targetDate: goal.targetDate, daysUntil },
      refs: [{ table: "goals", id: goal.id }],
    });
  }
}

async function detectAdherenceTrendAndStreak(now: Date) {
  const behaviorGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.tier, "weekly"), eq(goals.kind, "behavior"), eq(goals.status, "active")));

  for (const goal of behaviorGoals) {
    const [recurrence] = await db.select().from(goalRecurrence).where(eq(goalRecurrence.goalId, goal.id)).limit(1);
    if (!recurrence) continue;

    const completions = await db.select().from(behaviorCompletions).where(eq(behaviorCompletions.goalId, goal.id));
    const report = computeAdherence(recurrence, goal.createdAt, completions, now);

    // Streak (positive, sustained consistency).
    await reconcile({
      type: "consistency_streak",
      categoryId: goal.categoryId,
      goalId: goal.id,
      shouldBeActive: report.streak >= STREAK_THRESHOLD,
      severity: "info",
      importance: goal.priority,
      evidence: { goalTitle: goal.title, streak: report.streak, period: recurrence.period },
      refs: [{ table: "goals", id: goal.id }],
    });

    // Trend (needs a recent period plus a real baseline to compare against).
    if (report.history.length >= 3) {
      const recent = report.history[0];
      const priorWindow = report.history.slice(1, 4);
      const recentRate = (recent.count / recent.target) * 100;
      const priorAvg =
        priorWindow.reduce((sum, p) => sum + (p.count / p.target) * 100, 0) / priorWindow.length;
      const diff = recentRate - priorAvg;

      const declining = diff <= -ADHERENCE_TREND_THRESHOLD;
      const improving = diff >= ADHERENCE_TREND_THRESHOLD;

      await reconcile({
        type: "adherence_declining",
        categoryId: goal.categoryId,
        goalId: goal.id,
        shouldBeActive: declining,
        severity: recentRate < 25 ? "critical" : "warning",
        importance: goal.priority,
        evidence: { goalTitle: goal.title, recentRate: round1(recentRate), priorAvg: round1(priorAvg), diff: round1(diff) },
        refs: [{ table: "goals", id: goal.id }],
      });

      await reconcile({
        type: "adherence_improving",
        categoryId: goal.categoryId,
        goalId: goal.id,
        shouldBeActive: improving,
        severity: "info",
        importance: goal.priority,
        evidence: { goalTitle: goal.title, recentRate: round1(recentRate), priorAvg: round1(priorAvg), diff: round1(diff) },
        refs: [{ table: "goals", id: goal.id }],
      });
    }
  }
}

async function detectPillarSignals(now: Date) {
  const categories = await db.select().from(lifeCategories).where(eq(lifeCategories.isActive, true));

  for (const category of categories) {
    const activeGoals = await db
      .select({ id: goals.id, createdAt: goals.createdAt, priority: goals.priority })
      .from(goals)
      .where(and(eq(goals.categoryId, category.id), eq(goals.status, "active")));
    if (activeGoals.length === 0) continue;

    const pillarImportance = Math.max(...activeGoals.map((g) => g.priority));

    const [lastAction] = await db
      .select({ date: dailyActions.date })
      .from(dailyActions)
      .where(and(eq(dailyActions.categoryId, category.id), eq(dailyActions.status, "done")))
      .orderBy(desc(dailyActions.date))
      .limit(1);

    const goalIds = activeGoals.map((g) => g.id);
    let lastCompletionDate: string | undefined;
    if (goalIds.length > 0) {
      const rows = await db
        .select({ date: behaviorCompletions.date, goalId: behaviorCompletions.goalId })
        .from(behaviorCompletions)
        .where(eq(behaviorCompletions.completed, true));
      lastCompletionDate = rows
        .filter((r) => goalIds.includes(r.goalId))
        .map((r) => r.date)
        .sort()
        .pop();
    }

    const earliestGoalCreation = activeGoals
      .map((g) => g.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const lastTouchKey = [lastAction?.date, lastCompletionDate].filter(Boolean).sort().pop();
    const lastTouch = lastTouchKey ? new Date(lastTouchKey) : earliestGoalCreation;
    const days = daysBetween(lastTouch, now);

    await reconcile({
      type: "pillar_neglected",
      categoryId: category.id,
      goalId: null,
      shouldBeActive: days >= PILLAR_NEGLECT_DAYS,
      severity: days >= 14 ? "critical" : "warning",
      importance: pillarImportance,
      evidence: { categoryName: category.name, daysSinceTouch: days },
      refs: [],
    });

    // Prime Action completion rate: this trailing week vs. the week before.
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const twoWeeksStart = new Date(now);
    twoWeeksStart.setDate(now.getDate() - 14);

    const actions = await db
      .select({ status: dailyActions.status, date: dailyActions.date })
      .from(dailyActions)
      .where(and(eq(dailyActions.categoryId, category.id), gte(dailyActions.date, toDateKey(twoWeeksStart))));

    const recentActions = actions.filter((a) => a.date >= toDateKey(weekStart));
    const priorActions = actions.filter((a) => a.date < toDateKey(weekStart));

    if (recentActions.length >= 2 && priorActions.length >= 2) {
      const recentRate = (recentActions.filter((a) => a.status === "done").length / recentActions.length) * 100;
      const priorRate = (priorActions.filter((a) => a.status === "done").length / priorActions.length) * 100;
      const diff = recentRate - priorRate;

      await reconcile({
        type: "action_completion_falling",
        categoryId: category.id,
        goalId: null,
        shouldBeActive: diff <= -ACTION_RATE_DROP_THRESHOLD,
        severity: recentRate < 30 && recentActions.length >= 3 ? "critical" : "warning",
        importance: pillarImportance,
        evidence: {
          categoryName: category.name,
          recentRate: round1(recentRate),
          priorRate: round1(priorRate),
          diff: round1(diff),
        },
        refs: [],
      });
    }
  }
}

async function detectGoalCompleted() {
  const doneGoals = await db.select().from(goals).where(eq(goals.status, "done"));
  const reopened = await db.select().from(goals).where(eq(goals.status, "active"));

  for (const goal of doneGoals) {
    await reconcile({
      type: "goal_completed",
      categoryId: goal.categoryId,
      goalId: goal.id,
      shouldBeActive: true,
      severity: "info",
      importance: goal.priority,
      evidence: { goalTitle: goal.title, tier: goal.tier },
      refs: [{ table: "goals", id: goal.id }],
    });
  }

  for (const goal of reopened) {
    await reconcile({
      type: "goal_completed",
      categoryId: goal.categoryId,
      goalId: goal.id,
      shouldBeActive: false,
      severity: "info",
      importance: goal.priority,
      evidence: { goalTitle: goal.title },
      refs: [],
    });
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Runs every detector — the whole deterministic Layer 1 pass. */
export async function runSignalDetectors(now: Date = new Date()) {
  await detectPriorityNeglected(now);
  await detectDeadlineAtRisk(now);
  await detectAdherenceTrendAndStreak(now);
  await detectPillarSignals(now);
  await detectGoalCompleted();
}
