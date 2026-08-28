import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyActions, goals, lifeCategories, visionEntries, ventures } from "@/db/schema";
import { traceGoalChain } from "@/lib/goals/trace";
import { TIER_LABEL, type GoalTier } from "@/lib/goals/tiers";

export default async function ActionDetailPage({
  params,
}: PageProps<"/today/a/[actionId]">) {
  const { actionId } = await params;

  const [action] = await db.select().from(dailyActions).where(eq(dailyActions.id, actionId)).limit(1);
  if (!action) notFound();

  const [category] = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.id, action.categoryId))
    .limit(1);

  const [venture] = action.ventureId
    ? await db.select().from(ventures).where(eq(ventures.id, action.ventureId)).limit(1)
    : [];

  let chain: Awaited<ReturnType<typeof traceGoalChain>> = [];
  if (action.linkedGoalId) {
    const [linkedGoal] = await db.select().from(goals).where(eq(goals.id, action.linkedGoalId)).limit(1);
    if (linkedGoal) chain = await traceGoalChain(linkedGoal);
  }

  const vision =
    chain.length > 0
      ? (
          await db
            .select()
            .from(visionEntries)
            .where(eq(visionEntries.categoryId, chain[0].categoryId))
            .limit(1)
        )[0]
      : undefined;

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <Link href="/today" className="font-mono text-[11px] text-ink-faint hover:text-ink">
        ← Today
      </Link>

      {chain.length > 0 && (
        <nav aria-label="Lineage" className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11.5px] text-ink-faint">Vision</span>
          {chain.map((step) => (
            <span key={step.id} className="flex items-center gap-2">
              <span className="text-ink-faint">→</span>
              <Link
                href={`/goals/${category?.slug}/g/${step.id}`}
                className="font-mono text-[11.5px] text-ink-faint hover:text-ink"
              >
                {TIER_LABEL[step.tier as GoalTier]}
              </Link>
            </span>
          ))}
          <span className="text-ink-faint">→</span>
          <span className="font-mono text-[11.5px] font-semibold text-ink">Action</span>
        </nav>
      )}

      <h1 className="mt-4 font-display text-3xl font-semibold text-ink md:text-4xl">
        {action.title}
      </h1>

      <div className="mt-6 max-w-[62ch] rounded-sm border border-line bg-surface-raised px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          Why am I doing this?
        </p>
        {action.isStandalone ? (
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            This is a deliberately standalone action — it isn&apos;t linked to a goal. That was
            an explicit choice when it was created, not a default.
          </p>
        ) : (
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            {vision?.whyItMatters ||
              `No Vision written yet for ${category?.name ?? "this pillar"} — write one to answer this properly.`}
          </p>
        )}
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        <Field label="Pillar" value={category?.name ?? "—"} />
        <Field label="Priority" value={String(action.priority)} />
        <Field label="Status" value={action.status} />
        <Field label="Source" value={action.source === "suggested" ? "suggested" : "manually added"} />
        {venture && <Field label="Venture / project" value={venture.name} />}
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[14px] text-ink">{value}</dd>
    </div>
  );
}
