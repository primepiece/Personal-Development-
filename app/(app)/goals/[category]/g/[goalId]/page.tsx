import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goalRecurrence, goals, lifeCategories, trajectoryCheckpoints, trajectoryMetrics, visionEntries } from "@/db/schema";
import { traceGoalChain } from "@/lib/goals/trace";
import { TIER_LABEL, type GoalTier } from "@/lib/goals/tiers";
import { toggleGoalDoneAction } from "@/app/(app)/goals/actions";
import { computeMetricTrajectory } from "@/lib/trajectory/compute";
import { formatMetricValue } from "@/lib/trajectory/format";

export default async function GoalDetailPage({
  params,
}: PageProps<"/goals/[category]/g/[goalId]">) {
  const { category: slug, goalId } = await params;

  const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);
  if (!goal) notFound();

  const chain = await traceGoalChain(goal);
  const root = chain[0];

  const [category] = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.id, root.categoryId))
    .limit(1);

  const [vision] = await db
    .select()
    .from(visionEntries)
    .where(eq(visionEntries.categoryId, root.categoryId))
    .limit(1);

  const children = await db
    .select()
    .from(goals)
    .where(eq(goals.parentGoalId, goal.id))
    .orderBy(goals.title);

  const [recurrence] =
    goal.kind === "behavior"
      ? await db
          .select()
          .from(goalRecurrence)
          .where(eq(goalRecurrence.goalId, goal.id))
          .limit(1)
      : [];

  const [linkedMetric] = await db
    .select()
    .from(trajectoryMetrics)
    .where(eq(trajectoryMetrics.linkedGoalId, goal.id))
    .limit(1);
  const metricCheckpoints = linkedMetric
    ? await db
        .select()
        .from(trajectoryCheckpoints)
        .where(eq(trajectoryCheckpoints.metricId, linkedMetric.id))
        .orderBy(asc(trajectoryCheckpoints.asOfDate))
    : [];
  const metricTrajectory = linkedMetric
    ? computeMetricTrajectory(linkedMetric, metricCheckpoints, new Date())
    : null;

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <Link
        href={`/goals/${slug}`}
        className="font-mono text-[11px] text-text-faint hover:text-text-primary"
      >
        ← {category?.name ?? "Pillar"}
      </Link>

      <nav aria-label="Lineage" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-[11.5px] text-text-faint">Vision</span>
        {chain.map((step) => (
          <span key={step.id} className="flex items-center gap-2">
            <span className="text-text-faint">→</span>
            {step.id === goal.id ? (
              <span className="font-mono text-[11.5px] font-semibold text-text-primary">
                {TIER_LABEL[step.tier as GoalTier]}
              </span>
            ) : (
              <Link
                href={`/goals/${slug}/g/${step.id}`}
                className="font-mono text-[11.5px] text-text-faint hover:text-text-primary"
              >
                {TIER_LABEL[step.tier as GoalTier]}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-text-primary md:text-4xl">
          {goal.title}
        </h1>
        <form action={toggleGoalDoneAction}>
          <input type="hidden" name="goalId" value={goal.id} />
          <button
            type="submit"
            className={`shrink-0 rounded-sm border px-3 py-1.5 font-mono text-[11px] ${
              goal.status === "done"
                ? "border-positive bg-positive text-text-on-accent"
                : "border-border-strong text-text-primary"
            }`}
          >
            {goal.status === "done" ? "✓ done — reopen" : "mark done"}
          </button>
        </form>
      </div>

      <div className="mt-6 max-w-[62ch] rounded-sm border border-border bg-surface px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
          Why am I doing this?
        </p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">
          {vision?.whyItMatters ||
            `No Vision written yet for ${category?.name ?? "this pillar"} — write one to answer this properly.`}
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        <Field label="Kind" value={goal.kind} />
        <Field label="Priority" value={String(goal.priority)} />
        <Field label="Status" value={goal.status} />
        {goal.targetMetric && <Field label="Target metric" value={goal.targetMetric} />}
        {goal.targetValue !== null && (
          <Field label="Target value" value={String(goal.targetValue)} />
        )}
        {goal.targetDate && <Field label="Target date" value={goal.targetDate} />}
        {goal.milestoneAge && <Field label="Age" value={String(goal.milestoneAge)} />}
        {recurrence && (
          <Field
            label="Recurrence"
            value={`${recurrence.targetFrequency}× / ${recurrence.period}`}
          />
        )}
      </dl>

      {goal.description && (
        <p className="mt-6 max-w-[62ch] text-[14.5px] leading-relaxed text-text-secondary">
          {goal.description}
        </p>
      )}

      {linkedMetric && metricTrajectory && (
        <section className="mt-10">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Progress — {linkedMetric.name}
          </h2>
          <div className="mt-3 max-w-[62ch] rounded-sm border border-border bg-surface px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-mono text-[20px] text-text-primary">
                {metricTrajectory.current ? formatMetricValue(linkedMetric.unit, metricTrajectory.current.value) : "—"}
                {metricTrajectory.target && (
                  <span className="text-text-faint"> / {formatMetricValue(linkedMetric.unit, metricTrajectory.target.value)}</span>
                )}
              </span>
              <span className="font-mono text-[11px] uppercase text-text-secondary">
                {metricTrajectory.statusLabel}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-text-secondary">{metricTrajectory.statusReason}</p>
            <Link href="/trajectory" className="mt-2 inline-block font-mono text-[11px] text-text-faint hover:text-accent">
              → full breakdown on Trajectory
            </Link>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          {goal.tier === "weekly" ? "Daily actions" : "What this breaks down into"}
        </h2>

        {goal.tier === "weekly" ? (
          <p className="mt-3 text-[13.5px] text-text-faint">
            Weekly is as deep as the goal cascade goes — see{" "}
            <Link href="/today" className="text-text-secondary hover:text-accent">
              Today
            </Link>{" "}
            for the Prime Actions linked to this goal.
          </p>
        ) : children.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-text-faint">
            Nothing under this goal yet — add one from the pillar page.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/goals/${slug}/g/${child.id}`}
                  className="block rounded-sm border border-border bg-surface px-3 py-2.5 text-[14px] text-text-primary hover:border-border-strong"
                >
                  {child.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-faint">
        {label}
      </dt>
      <dd className="mt-1 text-[14px] text-text-primary">{value}</dd>
    </div>
  );
}
