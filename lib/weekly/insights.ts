import type { WeeklyReviewSnapshot } from "./types";

const MEANINGFUL_ACTIVITY_DAYS = 4;
const MAX_INSIGHTS = 10;

/**
 * Every sentence here is a direct restatement of a number already
 * computed elsewhere in the snapshot — no new inference, no judgment
 * about what it means. "4/5 Prime Actions completed" is a fact; "you
 * lacked discipline this week" is a narrative, and narrative is Prime
 * Coach's job once it exists, not this deterministic layer's.
 */
export function buildWeeklyInsights(s: Omit<WeeklyReviewSnapshot, "insights" | "priorities">): string[] {
  const lines: string[] = [];

  if (s.primeActions.total > 0) {
    lines.push(
      `${s.primeActions.done}/${s.primeActions.total} Prime Actions completed (${Math.round(s.primeActions.completionRate ?? 0)}%).`,
    );
  }

  for (const pillar of s.pillars) {
    if (pillar.activityDays === 0) {
      lines.push(`${pillar.categoryName} received no logged activity this week.`);
    } else if (pillar.activityDays >= MEANINGFUL_ACTIVITY_DAYS) {
      lines.push(`${pillar.categoryName} received meaningful activity on ${pillar.activityDays} of 7 days.`);
    }
  }

  for (const metric of s.trajectoryMetrics) {
    if (metric.status === "behind_pace") {
      lines.push(`${metric.name} remains behind required pace.`);
    } else if (metric.status === "ahead_pace") {
      lines.push(`${metric.name} is ahead of required pace.`);
    }
  }

  for (const signal of s.signals.highImportanceActive) {
    lines.push(`${signal.categoryName} has an unresolved high-importance ${signal.type.replace(/_/g, " ")} signal.`);
  }

  for (const rb of s.recurringBehaviours) {
    if (rb.trend === "improving") {
      lines.push(`"${rb.goalTitle}" adherence is improving (${rb.maturity}-level evidence).`);
    } else if (rb.trend === "declining") {
      lines.push(`"${rb.goalTitle}" adherence is declining (${rb.maturity}-level evidence).`);
    }
  }

  if (s.goals.completed.length > 0) {
    const titles = s.goals.completed.slice(0, 3).map((g) => `"${g.title}"`).join(", ");
    lines.push(
      s.goals.completed.length <= 3
        ? `${s.goals.completed.length} goal(s) completed this week: ${titles}.`
        : `${s.goals.completed.length} goals completed this week, including ${titles}.`,
    );
  }

  if (s.dailyReviews.completedCount > 0) {
    lines.push(`${s.dailyReviews.completedCount}/${s.dailyReviews.possibleDays} daily reviews logged this week.`);
  }

  return lines.slice(0, MAX_INSIGHTS);
}
