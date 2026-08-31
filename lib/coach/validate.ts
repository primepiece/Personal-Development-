import type { AllowedRefs } from "./types";
import type { EvidenceReference } from "./schema";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * The trust boundary between "the model said something" and "Prime
 * James will store and display it." A model output is only ever as
 * trustworthy as its evidence references — this checks every one of them
 * against the exact id/table whitelist built while assembling the
 * evidence bundle, not against the database directly, so it can't be
 * fooled by a real id from the wrong table or a stale id no longer in
 * scope for this generation. One bad reference invalidates the whole
 * output; there is no partial trust.
 *
 * Typed against the minimal shape rather than PrimeBrief specifically —
 * lib/morning/validate.ts reuses this same check for Morning Brief
 * recommendations rather than re-implementing it.
 */
export function validateEvidenceReferences(
  output: { evidenceReferences: EvidenceReference[] },
  allowedRefs: AllowedRefs,
): ValidationResult {
  if (output.evidenceReferences.length === 0) {
    return { ok: false, reason: "brief carries zero evidence references — every major claim must be backed by at least one" };
  }
  for (const ref of output.evidenceReferences) {
    const actualTable = allowedRefs.get(ref.refId);
    if (!actualTable) {
      return {
        ok: false,
        reason: `evidence reference ${ref.refTable}/${ref.refId} does not match any id supplied in the evidence bundle — not a hallucination the app will trust`,
      };
    }
    if (actualTable !== ref.refTable) {
      return {
        ok: false,
        reason: `evidence reference ${ref.refId} was claimed as "${ref.refTable}" but the bundle supplied it as "${actualTable}"`,
      };
    }
  }
  return { ok: true };
}
