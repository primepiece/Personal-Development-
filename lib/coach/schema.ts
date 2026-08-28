import { z } from "zod";

export const EVIDENCE_TABLES = [
  "weekly_reviews",
  "coach_signals",
  "goals",
  "vision_entries",
  "standards",
  "weekly_reflections",
  "trajectory_metrics",
  "daily_actions",
] as const;

export const evidenceReferenceSchema = z.object({
  refTable: z
    .enum(EVIDENCE_TABLES)
    .describe("Which table this evidence row comes from — must be one of the tables present in the evidence bundle you were given."),
  refId: z.string().uuid().describe("The exact id of a row that was included in the evidence bundle. Never invent an id."),
  note: z.string().min(1).describe("A short (<12 word) label of what this row shows, e.g. 'priority_neglected signal on Business & Wealth'."),
});

export const primeBriefSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe("THE WEEK — 2 to 4 plain sentences on what actually mattered this week. No filler, no motivational framing."),
  progress: z
    .string()
    .min(1)
    .describe(
      "WHAT MOVED — the single most important genuine progress this week, grounded in the evidence bundle. If nothing genuinely moved, say so plainly rather than inventing a positive.",
    ),
  concern: z
    .string()
    .min(1)
    .describe("WHAT'S OFF — the single biggest contradiction, risk, neglect, or trajectory issue this week."),
  contradiction: z
    .string()
    .nullable()
    .describe(
      "A specific stated-intent-vs-actual-behaviour gap, grounded only in what the evidence bundle shows — e.g. a goal marked high priority receiving no action, or a written standard that recent signals contradict, or the same reflection issue recurring without behaviour change. State only the observed fact pattern (dates, counts, what was said vs what happened) — never a psychological explanation the user didn't themselves write. Null if no real contradiction is evidenced this week; do not invent one to fill the field.",
    ),
  recommendation: z
    .string()
    .min(1)
    .describe("THE CALL — the single highest-leverage adjustment to make next week. One clear instruction, not a list."),
  nextWeekPriorities: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe("At most 3 concrete priorities for next week, ordered by leverage — not a restatement of every open item."),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("Overall confidence in this brief given how much real evidence backs it — low if most underlying pillars/goals are still establishing baseline."),
  evidenceReferences: z
    .array(evidenceReferenceSchema)
    .min(1)
    .describe("Every real database row that materially supports a claim above. Reference only ids given in the evidence bundle — never fabricate one."),
});

export type PrimeBrief = z.infer<typeof primeBriefSchema>;
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
