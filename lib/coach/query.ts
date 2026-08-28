import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { coachBriefReferences, coachBriefs } from "@/db/schema";

export async function getLatestCoachBrief(weekStartKey: string) {
  const [row] = await db
    .select()
    .from(coachBriefs)
    .where(eq(coachBriefs.weekStartDate, weekStartKey))
    .orderBy(desc(coachBriefs.generatedAt))
    .limit(1);
  return row;
}

export async function getCoachBriefAttempts(weekStartKey: string) {
  return db
    .select({ id: coachBriefs.id, generatedAt: coachBriefs.generatedAt, status: coachBriefs.status, failureReason: coachBriefs.failureReason, model: coachBriefs.model })
    .from(coachBriefs)
    .where(eq(coachBriefs.weekStartDate, weekStartKey))
    .orderBy(desc(coachBriefs.generatedAt));
}

export async function getCoachBriefReferences(briefId: string) {
  return db.select().from(coachBriefReferences).where(eq(coachBriefReferences.briefId, briefId));
}
