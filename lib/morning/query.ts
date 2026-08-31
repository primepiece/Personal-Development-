import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { morningBriefs, morningRecommendationReferences, morningRecommendations } from "@/db/schema";

/** At most one generation attempt is expected per date — see run.ts — but this always reads the latest if more than one somehow exists. */
export async function getLatestMorningBrief(dateKey: string) {
  const [row] = await db
    .select()
    .from(morningBriefs)
    .where(eq(morningBriefs.date, dateKey))
    .orderBy(desc(morningBriefs.generatedAt))
    .limit(1);
  return row;
}

export async function getMorningRecommendations(briefId: string) {
  return db
    .select()
    .from(morningRecommendations)
    .where(eq(morningRecommendations.briefId, briefId))
    .orderBy(morningRecommendations.rank);
}

export async function getMorningRecommendationReferences(recommendationIds: string[]) {
  if (recommendationIds.length === 0) return [];
  return db
    .select()
    .from(morningRecommendationReferences)
    .where(inArray(morningRecommendationReferences.recommendationId, recommendationIds));
}
