import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { behaviorCompletions, dailyActions, goals, lifeCategories } from "@/db/schema";

export type DailySummary = {
  actionsTotal: number;
  actionsDone: number;
  pillarsProgressed: { id: string; name: string }[];
  recurringCompletedCount: number;
  highestPriorityUnfinished: { id: string; title: string; priority: number } | null;
  neglectedWeeklyGoals: { id: string; title: string; priority: number }[];
};

const NEGLECT_PRIORITY_THRESHOLD = 4;
const MAX_NEGLECTED_SHOWN = 3;

/**
 * Every field here comes straight out of Postgres for `dateKey` — no
 * model call, nothing inferred from the review's free text. This is
 * deliberately boring: real counts, not a narrative.
 */
export async function getDailySummary(dateKey: string): Promise<DailySummary> {
  const todaysActions = await db
    .select()
    .from(dailyActions)
    .where(eq(dailyActions.date, dateKey));

  const actionsTotal = todaysActions.length;
  const actionsDone = todaysActions.filter((a) => a.status === "done").length;

  const doneCategoryIds = new Set(
    todaysActions.filter((a) => a.status === "done").map((a) => a.categoryId),
  );

  const todaysCompletions = await db
    .select({
      goalId: behaviorCompletions.goalId,
      completed: behaviorCompletions.completed,
      categoryId: goals.categoryId,
    })
    .from(behaviorCompletions)
    .innerJoin(goals, eq(goals.id, behaviorCompletions.goalId))
    .where(and(eq(behaviorCompletions.date, dateKey), eq(behaviorCompletions.completed, true)));

  for (const c of todaysCompletions) doneCategoryIds.add(c.categoryId);

  const pillarRows =
    doneCategoryIds.size > 0
      ? await db.select().from(lifeCategories)
      : [];
  const pillarsProgressed = pillarRows
    .filter((p) => doneCategoryIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));

  const pendingActions = todaysActions
    .filter((a) => a.status === "pending")
    .sort((a, b) => b.priority - a.priority);
  const highestPriorityUnfinished = pendingActions[0]
    ? {
        id: pendingActions[0].id,
        title: pendingActions[0].title,
        priority: pendingActions[0].priority,
      }
    : null;

  const actedOnGoalIds = new Set([
    ...todaysActions.filter((a) => a.status === "done" && a.linkedGoalId).map((a) => a.linkedGoalId as string),
    ...todaysCompletions.map((c) => c.goalId),
  ]);

  const importantWeeklyGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.tier, "weekly"), eq(goals.status, "active")));

  const neglectedWeeklyGoals = importantWeeklyGoals
    .filter((g) => g.priority >= NEGLECT_PRIORITY_THRESHOLD && !actedOnGoalIds.has(g.id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_NEGLECTED_SHOWN)
    .map((g) => ({ id: g.id, title: g.title, priority: g.priority }));

  return {
    actionsTotal,
    actionsDone,
    pillarsProgressed,
    recurringCompletedCount: todaysCompletions.length,
    highestPriorityUnfinished,
    neglectedWeeklyGoals,
  };
}
