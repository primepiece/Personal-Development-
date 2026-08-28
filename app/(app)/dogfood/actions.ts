"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { dogfoodLog, type dogfoodCategoryEnum } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

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

/** The only write path — a plain append. No status, no edit, no auto-triage. */
export async function addDogfoodEntryAction(formData: FormData) {
  await requireUser();

  const category = str(formData, "category") as (typeof dogfoodCategoryEnum.enumValues)[number];
  const note = str(formData, "note");
  const context = str(formData, "context");
  if (!note) throw new Error("Write what happened before saving.");

  await db.insert(dogfoodLog).values({ category, note, context: context || null });
  revalidatePath("/dogfood");
}
