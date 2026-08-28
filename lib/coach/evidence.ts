import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  coachSignals,
  goals,
  lifeCategories,
  standards,
  visionEntries,
  weeklyReflections,
  weeklyReviews,
} from "@/db/schema";
import { describeSignal } from "@/lib/scoring/labels";
import { toDateKey } from "@/lib/today/date";
import { weekStartKey } from "@/lib/weekly/date";
import type { WeeklyReviewSnapshot } from "@/lib/weekly/types";
import type { AllowedRefs, CoachEvidenceBundle } from "./types";

const PRIOR_WEEKS_LOOKBACK = 8; // how far back to search
const PRIOR_WEEKS_MAX = 4; // how many found weeks to actually include
const RECENT_REFLECTIONS_MAX = 4;

function priorWeekStart(currentWeekStart: Date, n: number): Date {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() - n * 7);
  return d;
}

/**
 * Assembles the entire deterministic input handed to the model, plus a
 * whitelist of every real database id it's allowed to cite as evidence.
 * Every field here traces back to a plain query — no inference, no
 * derived psychology, nothing the model couldn't have looked up itself
 * if it could query Postgres directly.
 */
export async function buildCoachEvidenceBundle(
  weekStart: Date,
): Promise<{ bundle: CoachEvidenceBundle; allowedRefs: AllowedRefs; weeklyReviewId: string }> {
  const weekStartDateKey = weekStartKey(weekStart);
  const allowedRefs: AllowedRefs = new Map();
  const allow = (table: string, id: string | null | undefined) => {
    if (id) allowedRefs.set(id, table);
  };

  const [currentReviewRow] = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.weekStartDate, weekStartDateKey))
    .orderBy(desc(weeklyReviews.computedAt))
    .limit(1);
  if (!currentReviewRow) {
    throw new Error("No Weekly Review has been generated for this week yet — generate one before running Coach.");
  }
  const currentWeek = currentReviewRow.snapshot as WeeklyReviewSnapshot;
  allow("weekly_reviews", currentReviewRow.id);
  for (const m of currentWeek.trajectoryMetrics) allow("trajectory_metrics", m.metricId);
  for (const a of currentWeek.primeActions.unfinished) allow("daily_actions", a.id);
  for (const list of [
    currentWeek.signals.newThisWeek,
    currentWeek.signals.highImportanceActive,
    currentWeek.signals.acknowledgedUnresolved,
    currentWeek.signals.resolvedThisWeek,
  ]) {
    for (const s of list) allow("coach_signals", s.id);
  }

  // ---------------------------------------------------------------
  // Prior weeks — walk backward looking for weeks that actually have a
  // generated review; skip ungenerated ones rather than fabricating a
  // gap-filler. Summarized, not the full bundle, to keep context tight.
  // ---------------------------------------------------------------
  const priorWeeks: CoachEvidenceBundle["priorWeeks"] = [];
  for (let n = 1; n <= PRIOR_WEEKS_LOOKBACK && priorWeeks.length < PRIOR_WEEKS_MAX; n++) {
    const key = weekStartKey(priorWeekStart(weekStart, n));
    const [row] = await db
      .select()
      .from(weeklyReviews)
      .where(eq(weeklyReviews.weekStartDate, key))
      .orderBy(desc(weeklyReviews.computedAt))
      .limit(1);
    if (!row) continue;
    const snap = row.snapshot as WeeklyReviewSnapshot;
    allow("weekly_reviews", row.id);
    priorWeeks.push({
      weekStartDate: row.weekStartDate,
      trajectoryState: row.trajectoryState,
      primeActionsCompletionRate: snap.primeActions.completionRate,
      topInsights: snap.insights.slice(0, 4),
      priorities: snap.priorities.map((p) => p.label),
    });
  }

  // ---------------------------------------------------------------
  // Unresolved signals — the FULL current picture, not time-boxed to
  // this week, so a long-running neglect signal doesn't drop out of
  // view just because it wasn't newly detected this week.
  // ---------------------------------------------------------------
  const signalRows = await db
    .select({
      id: coachSignals.id,
      type: coachSignals.type,
      severity: coachSignals.severity,
      importance: coachSignals.importance,
      categoryName: lifeCategories.name,
      evidence: coachSignals.evidence,
      detectedAt: coachSignals.detectedAt,
      status: coachSignals.status,
    })
    .from(coachSignals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, coachSignals.categoryId))
    .where(inArray(coachSignals.status, ["new", "active", "acknowledged"]));

  const unresolvedSignals = signalRows.map((s) => {
    allow("coach_signals", s.id);
    return {
      id: s.id,
      type: s.type,
      severity: s.severity,
      importance: s.importance,
      categoryName: s.categoryName,
      description: describeSignal(s),
      detectedAt: s.detectedAt.toISOString(),
      status: s.status,
    };
  });

  // ---------------------------------------------------------------
  // Pillar hierarchy — Vision, Standards, and every active goal, per
  // pillar. This is what lets the Coach reason about the cascade
  // (identity/vision -> pillar -> standards -> goals) rather than just
  // reacting to whichever numbers moved this week.
  // ---------------------------------------------------------------
  const pillarRows = await db.select().from(lifeCategories).where(eq(lifeCategories.isActive, true)).orderBy(lifeCategories.sortOrder);
  const pillars: CoachEvidenceBundle["pillars"] = [];
  for (const p of pillarRows) {
    const [vision] = await db.select().from(visionEntries).where(eq(visionEntries.categoryId, p.id)).limit(1);
    allow("vision_entries", vision?.id);

    const standardRows = await db
      .select()
      .from(standards)
      .where(and(eq(standards.categoryId, p.id), eq(standards.isActive, true)));
    for (const s of standardRows) allow("standards", s.id);

    const goalRows = await db
      .select({ id: goals.id, tier: goals.tier, kind: goals.kind, title: goals.title, priority: goals.priority })
      .from(goals)
      .where(and(eq(goals.categoryId, p.id), eq(goals.status, "active")));
    for (const g of goalRows) allow("goals", g.id);

    pillars.push({
      categoryId: p.id,
      categoryName: p.name,
      visionEntryId: vision?.id ?? null,
      whyItMatters: vision?.whyItMatters || null,
      whoIWantToBecome: vision?.whoIWantToBecome || null,
      standards: standardRows.map((s) => ({ id: s.id, statement: s.statement })),
      activeGoals: goalRows,
    });
  }

  // ---------------------------------------------------------------
  // Manual reflections — current week plus recent history, so a
  // repeated "this needs to change" without behavior change is
  // detectable from the user's own words, not inferred.
  // ---------------------------------------------------------------
  const reflectionWeekKeys = [weekStartDateKey, ...Array.from({ length: PRIOR_WEEKS_LOOKBACK }, (_, i) => weekStartKey(priorWeekStart(weekStart, i + 1)))];
  const reflectionRows = await db
    .select()
    .from(weeklyReflections)
    .where(inArray(weeklyReflections.weekStartDate, reflectionWeekKeys))
    .orderBy(desc(weeklyReflections.weekStartDate))
    .limit(RECENT_REFLECTIONS_MAX);
  const recentReflections = reflectionRows.map((r) => {
    allow("weekly_reflections", r.id);
    return {
      id: r.id,
      weekStartDate: r.weekStartDate,
      biggestWin: r.biggestWin,
      biggestMistake: r.biggestMistake,
      whatLearned: r.whatLearned,
      whatToChange: r.whatToChange,
    };
  });

  const weekEndDate = toDateKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));

  return {
    bundle: {
      weekStartDate: weekStartDateKey,
      weekEndDate,
      currentWeek,
      priorWeeks,
      unresolvedSignals,
      pillars,
      recentReflections,
    },
    allowedRefs,
    weeklyReviewId: currentReviewRow.id,
  };
}
