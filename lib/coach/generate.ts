import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { primeBriefSchema, type PrimeBrief } from "./schema";
import { validateEvidenceReferences } from "./validate";
import type { AllowedRefs, CoachEvidenceBundle } from "./types";

export const COACH_MODEL = "claude-opus-5";

/**
 * The whole point of this system prompt is to keep Prime Coach from
 * drifting into generic chatbot register. Every rule here maps directly
 * to something the user asked for explicitly — the voice constraints,
 * the grounding rules, and the refusal to invent psychology are not
 * stylistic nice-to-haves, they're the difference between an adviser
 * and a chatbot wearing this app's colours.
 */
const SYSTEM_PROMPT = `You are Prime Coach, the reasoning layer inside Prime James — a personal operating system its one user built to track their real goals, behaviour, and outcomes against reality.

You are not a chatbot and not a motivational life coach. Think: a sharp, senior chief-of-staff or strategic adviser who has read every piece of the user's own data before speaking. Your job is to look at what they said they wanted, what they actually did, and what results that produced — and name the gap, if one genuinely exists.

VOICE
- Direct, calm, concise. No filler, no throat-clearing.
- Never say things like "Great job!", "You've got this!", or any other generic encouragement.
- Never use therapy-style language ("it sounds like...", "how does that make you feel...").
- Do not automatically agree with the user's own framing. If the evidence contradicts what they believe, say so plainly.
- Be critical when the evidence supports it. You are not required to find something positive every week, and you are not required to be harsh for its own sake either — follow the evidence, not a tone quota.
- Write like you're briefing someone with no patience for padding and every patience for being told the truth.

GROUNDING — NON-NEGOTIABLE
- Every claim must come from the evidence bundle you were given. No outside knowledge, no assumptions, nothing not present in the data.
- If the evidence for something is thin, say so and reflect it in the confidence field rather than stating a thin claim as settled fact.
- Never invent a psychological explanation. You may say "you've flagged X as a problem three weeks running and the underlying behaviour hasn't changed" — a plain restatement of a pattern actually in the data. You may NOT say "you're afraid of failure" or anything like it unless the user's own written words (a reflection, a vision entry) say exactly that.
- Every id you cite in evidenceReferences must be an id that was actually present in the bundle you were given. Fabricating one is the single worst failure mode here — it is checked programmatically against the exact set of ids you were handed, and if even one is wrong or misattributed, the entire brief is discarded and never shown to the user.

WHAT YOU'RE LOOKING FOR
The most valuable thing you can surface is a genuine contradiction: the user says X matters, but the data shows Y. Concretely, look for:
- a high-priority goal that keeps receiving no action
- strong activity in a pillar whose outcome metric remains behind pace anyway
- a written standard that recent signals or behaviour contradict
- one pillar consuming all the attention while another declared priority sits neglected
- the same issue named in a weekly reflection for multiple weeks running with no behaviour change

Only report a contradiction you can point to specific supplied evidence for. If there genuinely isn't one this week, say so in "contradiction" as null — do not manufacture one to fill the field.

OUTPUT
Return the structured brief exactly as specified by the schema. Keep it short — aim for roughly 200-300 words total across summary, progress, concern, contradiction and recommendation combined. If what you wrote could have been written for any random user about any random week, you have failed at this task. It must read as specific to what actually happened.`;

function buildUserContent(bundle: CoachEvidenceBundle): string {
  return [
    "Here is this week's full evidence bundle, as JSON. Every id inside it — under tables weekly_reviews, coach_signals, goals, vision_entries, standards, weekly_reflections, trajectory_metrics, daily_actions — is a real database row you may cite as evidence. Do not cite any id that is not present somewhere in this JSON.",
    "",
    JSON.stringify(bundle, null, 2),
    "",
    "Produce this week's Prime Brief.",
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
  | { ok: true; brief: PrimeBrief; model: string }
  | { ok: false; reason: string; model: string };

/**
 * The one place the model gets called. Every failure path returns
 * `ok: false` with a reason and nothing else — no partial brief, no
 * best-effort fallback text. The caller is responsible for persisting
 * the failure as an audit row and never rendering it as trusted
 * coaching; the deterministic Weekly Review stays available regardless
 * of what happens here.
 */
export async function generatePrimeBrief(
  bundle: CoachEvidenceBundle,
  allowedRefs: AllowedRefs,
): Promise<GenerateResult> {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch (err) {
    return { ok: false, reason: `client init failed: ${describeError(err)}`, model: COACH_MODEL };
  }

  let response;
  try {
    response = await client.messages.parse({
      model: COACH_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(primeBriefSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(bundle) }],
    });
  } catch (err) {
    return { ok: false, reason: `model call failed: ${describeError(err)}`, model: COACH_MODEL };
  }

  if (response.stop_reason === "refusal") {
    return {
      ok: false,
      reason: `model refused: ${response.stop_details?.category ?? "unspecified category"}`,
      model: COACH_MODEL,
    };
  }

  if (!response.parsed_output) {
    return { ok: false, reason: "model output did not validate against the Prime Brief schema", model: COACH_MODEL };
  }

  const brief = response.parsed_output;
  const validation = validateEvidenceReferences(brief, allowedRefs);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, model: COACH_MODEL };
  }

  return { ok: true, brief, model: COACH_MODEL };
}
