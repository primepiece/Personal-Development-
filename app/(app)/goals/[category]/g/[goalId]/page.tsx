import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goalRecurrence, goals, lifeCategories, visionEntries } from "@/db/schema";
import { traceGoalChain } from "@/lib/goals/trace";
import { TIER_LABEL, type GoalTier } from "@/lib/goals/tiers";

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

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <Link
        href={`/goals/${slug}`}
        className="font-mono text-[11px] text-ink-faint hover:text-ink"
      >
        ← {category?.name ?? "Pillar"}
      </Link>

      <nav aria-label="Lineage" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-[11.5px] text-ink-faint">Vision</span>
        {chain.map((step) => (
          <span key={step.id} className="flex items-center gap-2">
            <span className="text-ink-faint">→</span>
            {step.id === goal.id ? (
              <span className="font-mono text-[11.5px] font-semibold text-ink">
                {TIER_LABEL[step.tier as GoalTier]}
              </span>
            ) : (
              <Link
                href={`/goals/${slug}/g/${step.id}`}
                className="font-mono text-[11.5px] text-ink-faint hover:text-ink"
              >
                {TIER_LABEL[step.tier as GoalTier]}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <h1 className="mt-4 font-display text-3xl font-semibold text-ink md:text-4xl">
        {goal.title}
      </h1>

      <div className="mt-6 max-w-[62ch] rounded-sm border border-line bg-surface-raised px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          Why am I doing this?
        </p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
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
        <p className="mt-6 max-w-[62ch] text-[14.5px] leading-relaxed text-ink-soft">
          {goal.description}
        </p>
      )}

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
          {goal.tier === "weekly" ? "Daily actions" : "What this breaks down into"}
        </h2>

        {goal.tier === "weekly" ? (
          <p className="mt-3 text-[13.5px] text-ink-faint">
            Weekly is as deep as the cascade goes for now — Today (M2) will let daily
            actions link up to a weekly goal like this one.
          </p>
        ) : children.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-ink-faint">
            Nothing under this goal yet — add one from the pillar page.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/goals/${slug}/g/${child.id}`}
                  className="block rounded-sm border border-line bg-surface-raised px-3 py-2.5 text-[14px] text-ink hover:border-line-strong"
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
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 text-[14px] text-ink">{value}</dd>
    </div>
  );
}
