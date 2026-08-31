import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { lifeCategories, standards, visionEntries, goals } from "@/db/schema";
import { GOAL_TIERS, requiredParentTier, type GoalTier } from "@/lib/goals/tiers";
import { VisionForm } from "./_components/vision-form";
import { StandardsSection } from "./_components/standards-section";
import { GoalTierSection } from "./_components/goal-tier-section";

export default async function CategoryPage({
  params,
}: PageProps<"/goals/[category]">) {
  const { category: slug } = await params;

  const [category] = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.slug, slug))
    .limit(1);

  if (!category) notFound();

  const [vision] = await db
    .select()
    .from(visionEntries)
    .where(eq(visionEntries.categoryId, category.id))
    .limit(1);

  const activeStandards = await db
    .select()
    .from(standards)
    .where(and(eq(standards.categoryId, category.id), eq(standards.isActive, true)))
    .orderBy(standards.createdAt);

  const allGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.categoryId, category.id), ne(goals.status, "abandoned")))
    .orderBy(goals.title);

  const goalsByTier = new Map<GoalTier, typeof allGoals>();
  for (const tier of GOAL_TIERS) goalsByTier.set(tier, []);
  for (const goal of allGoals) {
    goalsByTier.get(goal.tier as GoalTier)?.push(goal);
  }

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <Link href="/goals" className="font-mono text-[11px] text-text-faint hover:text-text-primary">
        ← All pillars
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        {category.name}
      </h1>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Vision
        </h2>
        <div className="mt-4">
          <VisionForm categoryId={category.id} vision={vision} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Standards
        </h2>
        <div className="mt-4">
          <StandardsSection categoryId={category.id} standards={activeStandards} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Goals
        </h2>
        <div className="mt-2">
          {GOAL_TIERS.map((tier) => {
            const parentTier = requiredParentTier(tier);
            return (
              <GoalTierSection
                key={tier}
                categoryId={category.id}
                categorySlug={category.slug}
                tier={tier}
                goalsInTier={goalsByTier.get(tier) ?? []}
                parentTier={parentTier}
                parentOptions={parentTier ? goalsByTier.get(parentTier) ?? [] : []}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
