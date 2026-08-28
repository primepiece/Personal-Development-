import type { ScoreConfidence } from "./compute";

export type TrajectoryState = "establishing_baseline" | "strong" | "mixed" | "off_track";

const POSITIVE_SIGNAL_TYPES = new Set(["consistency_streak", "adherence_improving", "goal_completed"]);
const MIN_ASSESSED_PILLARS = 2;
const OFF_TRACK_WARNING_THRESHOLD = 3;

/**
 * Deliberately not a weighted average of seven pillar scores, and never
 * collapses to a single Prime Score — that decision from M0 stands. This
 * reads the same active signals the pillar/dashboard UI shows, so the
 * state is always traceable back to specific, inspectable evidence
 * rather than a number nobody can explain.
 */
export function computeTrajectoryState(params: {
  pillarConfidences: ScoreConfidence[];
  activeSignals: { type: string; severity: "info" | "warning" | "critical" }[];
}): { state: TrajectoryState; reason: string } {
  const { pillarConfidences, activeSignals } = params;
  const assessedCount = pillarConfidences.filter((c) => c !== "insufficient").length;

  if (assessedCount < MIN_ASSESSED_PILLARS) {
    return {
      state: "establishing_baseline",
      reason: `only ${assessedCount} of ${pillarConfidences.length} pillars have enough evidence to assess yet`,
    };
  }

  const critical = activeSignals.filter((s) => s.severity === "critical");
  const warning = activeSignals.filter((s) => s.severity === "warning");
  const positive = activeSignals.filter(
    (s) => s.severity === "info" && POSITIVE_SIGNAL_TYPES.has(s.type),
  );

  if (critical.length > 0) {
    return { state: "off_track", reason: `${critical.length} critical signal(s) active` };
  }
  if (warning.length === 0) {
    return {
      state: "strong",
      reason: `no active warning or critical signals across ${assessedCount} assessed pillars`,
    };
  }
  if (warning.length >= OFF_TRACK_WARNING_THRESHOLD && positive.length === 0) {
    return {
      state: "off_track",
      reason: `${warning.length} warning signals active with no offsetting positive signal`,
    };
  }
  return { state: "mixed", reason: `${warning.length} warning signal(s) active` };
}
