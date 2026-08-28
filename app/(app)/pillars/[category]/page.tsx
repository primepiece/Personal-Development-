import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoryScores, coachSignals, lifeCategories, trajectoryCheckpoints, trajectoryMetrics } from "@/db/schema";
import type { ScoreComponent } from "@/lib/scoring/components";
import { CONFIDENCE_LABEL, SIGNAL_TYPE_LABEL, describeSignal } from "@/lib/scoring/labels";
import { computeMetricTrajectory } from "@/lib/trajectory/compute";
import { formatMetricValue } from "@/lib/trajectory/format";
import { acknowledgeSignalAction, suppressSignalAction } from "../../actions";

const HISTORY_LIMIT = 10;

export default async function PillarScorePage({
  params,
}: PageProps<"/pillars/[category]">) {
  const { category: slug } = await params;

  const [category] = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.slug, slug))
    .limit(1);
  if (!category) notFound();

  const history = await db
    .select()
    .from(categoryScores)
    .where(eq(categoryScores.categoryId, category.id))
    .orderBy(desc(categoryScores.computedAt))
    .limit(HISTORY_LIMIT);

  const latest = history[0];

  const signals = await db
    .select()
    .from(coachSignals)
    .where(
      and(
        eq(coachSignals.categoryId, category.id),
        inArray(coachSignals.status, ["new", "active", "acknowledged"]),
      ),
    );

  const breakdown = latest?.breakdown as
    | { components: ScoreComponent[]; confidenceReason: string }
    | undefined;

  const metrics = await db
    .select()
    .from(trajectoryMetrics)
    .where(and(eq(trajectoryMetrics.categoryId, category.id), eq(trajectoryMetrics.isActive, true)));

  const metricsWithTrajectory = await Promise.all(
    metrics.map(async (metric) => {
      const checkpoints = await db
        .select()
        .from(trajectoryCheckpoints)
        .where(eq(trajectoryCheckpoints.metricId, metric.id));
      return { metric, trajectory: computeMetricTrajectory(metric, checkpoints, new Date()) };
    }),
  );

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <Link href="/" className="font-mono text-[11px] text-text-faint hover:text-text-primary">
        ← Prime
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        {category.name}
      </h1>

      {!latest ? (
        <p className="mt-6 max-w-[60ch] text-[14.5px] text-text-secondary">
          No score has been computed for this pillar yet. Recompute from the Prime dashboard.
        </p>
      ) : latest.score === null ? (
        <div className="mt-6 rounded-sm border border-border bg-surface px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
            Insufficient data
          </p>
          <p className="mt-2 text-[14px] text-text-secondary">{breakdown?.confidenceReason}</p>
        </div>
      ) : (
        <div className="mt-6 flex items-baseline gap-4">
          <span className="font-display text-5xl font-semibold text-text-primary">
            {Math.round(latest.score)}
          </span>
          <span className="font-mono text-[12px] text-text-faint">
            {CONFIDENCE_LABEL[latest.confidence]} confidence — {breakdown?.confidenceReason}
          </span>
        </div>
      )}

      {breakdown && (
        <section className="mt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Behavior evidence — scored components
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {breakdown.components.map((c) => (
              <ComponentCard key={c.key} component={c} categorySlug={category.slug} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Outcome evidence — not scored
        </h2>
        <p className="mt-2 max-w-[62ch] text-[13px] text-text-faint">
          Trajectory metrics for this pillar. Shown for evidence, not blended into the score above
          — there&apos;s no agreed rule yet for how outcome pace should affect a behavior-based score.
        </p>
        {metricsWithTrajectory.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-text-faint">No metrics tracked for this pillar yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {metricsWithTrajectory.map(({ metric, trajectory }) => (
              <li key={metric.id} className="flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3">
                <div className="min-w-0">
                  <Link href="/trajectory" className="text-[14px] text-text-primary hover:text-accent">
                    {metric.name}
                  </Link>
                  <p className="mt-1 font-mono text-[11px] text-text-secondary">
                    {trajectory.current ? formatMetricValue(metric.unit, trajectory.current.value) : "—"}
                    {trajectory.target && ` / ${formatMetricValue(metric.unit, trajectory.target.value)}`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] uppercase text-text-secondary">
                  {trajectory.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Active signals
        </h2>
        {signals.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-text-faint">None for this pillar right now.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {signals.map((s) => (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3 ${
                  s.status === "acknowledged" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-text-primary">{describeSignal(s)}</p>
                  <p className="mt-1 font-mono text-[11px] text-text-secondary">
                    {SIGNAL_TYPE_LABEL[s.type]} · importance {s.importance} · detected{" "}
                    {s.detectedAt.toISOString().slice(0, 10)}
                    {s.status === "new" && <span className="text-accent"> · new</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {s.status !== "acknowledged" && (
                    <form action={acknowledgeSignalAction}>
                      <input type="hidden" name="signalId" value={s.id} />
                      <button type="submit" className="font-mono text-[11px] text-text-faint hover:text-text-primary">
                        ack
                      </button>
                    </form>
                  )}
                  <form action={suppressSignalAction}>
                    <input type="hidden" name="signalId" value={s.id} />
                    <button type="submit" className="font-mono text-[11px] text-text-faint hover:text-warning">
                      suppress
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          History ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-text-faint">No snapshots yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-4 font-mono text-[12px] text-text-secondary"
              >
                <span>{h.computedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                <span>{h.score !== null ? Math.round(h.score) : "insufficient"}</span>
                <span className="text-text-faint">{CONFIDENCE_LABEL[h.confidence]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ComponentCard({
  component,
  categorySlug,
}: {
  component: ScoreComponent;
  categorySlug: string;
}) {
  const goalRefs = component.evidenceRefs.filter((r) => r.table === "goals");
  const otherRefCounts = new Map<string, number>();
  for (const ref of component.evidenceRefs) {
    if (ref.table === "goals") continue;
    otherRefCounts.set(ref.table, (otherRefCounts.get(ref.table) ?? 0) + 1);
  }

  const included = component.maturity !== "baseline" && component.value !== null;

  return (
    <li className={`rounded-sm border px-4 py-3.5 ${included ? "border-border bg-surface" : "border-border bg-surface-sunken"}`}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[14px] text-text-primary">{component.label}</p>
        <span className="font-mono text-[15px] text-text-primary">
          {component.value !== null ? Math.round(component.value) : "—"}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] text-text-secondary sm:grid-cols-4">
        <div>
          <dt className="text-text-faint">source</dt>
          <dd>{component.source}</dd>
        </div>
        <div>
          <dt className="text-text-faint">period</dt>
          <dd>{component.period.label}</dd>
        </div>
        <div>
          <dt className="text-text-faint">maturity</dt>
          <dd className={included ? "" : "text-warning"}>{component.maturity}</dd>
        </div>
        <div>
          <dt className="text-text-faint">weight</dt>
          <dd>{included ? `${Math.round((component.weight ?? 0) * 100)}%` : "excluded"}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12.5px] text-text-secondary">{component.calculation}</p>
      {(goalRefs.length > 0 || otherRefCounts.size > 0) && (
        <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-[11px] text-text-faint">
          {goalRefs.map((ref) => (
            <Link
              key={ref.id}
              href={`/goals/${categorySlug}/g/${ref.id}`}
              className="hover:text-accent"
            >
              → source goal
            </Link>
          ))}
          {[...otherRefCounts.entries()].map(([table, count]) => (
            <span key={table}>
              {count} {table.replace("_", " ")} record{count === 1 ? "" : "s"}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
