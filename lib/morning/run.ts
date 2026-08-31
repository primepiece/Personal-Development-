import { db } from "@/lib/db";
import { morningBriefs, morningRecommendationReferences, morningRecommendations } from "@/db/schema";
import { buildMorningEvidenceBundle } from "./evidence";
import { generateMorningBrief } from "./generate";

/**
 * The one entry point that produces a Morning Brief and persists it —
 * always inserts, always leaves an honest row behind whether generation
 * succeeded or not. On success, one morning_recommendations row per
 * ranked recommendation (plus its evidence references) is inserted from
 * the model's own already-validated output; on any failure, no
 * recommendation rows exist at all, so the UI has no way to accidentally
 * render an untrusted one.
 *
 * Callers are responsible for only calling this once per calendar day —
 * see lib/morning/query.ts's getLatestMorningBrief, which the Today page
 * checks first so a refresh never triggers a second attempt.
 */
export async function runMorningBrief(dateKey: string, now: Date = new Date()) {
  const { bundle, allowedRefs, allowedPillarIds, weeklyGoalCategoryById } = await buildMorningEvidenceBundle(
    dateKey,
    now,
  );
  const result = await generateMorningBrief(bundle, allowedRefs, allowedPillarIds, weeklyGoalCategoryById);

  if (!result.ok) {
    const [row] = await db
      .insert(morningBriefs)
      .values({
        date: dateKey,
        model: result.model,
        status: "failed",
        failureReason: result.reason,
        evidenceBundle: bundle,
      })
      .returning();
    return { brief: row, recommendations: [] };
  }

  const [briefRow] = await db
    .insert(morningBriefs)
    .values({
      date: dateKey,
      model: result.model,
      status: "ok",
      evidenceBundle: bundle,
    })
    .returning();

  const recommendations = [];
  for (const [i, rec] of result.brief.recommendations.entries()) {
    const [recRow] = await db
      .insert(morningRecommendations)
      .values({
        briefId: briefRow.id,
        rank: i + 1,
        categoryId: rec.categoryId,
        linkedGoalId: rec.linkedGoalId,
        title: rec.title,
        reason: rec.reason,
      })
      .returning();

    await db.insert(morningRecommendationReferences).values(
      rec.evidenceReferences.map((ref) => ({
        recommendationId: recRow.id,
        refTable: ref.refTable,
        refId: ref.refId,
        note: ref.note,
      })),
    );

    recommendations.push(recRow);
  }

  return { brief: briefRow, recommendations };
}
