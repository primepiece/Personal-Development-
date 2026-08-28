import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  categoryScores,
  dailyActions,
  goalRecurrence,
  goals,
  lifeCategories,
} from "@/db/schema";
import { toDateKey } from "@/lib/today/date";
import {
  computeActionCompletionComponent,
  computeBehaviorAdherenceComponent,
  type ScoreComponent,
} from "./components";

const ACTION_WINDOW_DAYS = 14;
const TREND_MIN_DIFF = 3;

export type ScoreConfidence = "insufficient" | "low" | "medium" | "high";
export type ScoreTrend = "up" | "flat" | "down";

export type PillarScoreResult = {
  categoryId: string;
  score: number | null;
  confidence: ScoreConfidence;
  trend: ScoreTrend | null;
  breakdown: {
    components: ScoreComponent[];
    includedKeys: string[];
    confidencePoints: number;
    confidenceReason: string;
  };
};

function confidenceFromComponents(components: ScoreComponent[]): {
  confidence: ScoreConfidence;
  points: number;
  reason: string;
} {
  const included = components.filter((c) => c.maturity !== "baseline" && c.value !== null);
  if (included.length === 0) {
    return {
      confidence: "insufficient",
      points: 0,
      reason: "no component has enough evidence yet — every one is still establishing baseline",
    };
  }

  const points = included.reduce((sum, c) => sum + (c.maturity === "trend" ? 2 : 1), 0);
  let confidence: ScoreConfidence;
  if (points <= 2) confidence = "low";
  else if (points === 3) confidence = "medium";
  else confidence = "high";

  const trendCount = included.filter((c) => c.maturity === "trend").length;
  const assessableCount = included.length - trendCount;
  const reason = `${included.length} component${included.length === 1 ? "" : "s"} included (${trendCount} at trend maturity, ${assessableCount} assessable) = ${points} confidence point${points === 1 ? "" : "s"}`;

  return { confidence, points, reason };
}

/**
 * Computes a pillar's score fresh from current data — pure with respect
 * to the database (reads only). Does not insert anything; the caller
 * decides whether/when to snapshot the result.
 */
export async function computePillarScore(categoryId: string, now: Date = new Date()): Promise<PillarScoreResult> {
  const [category] = await db.select().from(lifeCategories).where(eq(lifeCategories.id, categoryId)).limit(1);
  if (!category) throw new Error(`Unknown category ${categoryId}`);

  const components: ScoreComponent[] = [];

  // Behavior-goal adherence components.
  const behaviorGoals = await db
    .select({ id: goals.id, title: goals.title, createdAt: goals.createdAt })
    .from(goals)
    .where(
      and(
        eq(goals.categoryId, categoryId),
        eq(goals.tier, "weekly"),
        eq(goals.kind, "behavior"),
        eq(goals.status, "active"),
      ),
    );

  for (const goal of behaviorGoals) {
    const [recurrence] = await db
      .select()
      .from(goalRecurrence)
      .where(eq(goalRecurrence.goalId, goal.id))
      .limit(1);
    if (!recurrence) continue;

    const completions = await db
      .select()
      .from(behaviorCompletions)
      .where(eq(behaviorCompletions.goalId, goal.id));

    components.push(
      computeBehaviorAdherenceComponent({
        goal,
        recurrence,
        completions,
        now,
      }),
    );
  }

  // Prime Action completion-rate component (pillar-wide).
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - ACTION_WINDOW_DAYS);

  const actionsInWindow = await db
    .select({ id: dailyActions.id, status: dailyActions.status, date: dailyActions.date })
    .from(dailyActions)
    .where(and(eq(dailyActions.categoryId, categoryId), gte(dailyActions.date, toDateKey(windowStart))));

  components.push(
    computeActionCompletionComponent({
      categoryId,
      categoryName: category.name,
      actions: actionsInWindow,
      now,
      windowDays: ACTION_WINDOW_DAYS,
    }),
  );

  const included = components.filter((c) => c.maturity !== "baseline" && c.value !== null);
  // Equal-weight average — the simplest, most transparent scheme, and the
  // only one honest enough to ship without inventing an importance
  // hierarchy between components. Refine later without rewriting callers.
  for (const c of components) {
    c.weight = included.includes(c) ? Math.round((1 / included.length) * 1000) / 1000 : 0;
  }
  const score =
    included.length > 0
      ? Math.round((included.reduce((sum, c) => sum + (c.value as number) * (c.weight as number), 0)) * 10) / 10
      : null;

  const { confidence, points, reason } = confidenceFromComponents(components);

  // Trend: compare against the most recent prior snapshot with a real score.
  let trend: ScoreTrend | null = null;
  if (score !== null) {
    const [previous] = await db
      .select()
      .from(categoryScores)
      .where(eq(categoryScores.categoryId, categoryId))
      .orderBy(desc(categoryScores.computedAt))
      .limit(1);

    if (previous && previous.score !== null) {
      const diff = score - previous.score;
      trend = diff > TREND_MIN_DIFF ? "up" : diff < -TREND_MIN_DIFF ? "down" : "flat";
    }
  }

  return {
    categoryId,
    score,
    confidence,
    trend,
    breakdown: {
      components,
      includedKeys: included.map((c) => c.key),
      confidencePoints: points,
      confidenceReason: reason,
    },
  };
}

/** Computes and persists a snapshot — the only place that writes to category_scores. */
export async function snapshotPillarScore(categoryId: string, now: Date = new Date()) {
  const result = await computePillarScore(categoryId, now);
  const [row] = await db
    .insert(categoryScores)
    .values({
      categoryId: result.categoryId,
      computedAt: now,
      score: result.score,
      confidence: result.confidence,
      trend: result.trend,
      breakdown: result.breakdown,
    })
    .returning();
  return row;
}
