"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runWeeklyCoachBrief } from "@/lib/coach/run";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

/**
 * Generates a fresh Prime Brief attempt for the given week and persists
 * it — success or failure, always a new row, never an update. Requires
 * a Weekly Review to already exist for that week; the deterministic
 * layer is the foundation Coach reasons over, not something it can
 * substitute for.
 */
export async function generateCoachBriefAction(formData: FormData) {
  await requireUser();
  const weekStartDate = String(formData.get("weekStartDate") ?? "");
  if (!weekStartDate) throw new Error("Missing week start date.");

  await runWeeklyCoachBrief(new Date(`${weekStartDate}T00:00:00`));
  revalidatePath(`/coach/${weekStartDate}`);
}
