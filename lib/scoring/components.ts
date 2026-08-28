import { computeAdherence, type RecurrencePeriod } from "@/lib/behavior/adherence";
import { classifyMaturity, daysBetween, type EvidenceMaturity } from "./evidence";

export type ScoreComponent = {
  key: string;
  label: string;
  value: number | null;
  /** Share of the pillar score this component contributes — null until compute.ts assigns it (0 if excluded). */
  weight: number | null;
  source: string;
  period: { start: string | null; end: string | null; label: string };
  calculation: string;
  maturity: EvidenceMaturity;
  observationCount: number;
  spanDays: number;
  evidenceRefs: { table: string; id: string }[];
};

const BEHAVIOR_PERIODS_CONSIDERED = 5;

/**
 * "Training consistency" — average adherence across the last few
 * *complete* periods (never the in-progress current one, which would
 * unfairly punish a goal for the fact that this week isn't over yet).
 */
export function computeBehaviorAdherenceComponent(params: {
  goal: { id: string; title: string; createdAt: Date };
  recurrence: { period: RecurrencePeriod; targetFrequency: number };
  completions: { id: string; date: string; completed: boolean }[];
  now: Date;
}): ScoreComponent {
  const { goal, recurrence, completions, now } = params;
  const report = computeAdherence(recurrence, goal.createdAt, completions, now);
  const considered = report.history.slice(0, BEHAVIOR_PERIODS_CONSIDERED);

  const observationCount = considered.length;
  const spanDays =
    observationCount > 0
      ? daysBetween(new Date(considered[considered.length - 1].start), now)
      : 0;

  const value =
    observationCount > 0
      ? considered.reduce((sum, p) => sum + Math.min(100, (p.count / p.target) * 100), 0) /
        observationCount
      : null;

  const evidenceRefs: { table: string; id: string }[] = [{ table: "goals", id: goal.id }];
  for (const c of completions) {
    if (!c.completed) continue;
    const inConsidered = considered.some((p) => c.date >= p.start && c.date <= p.end);
    if (inConsidered) evidenceRefs.push({ table: "behavior_completions", id: c.id });
  }

  return {
    key: `behavior_adherence:${goal.id}`,
    label: `Training consistency — ${goal.title}`,
    value: value !== null ? Math.round(value * 10) / 10 : null,
    weight: null,
    source: "behavior_completions",
    period:
      observationCount > 0
        ? {
            start: considered[considered.length - 1].start,
            end: considered[0].end,
            label: `last ${observationCount} complete ${recurrence.period}${observationCount === 1 ? "" : "s"}`,
          }
        : { start: null, end: null, label: "no complete period yet" },
    calculation:
      observationCount > 0
        ? `average of min(100, completions/target×100) across the last ${observationCount} complete ${recurrence.period}s`
        : `no complete ${recurrence.period} has elapsed since this goal was created`,
    maturity: classifyMaturity(spanDays, observationCount),
    observationCount,
    spanDays,
    evidenceRefs,
  };
}

/**
 * Prime Actions completion rate for a pillar over a trailing window —
 * the only honest, general-purpose "how is this pillar going" measure
 * that doesn't require a goal-specific progress metric we don't have.
 */
export function computeActionCompletionComponent(params: {
  categoryId: string;
  categoryName: string;
  actions: { id: string; status: string; date: string }[];
  now: Date;
  windowDays: number;
}): ScoreComponent {
  const { categoryId, categoryName, actions, now, windowDays } = params;
  const observationCount = actions.length;

  const doneCount = actions.filter((a) => a.status === "done").length;
  const value = observationCount > 0 ? (doneCount / observationCount) * 100 : null;

  const dates = actions.map((a) => a.date).sort();
  const spanDays =
    observationCount > 0 ? daysBetween(new Date(dates[0]), now) : 0;

  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - windowDays);

  return {
    key: `action_completion_rate:${categoryId}`,
    label: `Prime Action completion — ${categoryName}`,
    value: value !== null ? Math.round(value * 10) / 10 : null,
    weight: null,
    source: "daily_actions",
    period:
      observationCount > 0
        ? { start: dates[0], end: dates[dates.length - 1], label: `trailing ${windowDays} days` }
        : { start: null, end: null, label: `no Prime Actions in the trailing ${windowDays} days` },
    calculation:
      observationCount > 0
        ? `${doneCount} done / ${observationCount} total Prime Actions in this pillar, trailing ${windowDays} days`
        : `no Prime Actions logged in this pillar in the trailing ${windowDays} days`,
    maturity: classifyMaturity(spanDays, observationCount),
    observationCount,
    spanDays,
    evidenceRefs: actions.map((a) => ({ table: "daily_actions", id: a.id })),
  };
}
