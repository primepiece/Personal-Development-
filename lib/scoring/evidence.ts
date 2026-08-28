/**
 * Shared evidence-maturity classification. Used by both scoring
 * (lib/scoring) and the signal engine (lib/signals) so "how much do we
 * actually know" means the same thing everywhere in the app, rather than
 * each system inventing its own notion of "enough data."
 *
 * Thresholds are named constants precisely so they can be retuned later
 * without hunting through logic — the same philosophy as the design
 * tokens: refine the number, not the code that uses it.
 */

export type EvidenceMaturity = "baseline" | "assessable" | "trend";

export const MIN_DAYS_ASSESSABLE = 7;
export const MIN_DAYS_TREND = 21;
export const MIN_OBSERVATIONS_ASSESSABLE = 2;
export const MIN_OBSERVATIONS_TREND = 5;

/**
 * `spanDays` — days between the earliest real observation and now.
 * `observationCount` — how many discrete real data points exist.
 * Both gates must clear for a tier — a goal created 30 days ago with one
 * completion is still "baseline," not "trend": time passing alone proves
 * nothing without observations to fill it.
 */
export function classifyMaturity(spanDays: number, observationCount: number): EvidenceMaturity {
  if (observationCount === 0) return "baseline";
  if (spanDays >= MIN_DAYS_TREND && observationCount >= MIN_OBSERVATIONS_TREND) return "trend";
  if (spanDays >= MIN_DAYS_ASSESSABLE && observationCount >= MIN_OBSERVATIONS_ASSESSABLE) {
    return "assessable";
  }
  return "baseline";
}

export function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
