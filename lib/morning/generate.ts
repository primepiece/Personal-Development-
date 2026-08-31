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

/**
 * Server-side only — never sends anything to the browser. Logs enough to
 * tell the 5 known failure shapes apart (empty response, truncation,
 * refusal, no parseable text block, malformed/schema-invalid JSON)
 * without ever including the API key, other env values, or the full
 * evidence bundle. `snippet` is capped and is model-generated text, not
 * a secret — safe to log for diagnosing what actually came back.
 */
function logDiagnostic(category: string, details: Record<string, unknown>) {
  console.error(`[morning-brief] ${category}`, details);
}

export type GenerateResult =
  | { ok: true; brief: MorningBrief; model: string }
  | { ok: false; reason: string; model: string };

/**
 * The one place the model gets called for a Morning Brief. Every failure
 * path returns `ok: false` with a reason and nothing else — no partial
 * brief, no best-effort fallback. The caller persists the failure as an
 * audit row and never renders it as trusted recommendations.
 *
 * Uses `messages.create()` directly rather than the SDK's `.parse()`
 * convenience wrapper: `.parse()` discards the raw `Message` (stop_reason,
 * usage, content blocks) the moment its own internal JSON.parse or zod
 * validation fails, collapsing every distinct failure mode into the same
 * generic "Failed to parse structured output... Unexpected end of JSON
 * input" — which is exactly what made an empty/truncated response
 * indistinguishable from a genuinely malformed one. Calling `.create()`
 * keeps the full response available so each case below can be told apart
 * and logged accordingly; `zodOutputFormat(...).parse()` is still reused
 * for the actual JSON+schema parsing, just called explicitly instead of
 * implicitly.
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

  const outputFormat = zodOutputFormat(morningBriefSchema);

  let response;
  try {
    response = await client.messages.create({
      model: MORNING_MODEL,
      // Higher than a single-paragraph brief needs on its own: adaptive
      // thinking draws from the same budget, and 3 full recommendation
      // objects (each with its own evidence references) run heavier than
      // this schema's word limits alone suggest.
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: outputFormat },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(bundle) }],
    });
  } catch (err) {
    logDiagnostic("api_call_failed", { message: describeError(err) });
    return { ok: false, reason: `model call failed: ${describeError(err)}`, model: MORNING_MODEL };
  }

  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };

  if (response.stop_reason === "refusal") {
    logDiagnostic("refusal", { category: response.stop_details?.category ?? "unspecified", usage });
    return {
      ok: false,
      reason: `model refused: ${response.stop_details?.category ?? "unspecified category"}`,
      model: MORNING_MODEL,
    };
  }

  if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
    logDiagnostic("truncated", { stopReason: response.stop_reason, usage });
    return {
      ok: false,
      reason: `model response was cut off before finishing (stop_reason: ${response.stop_reason}, ${usage.outputTokens} output tokens used) — the response was truncated, not malformed`,
      model: MORNING_MODEL,
    };
  }

  const textBlocks = response.content.filter((block) => block.type === "text");
  if (textBlocks.length === 0) {
    logDiagnostic("no_text_block", {
      stopReason: response.stop_reason,
      contentBlockTypes: response.content.map((b) => b.type),
      usage,
    });
    return {
      ok: false,
      reason: `model response contained no text content block to parse (stop_reason: ${response.stop_reason}, block types: ${response.content.map((b) => b.type).join(", ") || "none"})`,
      model: MORNING_MODEL,
    };
  }

  const rawText = textBlocks[0].text;
  if (!rawText || rawText.trim().length === 0) {
    logDiagnostic("empty_response", { stopReason: response.stop_reason, usage });
    return {
      ok: false,
      reason: `model returned an empty text response (stop_reason: ${response.stop_reason}, ${usage.outputTokens} output tokens used)`,
      model: MORNING_MODEL,
    };
  }

  let brief: MorningBrief;
  try {
    brief = outputFormat.parse(rawText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isJsonSyntaxError = message.includes("as JSON");
    logDiagnostic(isJsonSyntaxError ? "malformed_json" : "schema_validation_failed", {
      message,
      snippetLength: rawText.length,
      snippet: rawText.slice(0, 500),
    });
    return { ok: false, reason: `structured output parsing failed: ${message}`, model: MORNING_MODEL };
  }

  const validation = validateMorningBrief(brief, allowedRefs, allowedPillarIds, weeklyGoalCategoryById);
  if (!validation.ok) {
    logDiagnostic("evidence_validation_failed", { reason: validation.reason });
    return { ok: false, reason: validation.reason, model: MORNING_MODEL };
  }

  return { ok: true, brief, model: MORNING_MODEL };
}
