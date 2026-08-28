import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, lifeCategories, visionEntries } from "@/db/schema";

export default async function GoalsIndexPage() {
  const categories = await db
    .select()
    .from(lifeCategories)
    .where(eq(lifeCategories.isActive, true))
    .orderBy(lifeCategories.sortOrder);

  const visions = await db.select().from(visionEntries);
  const visionByCategory = new Map(visions.map((v) => [v.categoryId, v]));

  const goalCounts = await db
    .select({ categoryId: goals.categoryId, count: sql<number>`count(*)::int` })
    .from(goals)
    .groupBy(goals.categoryId);
  const countByCategory = new Map(goalCounts.map((g) => [g.categoryId, g.count]));

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
        Goals
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        Vision, Standards &amp; the cascade
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
        Seven pillars, read live from Postgres — this list existing at all
        is the proof auth and the database are both actually wired up.
      </p>

      <ul className="mt-10 flex flex-col divide-y divide-border border-y border-border">
        {categories.map((category) => {
          const vision = visionByCategory.get(category.id);
          const goalCount = countByCategory.get(category.id) ?? 0;
          return (
            <li key={category.id}>
              <Link
                href={`/goals/${category.slug}`}
                className="flex items-center justify-between gap-6 px-1 py-5 hover:bg-surface-sunken"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-text-primary">
                    {category.name}
                  </p>
                  <p className="mt-1 truncate text-[13.5px] text-text-secondary">
                    {vision?.whoIWantToBecome || "Vision not written yet."}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12px] text-text-faint">
                  {goalCount} goal{goalCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {categories.length === 0 && (
        <p className="mt-10 rounded-sm border border-border bg-surface px-4 py-3 font-mono text-[12px] text-text-faint">
          No pillars found. Run `npm run db:push` then `npm run db:seed`
          against your Supabase database.
        </p>
      )}
    </div>
  );
}
