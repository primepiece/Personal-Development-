import { classifyMaturity, daysBetween, type EvidenceMaturity } from "@/lib/scoring/evidence";

export type MetricDirection = "higher_is_better" | "lower_is_better";

export type PaceStatus =
  | "target_reached"
  | "target_date_passed"
  | "behind_pace"
  | "on_pace"
  | "ahead_pace";

export type MetricTrajectory = {
  checkpointCount: number;
  spanDays: number;
  maturity: EvidenceMaturity;
  current: { value: number; asOfDate: string } | null;
  target: { value: number; date: string | null } | null;
  /** target − current, direction-naive — always computable once both exist, no history required. */
  currentGapToTarget: number | null;
  change: { windowDays: number; amount: number } | null;
  pace: {
    requiredMonthlyChange: number | null;
    observedMonthlyChange: number;
    observedWindowDays: number;
    status: PaceStatus;
  } | null;
  projection: { atTargetDate: number; shortfall: number } | null;
  statusLabel: string;
  statusReason: string;
};

const OBSERVATION_WINDOW_DAYS = 90;
const PACE_TOLERANCE = 0.1; // ±10% of required rate still counts as "on pace"

type Checkpoint = { asOfDate: string; value: number; createdAt: Date };

function monthsBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / 30;
}

/**
 * Everything here is either a stored checkpoint, a stored target, or one
 * of a small number of transparent derived numbers — never a smoothed or
 * "impressive-looking" forecast. If there isn't enough history, this
 * says so and stops, rather than projecting from two data points as if
 * they were a trend.
 */
export function computeMetricTrajectory(
  metric: {
    direction: MetricDirection;
    targetValue: number | null;
    targetDate: string | null;
  },
  checkpointsRaw: Checkpoint[],
  now: Date = new Date(),
): MetricTrajectory {
  const checkpoints = [...checkpointsRaw].sort(
    (a, b) => a.asOfDate.localeCompare(b.asOfDate) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const checkpointCount = checkpoints.length;

  if (checkpointCount === 0) {
    return {
      checkpointCount: 0,
      spanDays: 0,
      maturity: "baseline",
      current: null,
      target: metric.targetValue !== null ? { value: metric.targetValue, date: metric.targetDate } : null,
      currentGapToTarget: null,
      change: null,
      pace: null,
      projection: null,
      statusLabel: "Insufficient history for projection",
      statusReason: "No checkpoints logged yet.",
    };
  }

  const first = checkpoints[0];
  const last = checkpoints[checkpoints.length - 1];
  const spanDays = daysBetween(new Date(first.asOfDate), new Date(last.asOfDate));
  const maturity = classifyMaturity(spanDays, checkpointCount);

  const current = { value: last.value, asOfDate: last.asOfDate };
  const target = metric.targetValue !== null ? { value: metric.targetValue, date: metric.targetDate } : null;
  const currentGapToTarget = target ? target.value - current.value : null;

  if (maturity === "baseline") {
    return {
      checkpointCount,
      spanDays,
      maturity,
      current,
      target,
      currentGapToTarget,
      change: checkpointCount >= 2 ? { windowDays: spanDays, amount: last.value - first.value } : null,
      pace: null,
      projection: null,
      statusLabel: "Establishing trajectory",
      statusReason: `Only ${checkpointCount} checkpoint${checkpointCount === 1 ? "" : "s"} over ${spanDays} day${spanDays === 1 ? "" : "s"} — not enough to compute a real trend yet.`,
    };
  }

  // Observed rate: trailing OBSERVATION_WINDOW_DAYS from the latest checkpoint, or the
  // full history if it's shorter than that window.
  const windowStartDate = new Date(last.asOfDate);
  windowStartDate.setDate(windowStartDate.getDate() - OBSERVATION_WINDOW_DAYS);
  const windowStart =
    [...checkpoints].reverse().find((c) => new Date(c.asOfDate) <= windowStartDate) ?? first;
  const observedWindowDays = Math.max(1, daysBetween(new Date(windowStart.asOfDate), new Date(last.asOfDate)));
  const observedMonthlyChange = ((last.value - windowStart.value) / observedWindowDays) * 30;

  const change = { windowDays: observedWindowDays, amount: last.value - windowStart.value };

  if (!target || !target.date) {
    return {
      checkpointCount,
      spanDays,
      maturity,
      current,
      target,
      currentGapToTarget,
      change,
      pace: null,
      projection: null,
      statusLabel: "No target set",
      statusReason: "Tracking checkpoints only — set a target value and date to see pace.",
    };
  }

  const reached =
    metric.direction === "higher_is_better" ? current.value >= target.value : current.value <= target.value;

  if (reached) {
    return {
      checkpointCount,
      spanDays,
      maturity,
      current,
      target,
      currentGapToTarget,
      change,
      pace: {
        requiredMonthlyChange: null,
        observedMonthlyChange: round2(observedMonthlyChange),
        observedWindowDays,
        status: "target_reached",
      },
      projection: null,
      statusLabel: "Target reached",
      statusReason: `Current value already meets the target of ${target.value}.`,
    };
  }

  const monthsUntilTarget = monthsBetween(now, new Date(target.date));

  if (monthsUntilTarget <= 0) {
    return {
      checkpointCount,
      spanDays,
      maturity,
      current,
      target,
      currentGapToTarget,
      change,
      pace: {
        requiredMonthlyChange: null,
        observedMonthlyChange: round2(observedMonthlyChange),
        observedWindowDays,
        status: "target_date_passed",
      },
      projection: null,
      statusLabel: "Target date passed",
      statusReason: `Target date was ${target.date} and the target wasn't reached.`,
    };
  }

  const requiredMonthlyChange = (target.value - current.value) / monthsUntilTarget;

  // Direction-normalized comparison: positive always means "moving toward the target."
  const sign = metric.direction === "higher_is_better" ? 1 : -1;
  const progressRate = sign * observedMonthlyChange;
  const requiredRate = sign * requiredMonthlyChange;

  let status: PaceStatus;
  if (progressRate < requiredRate * (1 - PACE_TOLERANCE)) status = "behind_pace";
  else if (progressRate > requiredRate * (1 + PACE_TOLERANCE)) status = "ahead_pace";
  else status = "on_pace";

  const projectedAtTargetDate = current.value + observedMonthlyChange * monthsUntilTarget;
  const shortfall = sign * (target.value - projectedAtTargetDate);

  const statusLabelMap: Record<PaceStatus, string> = {
    target_reached: "Target reached",
    target_date_passed: "Target date passed",
    behind_pace: "Behind pace",
    on_pace: "On pace",
    ahead_pace: "Ahead of pace",
  };

  return {
    checkpointCount,
    spanDays,
    maturity,
    current,
    target,
    currentGapToTarget,
    change,
    pace: {
      requiredMonthlyChange: round2(requiredMonthlyChange),
      observedMonthlyChange: round2(observedMonthlyChange),
      observedWindowDays,
      status,
    },
    projection: {
      atTargetDate: round2(projectedAtTargetDate),
      shortfall: round2(shortfall),
    },
    statusLabel: statusLabelMap[status],
    statusReason: `Required: ${round2(requiredMonthlyChange)}/month to hit ${target.value} by ${target.date}. Observed: ${round2(observedMonthlyChange)}/month over the last ${observedWindowDays} days.`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
