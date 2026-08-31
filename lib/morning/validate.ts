import { validateEvidenceReferences, type ValidationResult } from "@/lib/coach/validate";
import type { AllowedRefs } from "@/lib/coach/types";
import type { MorningBrief } from "./schema";
import type { AllowedPillarIds, WeeklyGoalCategoryById } from "./types";

/**
 * Fail-closed, same rule as Coach: one bad reference anywhere in the
 * brief discards the whole thing, never a partial trust. On top of the
 * shared evidence-reference check, a Morning Brief carries two more
 * claims that have to be checked against reality before it's trusted —
 * a recommendation's pillar and (optional) linked goal — since Accept
 * turns a recommendation directly into a real daily_actions row and that
 * insert only succeeds against a real active pillar and a real active
 * weekly goal.
 */
export function validateMorningBrief(
  brief: MorningBrief,
  allowedRefs: AllowedRefs,
  allowedPillarIds: AllowedPillarIds,
  weeklyGoalCategoryById: WeeklyGoalCategoryById,
): ValidationResult {
  for (const rec of brief.recommendations) {
    const refCheck: ValidationResult = validateEvidenceReferences(rec, allowedRefs);
    if (!refCheck.ok) return refCheck;

    if (!allowedPillarIds.has(rec.categoryId)) {
      return {
        ok: false,
        reason: `recommendation "${rec.title}" cites categoryId ${rec.categoryId}, which is not one of the active pillars in the evidence bundle`,
      };
    }

    if (rec.linkedGoalId) {
      const goalCategoryId = weeklyGoalCategoryById.get(rec.linkedGoalId);
      if (!goalCategoryId) {
        return {
          ok: false,
          reason: `recommendation "${rec.title}" links goalId ${rec.linkedGoalId}, which is not an active weekly goal present in the evidence bundle`,
        };
      }
      if (goalCategoryId !== rec.categoryId) {
        return {
          ok: false,
          reason: `recommendation "${rec.title}" links a goal from a different pillar than its own categoryId`,
        };
      }
    }
  }

  return { ok: true };
}
