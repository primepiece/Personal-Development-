"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lifeCategories } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { snapshotPillarScore } from "@/lib/scoring/compute";
import { runSignalDetectors } from "@/lib/signals/detect";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

/**
 * The one manual trigger for the whole deterministic intelligence layer:
 * run every signal detector, then snapshot every pillar's score. Nothing
 * recomputes silently on page load — a computation is a deliberate act
 * that leaves a timestamped record, same as everything else in this app.
 */
export async function recomputeAllAction() {
  await requireUser();

  await runSignalDetectors();

  const categories = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.isActive, true));

  for (const category of categories) {
    await snapshotPillarScore(category.id);
  }

  revalidatePath("/");
  revalidatePath("/pillars", "layout");
}
