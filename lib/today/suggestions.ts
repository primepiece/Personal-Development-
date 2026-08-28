import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  dailyActions,
  goalRecurrence,
  goals,
  lifeCategories,
} from "@/db/schema";
import { computeAdherence } from "@/lib/behavior/adherence";
import { toDateKey } from "@/lib/today/date";

export type SuggestedAction = {
  goalId: string;
  title: string;
  categoryId: string;
  categoryName: string;
  priority: number;
  reason: string;
};

const NEGLECT_PRIORITY_THRESHOLD = 4;
const NEGLECT_WINDOW_DAYS = 3;

/**
 * Deterministic, rules-based — no model call. If there isn't enough real
 * data to justify a suggestion, this returns fewer results (or none)
 * rather than inventing something to fill the list.
 */
export async function getSuggestedActions(limit = 5): Promise<SuggestedAction[]> {
  const now = new Date();

  const activeWeeklyGoals = await db
    .select({
      id: goals.id,
      title: goals.title,
      categoryId: goals.categoryId,
      categoryName: lifeCategories.name,
      priority: goals.priority,
      kind: goals.kind,
      createdAt: goals.createdAt,
    })
    .from(goals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
    .where(and(eq(goals.tier, "weekly"), eq(goals.status, "active")));

  if (activeWeeklyGoals.length === 0) return [];

  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - NEGLECT_WINDOW_DAYS);

  const recentDone = await db
    .select({ linkedGoalId: dailyActions.linkedGoalId })
    .from(dailyActions)
    .where(
      and(
        eq(dailyActions.status, "done"),
        gte(dailyActions.date, toDateKey(windowStart)),
        inArray(
          dailyActions.linkedGoalId,
          activeWeeklyGoals.map((g) => g.id),
        ),
      ),
    );
  const recentlyActedOn = new Set(recentDone.map((r) => r.linkedGoalId));

  const behaviorGoalIds = activeWeeklyGoals.filter((g) => g.kind === "behavior").map((g) => g.id);
  const recurrenceRows = behaviorGoalIds.length
    ? await db.select().from(goalRecurrence).where(inArray(goalRecurrence.goalId, behaviorGoalIds))
    : [];
  const recurrenceByGoal = new Map(recurrenceRows.map((r) => [r.goalId, r]));

  const completionRows = behaviorGoalIds.length
    ? await db
        .select()
        .from(behaviorCompletions)
        .where(inArray(behaviorCompletions.goalId, behaviorGoalIds))
    : [];
  const completionsByGoal = new Map<string, typeof completionRows>();
  for (const row of completionRows) {
    const list = completionsByGoal.get(row.goalId) ?? [];
    list.push(row);
    completionsByGoal.set(row.goalId, list);
  }

  const suggestions: SuggestedAction[] = [];

  for (const goal of activeWeeklyGoals) {
    if (goal.kind === "behavior") {
      const recurrence = recurrenceByGoal.get(goal.id);
      if (!recurrence) continue;
      const report = computeAdherence(
        recurrence,
        goal.createdAt,
        completionsByGoal.get(goal.id) ?? [],
        now,
      );
      const behindPace = report.current.count < report.current.target && !report.current.met;
      if (behindPace) {
        suggestions.push({
          goalId: goal.id,
          title: goal.title,
          categoryId: goal.categoryId,
          categoryName: goal.categoryName,
          priority: goal.priority,
          reason: `${report.current.count}/${report.current.target} this ${recurrence.period}`,
        });
        continue;
      }
    }

    if (goal.priority >= NEGLECT_PRIORITY_THRESHOLD && !recentlyActedOn.has(goal.id)) {
      suggestions.push({
        goalId: goal.id,
        title: goal.title,
        categoryId: goal.categoryId,
        categoryName: goal.categoryName,
        priority: goal.priority,
        reason: `No action in ${NEGLECT_WINDOW_DAYS} days despite priority ${goal.priority}`,
      });
    }
  }

  suggestions.sort((a, b) => b.priority - a.priority);
  return suggestions.slice(0, limit);
}
