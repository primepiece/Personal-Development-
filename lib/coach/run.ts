import { db } from "@/lib/db";
import { coachBriefReferences, coachBriefs } from "@/db/schema";
import { buildCoachEvidenceBundle } from "./evidence";
import { generatePrimeBrief } from "./generate";

/**
 * The one entry point that produces a Prime Brief and persists it —
 * always inserts, always leaves an honest row behind whether the
 * generation succeeded or not. On success, coach_brief_references is
 * populated from the model's own (already-validated) evidence list; on
 * any failure, the narrative fields stay null and status='failed' so
 * the UI has no way to accidentally render untrusted output.
 */
export async function runWeeklyCoachBrief(weekStart: Date) {
  const { bundle, allowedRefs, weeklyReviewId } = await buildCoachEvidenceBundle(weekStart);
  const result = await generatePrimeBrief(bundle, allowedRefs);

  if (!result.ok) {
    const [row] = await db
      .insert(coachBriefs)
      .values({
        weekStartDate: bundle.weekStartDate,
        weeklyReviewId,
        model: result.model,
        status: "failed",
        failureReason: result.reason,
        evidenceBundle: bundle,
      })
      .returning();
    return row;
  }

  const { brief } = result;
  const [row] = await db
    .insert(coachBriefs)
    .values({
      weekStartDate: bundle.weekStartDate,
      weeklyReviewId,
      model: result.model,
      status: "ok",
      evidenceBundle: bundle,
      summary: brief.summary,
      progress: brief.progress,
      concern: brief.concern,
      contradiction: brief.contradiction,
      recommendation: brief.recommendation,
      nextWeekPriorities: brief.nextWeekPriorities,
      confidence: brief.confidence,
    })
    .returning();

  await db.insert(coachBriefReferences).values(
    brief.evidenceReferences.map((ref) => ({
      briefId: row.id,
      refTable: ref.refTable,
      refId: ref.refId,
      note: ref.note,
    })),
  );

  return row;
}
