"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyActions, goals, morningRecommendations } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today/date";
import { MAX_DAILY_ACTIONS } from "@/lib/today/constants";

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

async function loadPendingRecommendation(recommendationId: string) {
  const [rec] = await db
    .select()
    .from(morningRecommendations)
    .where(eq(morningRecommendations.id, recommendationId))
    .limit(1);
  if (!rec) throw new Error("That recommendation no longer exists.");
  if (rec.status !== "pending") throw new Error("This recommendation has already been decided.");
  return rec;
}

/**
 * The exact same daily_actions write path createDailyActionAction and
 * acceptSuggestionAction use (today/actions.ts) — a recommendation
 * becomes a completely ordinary Prime Action once accepted, respecting
 * the same 5-action cap and the same "linked goal must be active weekly
 * tier, otherwise standalone" rule. If the recommendation's linked goal
 * was retired or completed between generation and accept, this falls
 * back to standalone under the recommendation's own pillar rather than
 * failing the accept outright.
 */
async function createActionFromRecommendation(
  rec: typeof morningRecommendations.$inferSelect,
  title: string,
) {
  const date = todayKey();
  const existing = await db.select().from(dailyActions).where(eq(dailyActions.date, date));
  if (existing.length >= MAX_DAILY_ACTIONS) {
    throw new Error(`Today already has ${MAX_DAILY_ACTIONS} Prime Actions — remove one first.`);
  }

  let categoryId = rec.categoryId;
  let linkedGoalId: string | null = null;
  let priority = 3;

  if (rec.linkedGoalId) {
    const [goal] = await db.select().from(goals).where(eq(goals.id, rec.linkedGoalId)).limit(1);
    if (goal && goal.tier === "weekly" && goal.status === "active") {
      linkedGoalId = goal.id;
      categoryId = goal.categoryId;
      priority = goal.priority;
    }
  }

  const [action] = await db
    .insert(dailyActions)
    .values({
      date,
      title,
      categoryId,
      linkedGoalId,
      isStandalone: !linkedGoalId,
      priority,
      source: "suggested",
    })
    .returning();

  return action;
}

export async function acceptMorningRecommendationAction(formData: FormData) {
  await requireUser();
  const rec = await loadPendingRecommendation(str(formData, "recommendationId"));

  const action = await createActionFromRecommendation(rec, rec.title);

  await db
    .update(morningRecommendations)
    .set({ status: "accepted", resultingActionId: action.id, decidedAt: new Date() })
    .where(eq(morningRecommendations.id, rec.id));

  revalidatePath("/today");
}

export async function editAndAcceptMorningRecommendationAction(formData: FormData) {
  await requireUser();
  const rec = await loadPendingRecommendation(str(formData, "recommendationId"));

  const editedTitle = str(formData, "title");
  if (!editedTitle) throw new Error("Give the edited action a title.");

  const action = await createActionFromRecommendation(rec, editedTitle);

  await db
    .update(morningRecommendations)
    .set({ status: "edited_accepted", editedTitle, resultingActionId: action.id, decidedAt: new Date() })
    .where(eq(morningRecommendations.id, rec.id));

  revalidatePath("/today");
}

export async function dismissMorningRecommendationAction(formData: FormData) {
  await requireUser();
  const rec = await loadPendingRecommendation(str(formData, "recommendationId"));

  await db
    .update(morningRecommendations)
    .set({ status: "dismissed", decidedAt: new Date() })
    .where(eq(morningRecommendations.id, rec.id));

  revalidatePath("/today");
}
