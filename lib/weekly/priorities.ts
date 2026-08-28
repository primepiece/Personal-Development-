import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { coachSignals, lifeCategories, trajectoryCheckpoints, trajectoryMetrics } from "@/db/schema";
import { describeSignal } from "@/lib/scoring/labels";
import { computeMetricTrajectory, type MetricDirection } from "@/lib/trajectory/compute";
import type { PriorityFactor, PriorityItem } from "./types";

const MAX_PRIORITIES = 3;

type Candidate = {
  kind: "signal" | "metric";
  label: string;
  categoryName: string;
  factors: PriorityFactor[];
  refs: { table: string; id: string }[];
};

/**
 * Forward-looking, unlike the rest of the weekly snapshot: "what should I
 * act on going into next week" is answered from *current* live state at
 * generation time, not frozen as-of the reviewed week — there is no
 * value in recommending next steps against a week-old picture. Once
 * generated it's still frozen into the snapshot like everything else, so
 * re-inspecting an old review later shows exactly what was recommended
 * then, even if the situation has since changed.
 *
 * Every factor below is a small named integer with an explanation string
 * attached, and the full breakdown ships in the snapshot — "inspectable"
 * means you can always see why something outranked something else, never
 * just a single opaque number, and never a plain sort by severity alone.
 */
export async function computeWeeklyPriorities(now: Date = new Date()): Promise<PriorityItem[]> {
  const candidates: Candidate[] = [];

  const activeSignals = await db
    .select({
      id: coachSignals.id,
      type: coachSignals.type,
      severity: coachSignals.severity,
      importance: coachSignals.importance,
      categoryId: coachSignals.categoryId,
      categoryName: lifeCategories.name,
      goalId: coachSignals.goalId,
      evidence: coachSignals.evidence,
    })
    .from(coachSignals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, coachSignals.categoryId))
    .where(and(inArray(coachSignals.status, ["new", "active", "acknowledged"]), inArray(coachSignals.severity, ["warning", "critical"])));

  for (const signal of activeSignals) {
    const factors: PriorityFactor[] = [];

    factors.push({
      name: "severity",
      points: signal.severity === "critical" ? 30 : 15,
      detail: `severity: ${signal.severity}`,
    });

    factors.push({
      name: "importance",
      points: signal.importance * 5,
      detail: `strategic importance ${signal.importance}/5`,
    });

    if (signal.type === "deadline_at_risk") {
      const daysUntil = (signal.evidence as Record<string, unknown>).daysUntil as number | undefined;
      let points = 0;
      let detail = "no deadline data";
      if (typeof daysUntil === "number") {
        if (daysUntil < 0) {
          points = 20;
          detail = `overdue by ${Math.abs(daysUntil)} day(s)`;
        } else if (daysUntil <= 3) {
          points = 15;
          detail = `due in ${daysUntil} day(s)`;
        } else if (daysUntil <= 7) {
          points = 8;
          detail = `due in ${daysUntil} day(s)`;
        } else if (daysUntil <= 14) {
          points = 3;
          detail = `due in ${daysUntil} day(s)`;
        } else {
          detail = `due in ${daysUntil} day(s) — outside the near-term window`;
        }
      }
      factors.push({ name: "deadline risk", points, detail });
    } else {
      factors.push({ name: "deadline risk", points: 0, detail: "not a deadline-type signal" });
    }

    const goalMatch = signal.goalId ? eq(coachSignals.goalId, signal.goalId) : eq(coachSignals.categoryId, signal.categoryId);
    const priorMatches = await db
      .select({ status: coachSignals.status })
      .from(coachSignals)
      .where(and(eq(coachSignals.type, signal.type), eq(coachSignals.categoryId, signal.categoryId), goalMatch));
    const recurrenceCount = priorMatches.filter((s) => s.status === "resolved").length;
    factors.push({
      name: "repeated neglect",
      points: Math.min(recurrenceCount, 5) * 4,
      detail: recurrenceCount > 0 ? `recurred ${recurrenceCount}x before, each time resolved and returned` : "first occurrence — no prior history",
    });

    factors.push({
      name: "evidence maturity",
      points: 0,
      detail: "n/a for signals — a detector only fires once its own evidence threshold is already met",
    });

    candidates.push({
      kind: "signal",
      label: describeSignal(signal),
      categoryName: signal.categoryName,
      factors,
      refs: [{ table: "coach_signals", id: signal.id }],
    });
  }

  const metrics = await db
    .select({
      id: trajectoryMetrics.id,
      name: trajectoryMetrics.name,
      categoryName: lifeCategories.name,
      direction: trajectoryMetrics.direction,
      targetValue: trajectoryMetrics.targetValue,
      targetDate: trajectoryMetrics.targetDate,
      linkedGoalId: trajectoryMetrics.linkedGoalId,
    })
    .from(trajectoryMetrics)
    .innerJoin(lifeCategories, eq(lifeCategories.id, trajectoryMetrics.categoryId))
    .where(eq(trajectoryMetrics.isActive, true));

  for (const metric of metrics) {
    const checkpoints = await db
      .select()
      .from(trajectoryCheckpoints)
      .where(eq(trajectoryCheckpoints.metricId, metric.id));
    const trajectory = computeMetricTrajectory(
      { direction: metric.direction as MetricDirection, targetValue: metric.targetValue, targetDate: metric.targetDate },
      checkpoints,
      now,
    );
    if (trajectory.pace?.status !== "behind_pace" || !trajectory.pace.requiredMonthlyChange) continue;

    const sign = metric.direction === "higher_is_better" ? 1 : -1;
    const requiredRate = sign * trajectory.pace.requiredMonthlyChange;
    const observedRate = sign * trajectory.pace.observedMonthlyChange;
    const pctBehind = requiredRate !== 0 ? ((requiredRate - observedRate) / Math.abs(requiredRate)) * 100 : 0;

    const factors: PriorityFactor[] = [
      { name: "severity", points: 0, detail: "metrics don't carry a severity axis — see trajectory gap instead" },
      { name: "importance", points: metric.linkedGoalId ? 15 : 8, detail: metric.linkedGoalId ? "linked to a named outcome goal" : "tracked metric, not linked to a specific goal" },
      { name: "deadline risk", points: 0, detail: "not a deadline-type signal" },
      { name: "repeated neglect", points: 0, detail: "n/a for metrics" },
      {
        name: "trajectory gap",
        points: pctBehind >= 50 ? 20 : pctBehind >= 20 ? 10 : 5,
        detail: `${Math.round(pctBehind)}% below the pace required to hit target`,
      },
      {
        name: "evidence maturity",
        points: trajectory.maturity === "trend" ? 5 : 0,
        detail: `${trajectory.maturity} maturity`,
      },
    ];

    candidates.push({
      kind: "metric",
      label: `${metric.name} — ${trajectory.statusLabel.toLowerCase()}`,
      categoryName: metric.categoryName,
      factors,
      refs: [{ table: "trajectory_metrics", id: metric.id }],
    });
  }

  const scored = candidates
    .map((c) => ({ ...c, score: c.factors.reduce((sum, f) => sum + f.points, 0) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_PRIORITIES).map((c, i) => ({
    rank: i + 1,
    kind: c.kind,
    label: c.label,
    categoryName: c.categoryName,
    score: c.score,
    factors: c.factors,
    refs: c.refs,
  }));
}
