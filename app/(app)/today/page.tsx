import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  behaviorCompletions,
  dailyActions,
  dailyReviews,
  goalRecurrence,
  goals,
  lifeCategories,
  ventures,
} from "@/db/schema";
import { computeAdherence } from "@/lib/behavior/adherence";
import { getSuggestedActions } from "@/lib/today/suggestions";
import { getDailySummary } from "@/lib/today/summary";
import { todayKey } from "@/lib/today/date";
import { getLatestMorningBrief, getMorningRecommendationReferences, getMorningRecommendations } from "@/lib/morning/query";
import { runMorningBrief } from "@/lib/morning/run";
import { resolveEvidenceLink } from "@/lib/coach/links";
import { PrimeActions } from "./_components/prime-actions";
import { SuggestedActions } from "./_components/suggested-actions";
import { RecurringSection } from "./_components/recurring-section";
import { ReviewForm } from "./_components/review-form";
import { DailySummaryPanel } from "./_components/daily-summary";
import { MorningBrief } from "./_components/morning-brief";
import type { RecommendationCardData } from "./_components/recommendation-card";

export default async function TodayPage() {
  const today = todayKey();

  const [pillars, weeklyGoalOptions, actionRows, review, summary, suggestionsRaw] =
    await Promise.all([
      db.select().from(lifeCategories).where(eq(lifeCategories.isActive, true)).orderBy(lifeCategories.sortOrder),
      db
        .select({ id: goals.id, title: goals.title, categoryName: lifeCategories.name })
        .from(goals)
        .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
        .where(and(eq(goals.tier, "weekly"), eq(goals.status, "active"))),
      db
        .select({
          id: dailyActions.id,
          title: dailyActions.title,
          categoryId: dailyActions.categoryId,
          categoryName: lifeCategories.name,
          linkedGoalId: dailyActions.linkedGoalId,
          linkedGoalTitle: goals.title,
          isStandalone: dailyActions.isStandalone,
          ventureName: ventures.name,
          priority: dailyActions.priority,
          source: dailyActions.source,
          status: dailyActions.status,
        })
        .from(dailyActions)
        .innerJoin(lifeCategories, eq(lifeCategories.id, dailyActions.categoryId))
        .leftJoin(goals, eq(goals.id, dailyActions.linkedGoalId))
        .leftJoin(ventures, eq(ventures.id, dailyActions.ventureId))
        .where(eq(dailyActions.date, today))
        .orderBy(desc(dailyActions.priority), dailyActions.createdAt),
      db.select().from(dailyReviews).where(eq(dailyReviews.date, today)).limit(1),
      getDailySummary(today),
      getSuggestedActions(5),
    ]);

  const linkedGoalIdsToday = new Set(actionRows.map((a) => a.linkedGoalId).filter(Boolean));
  const suggestions = suggestionsRaw.filter((s) => !linkedGoalIdsToday.has(s.goalId));

  const behaviorGoalRows = await db
    .select({
      id: goals.id,
      title: goals.title,
      categoryName: lifeCategories.name,
      createdAt: goals.createdAt,
    })
    .from(goals)
    .innerJoin(lifeCategories, eq(lifeCategories.id, goals.categoryId))
    .where(and(eq(goals.tier, "weekly"), eq(goals.status, "active"), eq(goals.kind, "behavior")));

  const behaviorGoalIds = behaviorGoalRows.map((g) => g.id);
  const [recurrenceRows, completionRows] = behaviorGoalIds.length
    ? await Promise.all([
        db.select().from(goalRecurrence).where(inArray(goalRecurrence.goalId, behaviorGoalIds)),
        db.select().from(behaviorCompletions).where(inArray(behaviorCompletions.goalId, behaviorGoalIds)),
      ])
    : [[], []];

  const recurrenceByGoal = new Map(recurrenceRows.map((r) => [r.goalId, r]));
  const completionsByGoal = new Map<string, typeof completionRows>();
  for (const row of completionRows) {
    const list = completionsByGoal.get(row.goalId) ?? [];
    list.push(row);
    completionsByGoal.set(row.goalId, list);
  }

  const recurringGoals = behaviorGoalRows
    .map((goal) => {
      const recurrence = recurrenceByGoal.get(goal.id);
      if (!recurrence) return null;
      const completions = completionsByGoal.get(goal.id) ?? [];
      const report = computeAdherence(recurrence, goal.createdAt, completions, new Date());
      return {
        id: goal.id,
        title: goal.title,
        categoryName: goal.categoryName,
        period: recurrence.period,
        targetFrequency: recurrence.targetFrequency,
        doneToday: completions.some((c) => c.date === today && c.completed),
        report,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  // Generate once per calendar day — if today already has a row (success
  // or failure), reuse it so a refresh never produces a different answer
  // or re-hits the model. See lib/morning/run.ts.
  let morningBriefRow = await getLatestMorningBrief(today);
  let morningRecs = morningBriefRow?.status === "ok" ? await getMorningRecommendations(morningBriefRow.id) : [];
  if (!morningBriefRow) {
    const generated = await runMorningBrief(today);
    morningBriefRow = generated.brief;
    morningRecs = generated.recommendations;
  }

  const categoryNameById = new Map(pillars.map((p) => [p.id, p.name]));
  const morningRefs = await getMorningRecommendationReferences(morningRecs.map((r) => r.id));
  const refsByRecommendation = new Map<string, typeof morningRefs>();
  for (const ref of morningRefs) {
    const list = refsByRecommendation.get(ref.recommendationId) ?? [];
    list.push(ref);
    refsByRecommendation.set(ref.recommendationId, list);
  }

  const recommendationCards: RecommendationCardData[] = await Promise.all(
    morningRecs.map(async (rec) => {
      const refs = refsByRecommendation.get(rec.id) ?? [];
      const references = await Promise.all(
        refs.map(async (ref) => ({
          refTable: ref.refTable,
          note: ref.note,
          href: await resolveEvidenceLink(ref.refTable, ref.refId),
        })),
      );
      return {
        id: rec.id,
        categoryName: categoryNameById.get(rec.categoryId) ?? "Unknown pillar",
        title: rec.title,
        reason: rec.reason,
        status: rec.status,
        editedTitle: rec.editedTitle,
        references,
      };
    }),
  );

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Today</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        What matters today?
      </h1>

      <div className="mt-10">
        <MorningBrief
          status={morningBriefRow.status}
          failureReason={morningBriefRow.failureReason}
          recommendations={recommendationCards}
        />
      </div>

      <section>
        <PrimeActions actions={actionRows} weeklyGoals={weeklyGoalOptions} pillars={pillars} />
        {suggestions.length > 0 && (
          <div className="mt-6">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
              Suggested
            </h2>
            <div className="mt-3">
              <SuggestedActions suggestions={suggestions} />
            </div>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Recurring
        </h2>
        <div className="mt-4">
          <RecurringSection goals={recurringGoals} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Today so far
        </h2>
        <div className="mt-4">
          <DailySummaryPanel summary={summary} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Evening review
        </h2>
        <div className="mt-4">
          <ReviewForm review={review[0]} />
        </div>
      </section>
    </div>
  );
}
