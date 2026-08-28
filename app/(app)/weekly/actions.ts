"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weeklyReflectionHistory, weeklyReflections } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { snapshotWeeklyReview } from "@/lib/weekly/compute";

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

/**
 * Generates and persists a fresh snapshot for the given week. Never
 * updates a prior generation — see weekly_reviews' own doc comment.
 * Nothing regenerates silently: this is the one deliberate trigger, same
 * discipline as recomputeAllAction for pillar scores/signals.
 */
export async function generateWeeklyReviewAction(formData: FormData) {
  await requireUser();
  const weekStartDate = str(formData, "weekStartDate");
  if (!weekStartDate) throw new Error("Missing week start date.");

  await snapshotWeeklyReview(new Date(`${weekStartDate}T00:00:00`));
  revalidatePath(`/weekly/${weekStartDate}`);
}

export async function saveWeeklyReflectionAction(formData: FormData) {
  await requireUser();
  const weekStartDate = str(formData, "weekStartDate");
  if (!weekStartDate) throw new Error("Missing week start date.");

  const fields = {
    biggestWin: str(formData, "biggestWin"),
    biggestMistake: str(formData, "biggestMistake"),
    whatLearned: str(formData, "whatLearned"),
    whatToChange: str(formData, "whatToChange"),
  };

  const [existing] = await db
    .select()
    .from(weeklyReflections)
    .where(eq(weeklyReflections.weekStartDate, weekStartDate))
    .limit(1);

  if (existing) {
    await db.insert(weeklyReflectionHistory).values({
      weekStartDate: existing.weekStartDate,
      biggestWin: existing.biggestWin,
      biggestMistake: existing.biggestMistake,
      whatLearned: existing.whatLearned,
      whatToChange: existing.whatToChange,
    });
    await db
      .update(weeklyReflections)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(weeklyReflections.weekStartDate, weekStartDate));
  } else {
    await db.insert(weeklyReflections).values({ weekStartDate, ...fields });
  }

  revalidatePath(`/weekly/${weekStartDate}`);
}
