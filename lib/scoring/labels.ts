type SignalRow = { type: string; evidence: unknown };

export const SIGNAL_TYPE_LABEL: Record<string, string> = {
  priority_neglected: "Priority neglected",
  deadline_at_risk: "Deadline at risk",
  adherence_declining: "Adherence declining",
  adherence_improving: "Adherence improving",
  consistency_streak: "Consistency streak",
  pillar_neglected: "Pillar neglected",
  action_completion_falling: "Action completion falling",
  goal_completed: "Goal completed",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  insufficient: "Insufficient data",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const TRAJECTORY_LABEL: Record<string, string> = {
  establishing_baseline: "Establishing Baseline",
  strong: "Strong",
  mixed: "Mixed",
  off_track: "Off Track",
};

/** Plain, factual sentence built straight from the signal's own evidence — no narration, no model call. */
export function describeSignal(signal: SignalRow): string {
  const e = signal.evidence as Record<string, unknown>;
  switch (signal.type) {
    case "priority_neglected":
      return `"${e.goalTitle}" (priority ${e.priority}) has had no action in ${e.daysSinceTouch} days`;
    case "deadline_at_risk": {
      const days = e.daysUntil as number;
      return days < 0
        ? `"${e.goalTitle}" was due ${Math.abs(days)} day(s) ago and is still active`
        : `"${e.goalTitle}" is due in ${days} day(s) and is still active`;
    }
    case "adherence_declining":
      return `"${e.goalTitle}" adherence dropped to ${e.recentRate}% from a ${e.priorAvg}% average`;
    case "adherence_improving":
      return `"${e.goalTitle}" adherence rose to ${e.recentRate}% from a ${e.priorAvg}% average`;
    case "consistency_streak":
      return `"${e.goalTitle}" has met target for ${e.streak} consecutive ${e.period}s`;
    case "pillar_neglected":
      return `${e.categoryName} has had no completed action in ${e.daysSinceTouch} days`;
    case "action_completion_falling":
      return `${e.categoryName} Prime Action completion fell to ${e.recentRate}% from ${e.priorRate}%`;
    case "goal_completed":
      return `"${e.goalTitle}" was marked done`;
    default:
      return JSON.stringify(e);
  }
}
