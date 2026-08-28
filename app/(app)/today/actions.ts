"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  dailyActions,
  dailyReviews,
  dailyReviewHistory,
  goals,
  ventures,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today/date";

const MAX_DAILY_ACTIONS = 5;

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

async function findOrCreateVenture(name: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(ventures)
    .where(ilike(ventures.name, name))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db.insert(ventures).values({ name }).returning();
  return created.id;
}

export async function createDailyActionAction(formData: FormData) {
  await requireUser();
  const date = todayKey();

  const existing = await db.select().from(dailyActions).where(eq(dailyActions.date, date));
  if (existing.length >= MAX_DAILY_ACTIONS) {
    throw new Error(`Today already has ${MAX_DAILY_ACTIONS} Prime Actions — remove one first.`);
  }

  const title = str(formData, "title");
  if (!title) throw new Error("An action needs a title.");

  const linkedGoalIdRaw = str(formData, "linkedGoalId");
  const isStandalone = str(formData, "isStandalone") === "on";
  const priorityRaw = str(formData, "priority");
  const ventureName = str(formData, "ventureName");

  let categoryId: string;
  let linkedGoalId: string | null = null;

  if (linkedGoalIdRaw) {
    const [goal] = await db.select().from(goals).where(eq(goals.id, linkedGoalIdRaw)).limit(1);
    if (!goal || goal.tier !== "weekly") {
      throw new Error("An action can only link to an active weekly goal.");
    }
    linkedGoalId = goal.id;
    categoryId = goal.categoryId;
  } else {
    if (!isStandalone) {
      throw new Error(
        "Link this to a weekly goal, or explicitly mark it standalone — one of the two is required.",
      );
    }
    categoryId = str(formData, "categoryId");
    if (!categoryId) throw new Error("Pick a pillar for a standalone action.");
  }

  const ventureId = ventureName ? await findOrCreateVenture(ventureName) : null;

  await db.insert(dailyActions).values({
    date,
    title,
    categoryId,
    linkedGoalId,
    isStandalone: !linkedGoalId,
    ventureId,
    priority: priorityRaw ? Number(priorityRaw) : 3,
    source: "user",
  });

  revalidatePath("/today");
}

export async function acceptSuggestionAction(formData: FormData) {
  await requireUser();
  const date = todayKey();

  const existing = await db.select().from(dailyActions).where(eq(dailyActions.date, date));
  if (existing.length >= MAX_DAILY_ACTIONS) {
    throw new Error(`Today already has ${MAX_DAILY_ACTIONS} Prime Actions — remove one first.`);
  }

  const goalId = str(formData, "goalId");
  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
  if (!goal) throw new Error("That goal no longer exists.");

  await db.insert(dailyActions).values({
    date,
    title: goal.title,
    categoryId: goal.categoryId,
    linkedGoalId: goal.id,
    isStandalone: false,
    priority: goal.priority,
    source: "suggested",
  });

  revalidatePath("/today");
}

export async function removeActionAction(formData: FormData) {
  await requireUser();
  const actionId = str(formData, "actionId");

  const [action] = await db.select().from(dailyActions).where(eq(dailyActions.id, actionId)).limit(1);
  if (!action) return;
  if (action.status !== "pending") {
    throw new Error("Only a still-pending action can be removed — it's part of today's record once acted on.");
  }

  await db.delete(dailyActions).where(eq(dailyActions.id, actionId));
  revalidatePath("/today");
}

export async function toggleActionStatusAction(formData: FormData) {
  await requireUser();
  const actionId = str(formData, "actionId");
  const date = todayKey();

  const [action] = await db.select().from(dailyActions).where(eq(dailyActions.id, actionId)).limit(1);
  if (!action) return;

  const nowDone = action.status !== "done";

  await db
    .update(dailyActions)
    .set({ status: nowDone ? "done" : "pending", completedAt: nowDone ? new Date() : null })
    .where(eq(dailyActions.id, actionId));

  // A completed action linked to a recurring behavior goal counts as
  // that day's completion too — no separate click required.
  if (action.linkedGoalId) {
    const [goal] = await db.select().from(goals).where(eq(goals.id, action.linkedGoalId)).limit(1);
    if (goal?.kind === "behavior") {
      if (nowDone) {
        await db
          .insert(behaviorCompletions)
          .values({ goalId: goal.id, date, completed: true, source: "daily_action" })
          .onConflictDoNothing();
      } else {
        await db
          .delete(behaviorCompletions)
          .where(and(eq(behaviorCompletions.goalId, goal.id), eq(behaviorCompletions.date, date)));
      }
    }
  }

  revalidatePath("/today");
}

export async function toggleBehaviorCompletionAction(formData: FormData) {
  await requireUser();
  const goalId = str(formData, "goalId");
  const date = todayKey();

  const [existing] = await db
    .select()
    .from(behaviorCompletions)
    .where(and(eq(behaviorCompletions.goalId, goalId), eq(behaviorCompletions.date, date)))
    .limit(1);

  if (existing) {
    await db.delete(behaviorCompletions).where(eq(behaviorCompletions.id, existing.id));
  } else {
    await db.insert(behaviorCompletions).values({ goalId, date, completed: true, source: "manual" });
  }

  revalidatePath("/today");
}

export async function saveReviewAction(formData: FormData) {
  await requireUser();
  const date = todayKey();

  const rawText = str(formData, "rawText");
  const energyRaw = str(formData, "energyRating");
  const dayRaw = str(formData, "dayRating");
  if (!rawText) throw new Error("Write something before saving — even a couple of lines.");

  const energyRating = energyRaw ? Number(energyRaw) : null;
  const dayRating = dayRaw ? Number(dayRaw) : null;

  const [existing] = await db.select().from(dailyReviews).where(eq(dailyReviews.date, date)).limit(1);

  if (existing) {
    await db.insert(dailyReviewHistory).values({
      date: existing.date,
      rawText: existing.rawText,
      energyRating: existing.energyRating,
      dayRating: existing.dayRating,
    });
    await db
      .update(dailyReviews)
      .set({ rawText, energyRating, dayRating, updatedAt: new Date() })
      .where(eq(dailyReviews.date, date));
  } else {
    await db.insert(dailyReviews).values({ date, rawText, energyRating, dayRating });
  }

  revalidatePath("/today");
}
