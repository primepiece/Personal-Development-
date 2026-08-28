import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, lifeCategories, standards, trajectoryMetrics, visionEntries, weeklyReflections, weeklyReviews } from "@/db/schema";

/** Resolves a single evidence reference to somewhere in the app that actually shows the underlying record. */
export async function resolveEvidenceLink(refTable: string, refId: string): Promise<string | null> {
  switch (refTable) {
    case "coach_signals": {
      // No standalone signal page; signals surface on the dashboard and each pillar page.
      return "/";
    }
    case "goals": {
      const [row] = await db
        .select({ categorySlug: lifeCategories.slug })
        .from(goals)
        .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
        .where(eq(goals.id, refId))
        .limit(1);
      return row ? `/goals/${row.categorySlug}/g/${refId}` : null;
    }
    case "vision_entries": {
      const [row] = await db
        .select({ categorySlug: lifeCategories.slug })
        .from(visionEntries)
        .innerJoin(lifeCategories, eq(lifeCategories.id, visionEntries.categoryId))
        .where(eq(visionEntries.id, refId))
        .limit(1);
      return row ? `/goals/${row.categorySlug}` : null;
    }
    case "standards": {
      const [row] = await db
        .select({ categorySlug: lifeCategories.slug })
        .from(standards)
        .innerJoin(lifeCategories, eq(lifeCategories.id, standards.categoryId))
        .where(eq(standards.id, refId))
        .limit(1);
      return row ? `/goals/${row.categorySlug}` : null;
    }
    case "weekly_reviews": {
      const [row] = await db.select({ weekStartDate: weeklyReviews.weekStartDate }).from(weeklyReviews).where(eq(weeklyReviews.id, refId)).limit(1);
      return row ? `/weekly/${row.weekStartDate}` : null;
    }
    case "weekly_reflections": {
      const [row] = await db.select({ weekStartDate: weeklyReflections.weekStartDate }).from(weeklyReflections).where(eq(weeklyReflections.id, refId)).limit(1);
      return row ? `/weekly/${row.weekStartDate}` : null;
    }
    case "trajectory_metrics": {
      const [row] = await db.select({ id: trajectoryMetrics.id }).from(trajectoryMetrics).where(eq(trajectoryMetrics.id, refId)).limit(1);
      return row ? "/trajectory" : null;
    }
    case "daily_actions": {
      return `/today/a/${refId}`;
    }
    default:
      return null;
  }
}
