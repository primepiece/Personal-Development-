"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  goalRecurrence,
  goals,
  standards,
  visionEntries,
  visionEntryHistory,
  type goalKindEnum,
  type goalTierEnum,
  type recurrencePeriodEnum,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { requiredParentTier, type GoalTier } from "@/lib/goals/tiers";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveVisionAction(formData: FormData) {
  await requireUser();

  const categoryId = str(formData, "categoryId");
  const fields = {
    whoIWantToBecome: str(formData, "whoIWantToBecome"),
    lifeLooksLike: str(formData, "lifeLooksLike"),
    longTermTargets: str(formData, "longTermTargets"),
    whyItMatters: str(formData, "whyItMatters"),
    refuseToBecome: str(formData, "refuseToBecome"),
  };

  const [existing] = await db
    .select()
    .from(visionEntries)
    .where(eq(visionEntries.categoryId, categoryId))
    .limit(1);

  if (existing) {
    await db.insert(visionEntryHistory).values({
      categoryId: existing.categoryId,
      whoIWantToBecome: existing.whoIWantToBecome,
      lifeLooksLike: existing.lifeLooksLike,
      longTermTargets: existing.longTermTargets,
      whyItMatters: existing.whyItMatters,
      refuseToBecome: existing.refuseToBecome,
    });
    await db
      .update(visionEntries)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(visionEntries.categoryId, categoryId));
  } else {
    await db.insert(visionEntries).values({ categoryId, ...fields });
  }

  revalidatePath(`/goals`);
}

export async function addStandardAction(formData: FormData) {
  await requireUser();

  const categoryId = str(formData, "categoryId");
  const statement = str(formData, "statement");
  if (!statement) throw new Error("A standard needs a statement.");

  await db.insert(standards).values({ categoryId, statement });
  revalidatePath(`/goals`);
}

export async function archiveStandardAction(formData: FormData) {
  await requireUser();

  const standardId = str(formData, "standardId");
  await db
    .update(standards)
    .set({ isActive: false })
    .where(eq(standards.id, standardId));
  revalidatePath(`/goals`);
}

export async function createGoalAction(formData: FormData) {
  await requireUser();

  const categoryId = str(formData, "categoryId");
  const tier = str(formData, "tier") as (typeof goalTierEnum.enumValues)[number];
  const parentGoalIdRaw = str(formData, "parentGoalId");
  const kind = str(formData, "kind") as (typeof goalKindEnum.enumValues)[number];
  const title = str(formData, "title");
  const description = str(formData, "description");
  const targetMetric = str(formData, "targetMetric");
  const targetValueRaw = str(formData, "targetValue");
  const targetDateRaw = str(formData, "targetDate");
  const milestoneAgeRaw = str(formData, "milestoneAge");
  const priorityRaw = str(formData, "priority");

  if (!title) throw new Error("A goal needs a title.");

  const expectedParentTier = requiredParentTier(tier as GoalTier);
  let parentGoalId: string | null = null;

  if (expectedParentTier) {
    if (!parentGoalIdRaw) {
      throw new Error(
        `A ${tier} goal needs a parent ${expectedParentTier} goal.`,
      );
    }
    const [parent] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, parentGoalIdRaw))
      .limit(1);
    if (!parent || parent.tier !== expectedParentTier || parent.categoryId !== categoryId) {
      throw new Error(
        `The selected parent isn't a ${expectedParentTier} goal in this pillar.`,
      );
    }
    parentGoalId = parent.id;
  }

  const [created] = await db
    .insert(goals)
    .values({
      categoryId,
      tier,
      kind,
      parentGoalId,
      milestoneAge: milestoneAgeRaw ? Number(milestoneAgeRaw) : null,
      title,
      description: description || null,
      targetMetric: targetMetric || null,
      targetValue: targetValueRaw ? Number(targetValueRaw) : null,
      targetDate: targetDateRaw || null,
      priority: priorityRaw ? Number(priorityRaw) : 3,
    })
    .returning();

  if (kind === "behavior") {
    const period = str(
      formData,
      "recurrencePeriod",
    ) as (typeof recurrencePeriodEnum.enumValues)[number];
    const targetFrequencyRaw = str(formData, "targetFrequency");
    if (period && targetFrequencyRaw) {
      await db.insert(goalRecurrence).values({
        goalId: created.id,
        period,
        targetFrequency: Number(targetFrequencyRaw),
      });
    }
  }

  revalidatePath(`/goals`);
}

/**
 * The one piece of goal-editing M3 needs: a way to mark a goal done (or
 * reopen it), so the goal_completed signal has something real to detect.
 * Everything else about goal-editing stays out of scope until it's asked
 * for — this isn't a general edit form, just a status toggle.
 */
export async function toggleGoalDoneAction(formData: FormData) {
  await requireUser();

  const goalId = str(formData, "goalId");
  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
  if (!goal) throw new Error("Goal not found.");

  await db
    .update(goals)
    .set({ status: goal.status === "done" ? "active" : "done", updatedAt: new Date() })
    .where(eq(goals.id, goalId));

  revalidatePath(`/goals`);
  revalidatePath(`/`);
}

// goal_history is wired into the schema (db/schema/goals.ts) for when
// full goal editing ships — this action only ever touches status.
