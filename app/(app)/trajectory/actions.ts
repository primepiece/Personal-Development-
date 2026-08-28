"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, trajectoryCheckpoints, trajectoryMetrics, type metricDirectionEnum } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateVenture } from "@/lib/ventures/find-or-create";

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

export async function createMetricAction(formData: FormData) {
  await requireUser();

  const name = str(formData, "name");
  if (!name) throw new Error("A metric needs a name.");

  const unit = str(formData, "unit");
  if (!unit) throw new Error("A metric needs a unit.");

  const direction = str(formData, "direction") as (typeof metricDirectionEnum.enumValues)[number];
  const linkedGoalIdRaw = str(formData, "linkedGoalId");
  const ventureName = str(formData, "ventureName");
  const targetValueRaw = str(formData, "targetValue");
  const targetDateRaw = str(formData, "targetDate");
  const baselineValueRaw = str(formData, "baselineValue");

  let categoryId = str(formData, "categoryId");
  let linkedGoalId: string | null = null;

  if (linkedGoalIdRaw) {
    const [goal] = await db.select().from(goals).where(eq(goals.id, linkedGoalIdRaw)).limit(1);
    if (!goal) throw new Error("That goal no longer exists.");
    linkedGoalId = goal.id;
    categoryId = goal.categoryId; // the metric belongs to whichever pillar the goal it tracks belongs to
  }

  if (!categoryId) throw new Error("A metric needs a pillar (or a linked goal to derive one from).");

  const ventureId = ventureName ? await findOrCreateVenture(ventureName) : null;

  await db.insert(trajectoryMetrics).values({
    name,
    categoryId,
    ventureId,
    linkedGoalId,
    unit,
    direction,
    targetValue: targetValueRaw ? Number(targetValueRaw) : null,
    targetDate: targetDateRaw || null,
    baselineValue: baselineValueRaw ? Number(baselineValueRaw) : null,
  });

  revalidatePath("/trajectory");
}

export async function addCheckpointAction(formData: FormData) {
  await requireUser();

  const metricId = str(formData, "metricId");
  const valueRaw = str(formData, "value");
  if (!valueRaw) throw new Error("A checkpoint needs a value.");

  const asOfDate = str(formData, "asOfDate");
  const note = str(formData, "note");

  await db.insert(trajectoryCheckpoints).values({
    metricId,
    asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
    value: Number(valueRaw),
    note: note || null,
  });

  revalidatePath("/trajectory");
  revalidatePath("/pillars", "layout");
  revalidatePath("/goals", "layout");
}

export async function retireMetricAction(formData: FormData) {
  await requireUser();

  const metricId = str(formData, "metricId");
  await db.update(trajectoryMetrics).set({ isActive: false }).where(eq(trajectoryMetrics.id, metricId));

  revalidatePath("/trajectory");
}
