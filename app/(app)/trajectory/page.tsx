import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, lifeCategories, trajectoryCheckpoints, trajectoryMetrics, ventures } from "@/db/schema";
import { computeMetricTrajectory } from "@/lib/trajectory/compute";
import { createMetricAction } from "./actions";
import { MetricCard } from "./_components/metric-card";

export default async function TrajectoryPage() {
  const metrics = await db
    .select({
      id: trajectoryMetrics.id,
      name: trajectoryMetrics.name,
      unit: trajectoryMetrics.unit,
      direction: trajectoryMetrics.direction,
      targetValue: trajectoryMetrics.targetValue,
      targetDate: trajectoryMetrics.targetDate,
      categoryId: trajectoryMetrics.categoryId,
      categoryName: lifeCategories.name,
      categorySlug: lifeCategories.slug,
      ventureName: ventures.name,
      linkedGoalId: trajectoryMetrics.linkedGoalId,
    })
    .from(trajectoryMetrics)
    .innerJoin(lifeCategories, eq(lifeCategories.id, trajectoryMetrics.categoryId))
    .leftJoin(ventures, eq(ventures.id, trajectoryMetrics.ventureId))
    .where(eq(trajectoryMetrics.isActive, true));

  const linkedGoalIds = metrics.map((m) => m.linkedGoalId).filter((id): id is string => !!id);
  const linkedGoals = linkedGoalIds.length > 0 ? await db.select().from(goals).where(inArray(goals.id, linkedGoalIds)) : [];
  const goalTitleById = new Map(linkedGoals.map((g) => [g.id, g.title]));

  const metricsWithTrajectory = await Promise.all(
    metrics.map(async (metric) => {
      const checkpoints = await db
        .select()
        .from(trajectoryCheckpoints)
        .where(eq(trajectoryCheckpoints.metricId, metric.id))
        .orderBy(asc(trajectoryCheckpoints.asOfDate));
      const trajectory = computeMetricTrajectory(metric, checkpoints, new Date());
      return { metric, checkpoints, trajectory };
    }),
  );

  const pillars = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.isActive, true))
    .orderBy(lifeCategories.sortOrder);

  const outcomeGoals = await db
    .select({ id: goals.id, title: goals.title, categoryName: lifeCategories.name })
    .from(goals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
    .where(and(eq(goals.kind, "outcome"), eq(goals.status, "active")));

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Trajectory</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        If you keep living exactly like this, where do you end up?
      </h1>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text-secondary">
        Every number below is a real logged checkpoint or a plain calculation from real logged
        checkpoints — never a projection dressed up to look more certain than the history behind
        it.
      </p>

      <section className="mt-10">
        {metricsWithTrajectory.length === 0 ? (
          <p className="text-[13.5px] text-text-faint">No metrics yet — add your first below.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {metricsWithTrajectory.map(({ metric, checkpoints, trajectory }) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                trajectory={trajectory}
                checkpoints={checkpoints}
                categorySlug={metric.categorySlug}
                linkedGoalId={metric.linkedGoalId}
                linkedGoalTitle={metric.linkedGoalId ? (goalTitleById.get(metric.linkedGoalId) ?? null) : null}
              />
            ))}
          </ul>
        )}

        <details className="mt-6">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
            + add a metric
          </summary>
          <form
            action={createMetricAction}
            className="mt-3 grid grid-cols-1 gap-3 rounded-sm border border-border bg-surface p-4 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Name</span>
              <input name="name" required className="field-input" placeholder="Net Worth" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Pillar (used unless a goal is linked below)</span>
              <select name="categoryId" defaultValue="" className="field-input">
                <option value="">— select —</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Linked outcome goal (optional)</span>
              <select name="linkedGoalId" defaultValue="" className="field-input">
                <option value="">— none —</option>
                {outcomeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.categoryName} — {g.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Unit</span>
              <input name="unit" required className="field-input" placeholder="NZD, seconds, kg…" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Direction</span>
              <select name="direction" defaultValue="higher_is_better" className="field-input">
                <option value="higher_is_better">Higher is better</option>
                <option value="lower_is_better">Lower is better</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Target value (optional)</span>
              <input type="number" step="any" name="targetValue" className="field-input" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Target date (optional)</span>
              <input type="date" name="targetDate" className="field-input" />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Baseline value (optional, context only)</span>
              <input type="number" step="any" name="baselineValue" className="field-input" />
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Venture / project (optional)</span>
              <input name="ventureName" className="field-input" placeholder="PrimeAI" />
            </label>

            <button type="submit" className="btn-primary self-start sm:col-span-2">
              Create metric
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
