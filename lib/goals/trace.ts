import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals } from "@/db/schema";

export type GoalRow = typeof goals.$inferSelect;

/**
 * Walks parent_goal_id from `goal` up to its root (a milestone goal with
 * no parent). Returns the chain ordered root-first, ending with `goal`
 * itself — this is the literal answer to "why am I doing this," one hop
 * at a time, before it's joined against the root's pillar Vision.
 */
export async function traceGoalChain(goal: GoalRow): Promise<GoalRow[]> {
  const chain: GoalRow[] = [goal];
  let current = goal;

  while (current.parentGoalId) {
    const [parent] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, current.parentGoalId))
      .limit(1);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}
