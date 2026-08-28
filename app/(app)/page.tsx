import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoryScores, coachSignals, lifeCategories } from "@/db/schema";
import { computeTrajectoryState } from "@/lib/scoring/trajectory";
import { CONFIDENCE_LABEL, SIGNAL_TYPE_LABEL, TRAJECTORY_LABEL, describeSignal } from "@/lib/scoring/labels";
import { recomputeAllAction, acknowledgeSignalAction, suppressSignalAction } from "./actions";

export default async function PrimeDashboard() {
  const pillars = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.isActive, true))
    .orderBy(lifeCategories.sortOrder);

  const latestScores = await Promise.all(
    pillars.map(async (pillar) => {
      const [latest] = await db
        .select()
        .from(categoryScores)
        .where(eq(categoryScores.categoryId, pillar.id))
        .orderBy(desc(categoryScores.computedAt))
        .limit(1);
      return { pillar, latest };
    }),
  );

  const activeSignalRows = await db
    .select({
      id: coachSignals.id,
      type: coachSignals.type,
      severity: coachSignals.severity,
      importance: coachSignals.importance,
      status: coachSignals.status,
      categoryId: coachSignals.categoryId,
      categoryName: lifeCategories.name,
      categorySlug: lifeCategories.slug,
      detectedAt: coachSignals.detectedAt,
      evidence: coachSignals.evidence,
    })
    .from(coachSignals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, coachSignals.categoryId))
    .where(inArray(coachSignals.status, ["new", "active", "acknowledged"]));

  // Two independent axes shown, sorted, never blended into one number —
  // ranking them together is Prime Coach's job (M5+), not this dashboard's.
  const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
  activeSignalRows.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      b.importance - a.importance ||
      b.detectedAt.getTime() - a.detectedAt.getTime(),
  );

  const trajectory = computeTrajectoryState({
    pillarConfidences: latestScores.map((s) => s.latest?.confidence ?? "insufficient"),
    activeSignals: activeSignalRows,
  });

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Prime</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        Prime James
      </h1>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-surface px-5 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
            Trajectory State
          </p>
          <p className={`mt-1 font-display text-2xl font-semibold ${trajectoryColor(trajectory.state)}`}>
            {TRAJECTORY_LABEL[trajectory.state]}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">{trajectory.reason}</p>
        </div>
        <form action={recomputeAllAction}>
          <button type="submit" className="btn-primary">
            Recompute
          </button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Pillars</h2>
        <ul className="mt-4 flex flex-col divide-y divide-border border-y border-border">
          {latestScores.map(({ pillar, latest }) => (
            <li key={pillar.id}>
              <Link
                href={`/pillars/${pillar.slug}`}
                className="flex items-center justify-between gap-6 px-1 py-4 hover:bg-surface-sunken"
              >
                <span className="font-display text-lg font-semibold text-text-primary">
                  {pillar.name}
                </span>
                <span className="flex items-center gap-3">
                  {latest?.score != null ? (
                    <>
                      <span className="font-mono text-[15px] text-text-primary">
                        {Math.round(latest.score)}
                      </span>
                      {latest.trend && <span className={trendColor(latest.trend)}>{trendArrow(latest.trend)}</span>}
                      <span className="font-mono text-[11px] text-text-faint">
                        {CONFIDENCE_LABEL[latest.confidence]} confidence
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-[12px] text-text-faint">
                      {latest ? "Insufficient data" : "Not yet computed"}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Active signals
        </h2>
        {activeSignalRows.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-text-faint">
            None right now — recompute after logging some real activity to see the deterministic
            layer at work.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {activeSignalRows.map((signal) => (
              <li
                key={signal.id}
                className={`flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3 ${
                  signal.status === "acknowledged" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-text-primary">{describeSignal(signal)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-text-secondary">
                    <span>{SIGNAL_TYPE_LABEL[signal.type]}</span>
                    <span>· {signal.categoryName}</span>
                    <span>· importance {signal.importance}</span>
                    {signal.status === "new" && <span className="text-accent">· new</span>}
                    {signal.status === "acknowledged" && <span>· acknowledged</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`font-mono text-[11px] uppercase ${severityColor(signal.severity)}`}>
                    {signal.severity}
                  </span>
                  {signal.status !== "acknowledged" && (
                    <form action={acknowledgeSignalAction}>
                      <input type="hidden" name="signalId" value={signal.id} />
                      <button type="submit" className="font-mono text-[11px] text-text-faint hover:text-text-primary">
                        ack
                      </button>
                    </form>
                  )}
                  <form action={suppressSignalAction}>
                    <input type="hidden" name="signalId" value={signal.id} />
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
    </div>
  );
}

function trajectoryColor(state: string) {
  if (state === "strong") return "text-positive";
  if (state === "off_track") return "text-danger";
  if (state === "mixed") return "text-warning";
  return "text-text-secondary";
}

function trendArrow(trend: string) {
  return trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
}

function trendColor(trend: string) {
  if (trend === "up") return "text-positive";
  if (trend === "down") return "text-danger";
  return "text-text-faint";
}

function severityColor(severity: string) {
  if (severity === "critical") return "text-danger";
  if (severity === "warning") return "text-warning";
  return "text-text-faint";
}
