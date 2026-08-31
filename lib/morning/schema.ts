import { z } from "zod";
import { evidenceReferenceSchema } from "@/lib/coach/schema";

export const morningRecommendationSchema = z.object({
  categoryId: z
    .string()
    .uuid()
    .describe("The id of the pillar (life_categories row) this recommendation belongs to — must be one of the active pillars given in the evidence bundle."),
  linkedGoalId: z
    .string()
    .uuid()
    .nullable()
    .describe(
      "The id of an existing ACTIVE WEEKLY-tier goal from the evidence bundle that this action would count toward, if one genuinely fits. Null if there's no matching weekly goal — do not force a link that doesn't really fit just to fill the field.",
    ),
  title: z
    .string()
    .min(1)
    .max(140)
    .describe(
      "The specific Prime Action to take today, written as an instruction ('Draft the Q3 pricing proposal', not 'work on pricing'). If the evidence doesn't support a specific task, say so honestly instead of inventing one — e.g. 'Choose the highest-value business action available today' — that is a valid, preferred answer over a fabricated specific.",
    ),
  reason: z
    .string()
    .min(1)
    .max(280)
    .describe("One or two plain sentences, grounded only in the evidence bundle, on why this matters today specifically."),
  evidenceReferences: z
    .array(evidenceReferenceSchema)
    .min(1)
    .describe("Every real database row from the evidence bundle that supports this recommendation. Never fabricate an id."),
});

export const morningBriefSchema = z.object({
  recommendations: z
    .array(morningRecommendationSchema)
    .length(3)
    .describe("Exactly 3 recommendations, ordered most important first. They do not need to cover 3 different pillars — if one pillar genuinely deserves 2 of the 3, that's correct."),
});

export type MorningRecommendation = z.infer<typeof morningRecommendationSchema>;
export type MorningBrief = z.infer<typeof morningBriefSchema>;
