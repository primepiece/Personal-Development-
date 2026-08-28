import Link from "next/link";
import { addCheckpointAction, retireMetricAction } from "../actions";
import { CheckpointChart } from "./checkpoint-chart";
import { formatMetricDelta, formatMetricValue } from "@/lib/trajectory/format";
import type { MetricTrajectory } from "@/lib/trajectory/compute";

const STATUS_COLOR: Record<string, string> = {
  behind_pace: "text-warning",
  on_pace: "text-positive",
  ahead_pace: "text-positive",
  target_reached: "text-positive",
  target_date_passed: "text-danger",
};

export function MetricCard({
  metric,
  trajectory,
  checkpoints,
  categorySlug,
  linkedGoalId,
  linkedGoalTitle,
}: {
  metric: {
    id: string;
    name: string;
    unit: string;
    ventureName: string | null;
    categoryName: string;
  };
  trajectory: MetricTrajectory;
  checkpoints: { asOfDate: string; value: number }[];
  categorySlug: string;
  linkedGoalId: string | null;
  linkedGoalTitle: string | null;
}) {
  const fmt = (v: number) => formatMetricValue(metric.unit, v);
  const statusColor = STATUS_COLOR[trajectory.pace?.status ?? ""] ?? "text-text-secondary";

  return (
    <li className="rounded-sm border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-text-primary">{metric.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
            {metric.categoryName}
            {metric.ventureName && <> · {metric.ventureName}</>}
            {linkedGoalTitle && (
              <>
                {" · "}
                <Link href={`/goals/${categorySlug}/g/${linkedGoalId}`} className="hover:text-accent">
                  {linkedGoalTitle}
                </Link>
              </>
            )}
          </p>
        </div>
        <span className={`font-mono text-[12px] uppercase ${statusColor}`}>{trajectory.statusLabel}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="field-label">Current</dt>
          <dd className="mt-1 font-mono text-[15px] text-text-primary">
            {trajectory.current ? fmt(trajectory.current.value) : "—"}
          </dd>
        </div>
        <div>
          <dt className="field-label">Target</dt>
          <dd className="mt-1 font-mono text-[15px] text-text-primary">
            {trajectory.target ? fmt(trajectory.target.value) : "—"}
          </dd>
        </div>
        <div>
          <dt className="field-label">Target date</dt>
          <dd className="mt-1 font-mono text-[13px] text-text-primary">{trajectory.target?.date ?? "—"}</dd>
        </div>
        <div>
          <dt className="field-label">Change</dt>
          <dd className="mt-1 font-mono text-[13px] text-text-primary">
            {trajectory.change ? `${formatMetricDelta(metric.unit, trajectory.change.amount)} / ${trajectory.change.windowDays}d` : "—"}
          </dd>
        </div>
      </dl>

      <p className="mt-3 max-w-[62ch] text-[13px] text-text-secondary">{trajectory.statusReason}</p>

      {trajectory.projection && (
        <p className="mt-1 font-mono text-[12px] text-text-faint">
          Projected at target date: {fmt(trajectory.projection.atTargetDate)} (
          {trajectory.projection.shortfall >= 0 ? "ahead by " : "short by "}
          {fmt(Math.abs(trajectory.projection.shortfall))})
        </p>
      )}

      <CheckpointChart checkpoints={checkpoints} targetValue={trajectory.target?.value ?? null} />

      <details className="mt-4">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
          + add checkpoint · {trajectory.checkpointCount} logged
        </summary>
        <form action={addCheckpointAction} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input type="hidden" name="metricId" value={metric.id} />
          <label className="flex flex-col gap-1">
            <span className="field-label">Value ({metric.unit})</span>
            <input type="number" step="any" name="value" required className="field-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">As of date</span>
            <input type="date" name="asOfDate" className="field-input" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="field-label">Note (optional)</span>
            <input name="note" className="field-input" />
          </label>
          <button type="submit" className="btn-primary self-end">
            Add
          </button>
        </form>
      </details>

      <form action={retireMetricAction} className="mt-2">
        <input type="hidden" name="metricId" value={metric.id} />
        <button type="submit" className="font-mono text-[11px] text-text-faint hover:text-warning">
          retire metric
        </button>
      </form>
    </li>
  );
}
