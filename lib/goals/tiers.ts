export const GOAL_TIERS = [
  "milestone",
  "annual",
  "quarterly",
  "monthly",
  "weekly",
] as const;

export type GoalTier = (typeof GOAL_TIERS)[number];

export const TIER_LABEL: Record<GoalTier, string> = {
  milestone: "Milestone",
  annual: "Annual",
  quarterly: "Quarterly",
  monthly: "Monthly",
  weekly: "Weekly",
};

/** The tier a goal's parent must be in — null for milestone, the root tier. */
export function requiredParentTier(tier: GoalTier): GoalTier | null {
  const index = GOAL_TIERS.indexOf(tier);
  return index <= 0 ? null : GOAL_TIERS[index - 1];
}
