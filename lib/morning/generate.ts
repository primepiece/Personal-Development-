import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { morningBriefSchema, type MorningBrief } from "./schema";
import { validateMorningBrief } from "./validate";
import type { AllowedPillarIds, MorningEvidenceBundle, WeeklyGoalCategoryById } from "./types";
import type { AllowedRefs } from "@/lib/coach/types";

export const MORNING_MODEL = "claude-opus-5";

/**
 * Same discipline as Prime Coach's system prompt, adapted for a shorter,
 * more directive morning-planning voice — this is not Coach's weekly
 * narrative register, it's "what do I actually do today."
 */
const SYSTEM_PROMPT = `You are Morning Mentor, the part of Prime James that helps its one user decide what to work on today, using only their own real data.

VOICE
- Terse and specific. Each recommendation is one concrete action plus a short reason — not a paragraph.
- No motivational language, no "you've got this," no filler.

GROUNDING — NON-NEGOTIABLE
- Every recommendation and every reason must come from the evidence bundle you were given. Never invent a task, a business fact, a deadline, a meeting, a client name, or any circumstance not present in the data.
- If the evidence supports "this pillar needs attention" but does not contain a specific enough task to name, say that honestly in the title rather than inventing specifics. Example: a pillar with a real priority-3 goal but no evidence of what today's concrete task should be gets a title like "Choose the highest-value business action available today" with a reason naming the goal and its priority — not a fabricated task.
- Every id you cite in evidenceReferences must be an id that was actually present in the bundle you were given. It is checked programmatically against the exact set of ids you were handed; a wrong or misattributed reference discards the entire brief.

RANKING
When choosing which 3 things matter most today, weigh in this order:
1. strategic importance / goal priority
2. deadline risk
3. current weekly priorities (already ranked and included in the bundle)
4. recurring commitments currently due or behind
5. repeated neglect or unresolved signals
6. trajectory gaps
7. recent activity — do not repeatedly recommend something already done recently or already sitting on today's list; prefer what's been neglected over what's already been acted on

Do not try to represent every pillar. If one pillar genuinely deserves 2 of the 3 recommendations, give it 2. Never pad a weak pillar into a slot it hasn't earned just for variety.

COLD START
If there is very little history yet (few or no recent Prime Actions, few or no signals), rely more heavily on active goal priority, target dates, recurring commitments, and weekly priorities — and make the reason honest about the evidence being thin rather than acting as if there's a rich history behind it.

OUTPUT
Return exactly 3 recommendations as specified by the schema, ordered most important first.`;

function buildUserContent(bundle: MorningEvidenceBundle): string {
  return [
    "Here is today's full evidence bundle, as JSON. Every id inside it is a real database row you may cite as evidence — under pillars (goals, standards), weeklyPriorities (coach_signals, trajectory_metrics), and unresolvedSignals (coach_signals). Do not cite any id that is not present somewhere in this JSON. Every pillar's categoryId, and every weekly-tier goal's id, are also real — recommendations must use ids literally present here.",
    "",
    JSON.stringify(bundle, null, 2),
    "",
    "Produce today's Morning Brief: exactly 3 recommendations.",
  ].join("\n");
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return `authentication failed: ${err.message}`;
  if (err instanceof Anthropic.RateLimitError) return `rate limited: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

export type GenerateResult =
  | { ok: true; brief: MorningBrief; model: string }
  | { ok: false; reason: string; model: string };

/**
 * The one place the model gets called for a Morning Brief. Every failure
 * path returns `ok: false` with a reason and nothing else — no partial
 * brief, no best-effort fallback. The caller persists the failure as an
 * audit row and never renders it as trusted recommendations.
 */
export async function generateMorningBrief(
  bundle: MorningEvidenceBundle,
  allowedRefs: AllowedRefs,
  allowedPillarIds: AllowedPillarIds,
  weeklyGoalCategoryById: WeeklyGoalCategoryById,
): Promise<GenerateResult> {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch (err) {
    return { ok: false, reason: `client init failed: ${describeError(err)}`, model: MORNING_MODEL };
  }

  let response;
  try {
    response = await client.messages.parse({
      model: MORNING_MODEL,
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(morningBriefSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(bundle) }],
    });
  } catch (err) {
    return { ok: false, reason: `model call failed: ${describeError(err)}`, model: MORNING_MODEL };
  }

  if (response.stop_reason === "refusal") {
    return {
      ok: false,
      reason: `model refused: ${response.stop_details?.category ?? "unspecified category"}`,
      model: MORNING_MODEL,
    };
  }

  if (!response.parsed_output) {
    return { ok: false, reason: "model output did not validate against the Morning Brief schema", model: MORNING_MODEL };
  }

  const brief = response.parsed_output;
  const validation = validateMorningBrief(brief, allowedRefs, allowedPillarIds, weeklyGoalCategoryById);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, model: MORNING_MODEL };
  }

  return { ok: true, brief, model: MORNING_MODEL };
}
