/**
 * Live Prime Coach test suite — makes REAL, BILLED calls to the Anthropic
 * API (model: claude-opus-5). Run this deliberately, with ANTHROPIC_API_KEY
 * set, against a database you don't mind seeding test data into (a local
 * or staging Postgres — never production).
 *
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/test-coach-live.ts
 *
 * Seeds eight scenarios in isolated, far-past weeks (so they never collide
 * with real data), generates a real Weekly Review for each, then asks
 * Prime Coach for a real Prime Brief and prints the full output.
 *
 * This script does not assert pass/fail on the model's actual language —
 * that's a judgment call only a human can make. Read each printed brief
 * against this checklist before trusting Coach's tone:
 *
 *   - No "Great job!", "You've got this!", or generic encouragement
 *   - No therapy-style language ("it sounds like...", "how does that feel")
 *   - Direct, concise, specific to what this scenario's data actually shows
 *   - Any "contradiction" field states a fact pattern, never invented
 *     psychology, unless a seeded reflection explicitly says it
 *   - Every evidence reference resolves to something real (already
 *     enforced programmatically — a hallucinated reference makes the
 *     whole brief fail closed, printed below as status=failed)
 *   - Could this have been written for literally any user, any week?
 *     If yes, it has failed regardless of what the checks below say.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  coachSignals,
  dailyActions,
  dailyReviews,
  goals,
  lifeCategories,
  trajectoryCheckpoints,
  trajectoryMetrics,
  visionEntries,
  weeklyReflections,
} from "@/db/schema";
import { toDateKey } from "@/lib/today/date";
import { startOfWeek } from "@/lib/weekly/date";
import { snapshotWeeklyReview } from "@/lib/weekly/compute";
import { runWeeklyCoachBrief } from "@/lib/coach/run";

async function categoryBySlug(slug: string) {
  const [c] = await db.select().from(lifeCategories).where(eq(lifeCategories.slug, slug)).limit(1);
  if (!c) throw new Error(`missing category ${slug}`);
  return c;
}

const CUR_WEEK = startOfWeek(new Date());
function weekStart(weeksAgo: number): Date {
  const d = new Date(CUR_WEEK);
  d.setDate(d.getDate() - weeksAgo * 7);
  return d;
}
function dateInWeek(weeksAgo: number, dayOffset: number): Date {
  const d = weekStart(weeksAgo);
  d.setDate(d.getDate() + dayOffset);
  return d;
}
function dateKeyInWeek(weeksAgo: number, dayOffset: number): string {
  return toDateKey(dateInWeek(weeksAgo, dayOffset));
}

async function runScenario(name: string, weeksAgo: number, seed: () => Promise<void>) {
  console.log(`\n${"=".repeat(70)}\n${name}  (week ${weekStart(weeksAgo).toISOString().slice(0, 10)})\n${"=".repeat(70)}`);
  await seed();
  await snapshotWeeklyReview(weekStart(weeksAgo));
  const brief = await runWeeklyCoachBrief(weekStart(weeksAgo));
  if (brief.status === "failed") {
    console.log(`STATUS: failed — ${brief.failureReason}`);
    return;
  }
  console.log(`STATUS: ok  (confidence: ${brief.confidence})\n`);
  console.log(`THE WEEK\n${brief.summary}\n`);
  console.log(`WHAT MOVED\n${brief.progress}\n`);
  console.log(`WHAT'S OFF\n${brief.concern}\n`);
  if (brief.contradiction) console.log(`CONTRADICTION\n${brief.contradiction}\n`);
  console.log(`THE CALL\n${brief.recommendation}\n`);
  console.log(`NEXT WEEK\n${(brief.nextWeekPriorities as string[]).map((p, i) => `  ${i + 1}. ${p}`).join("\n")}`);
}

async function main() {
  const business = await categoryBySlug("business-wealth");
  const physical = await categoryBySlug("physical");
  const growth = await categoryBySlug("growth-skills");

  await runScenario("1. Genuinely strong week", 10, async () => {
    const w = 10;
    for (let d = 0; d < 5; d++) {
      await db.insert(dailyActions).values({ date: dateKeyInWeek(w, d), title: `Prime action ${d + 1}`, categoryId: business.id, isStandalone: true, status: "done", priority: 4 });
    }
    await db.insert(dailyReviews).values({ date: dateKeyInWeek(w, 6), rawText: "Strong week across the board.", energyRating: 8, dayRating: 8 });
  });

  await runScenario("2. Off-track week (critical signal)", 11, async () => {
    const w = 11;
    const [goal] = await db.insert(goals).values({ categoryId: business.id, tier: "weekly", title: "Close the Series A deck", priority: 5, createdAt: dateInWeek(w, 0) }).returning();
    await db.insert(coachSignals).values({
      type: "priority_neglected", severity: "critical", importance: 5, categoryId: business.id, goalId: goal.id,
      detectedAt: dateInWeek(w, 1), status: "active", evidence: { goalTitle: goal.title, priority: 5, daysSinceTouch: 14 },
    });
  });

  await runScenario("3. Mixed week (one warning, some real progress)", 12, async () => {
    const w = 12;
    await db.insert(coachSignals).values({
      type: "pillar_neglected", severity: "warning", importance: 3, categoryId: growth.id, goalId: null,
      detectedAt: dateInWeek(w, 1), status: "active", evidence: { categoryName: growth.name, daysSinceTouch: 8 },
    });
    await db.insert(dailyActions).values({ date: dateKeyInWeek(w, 2), title: "Ship a real feature", categoryId: business.id, isStandalone: true, status: "done", priority: 4 });
  });

  await runScenario("4. Establishing-baseline week (near-empty account)", 20, async () => {
    // Deliberately minimal — this week should read as honestly thin, not padded out.
  });

  await runScenario("5. High activity, poor outcome trajectory", 13, async () => {
    const w = 13;
    const [outcomeGoal] = await db.insert(goals).values({ categoryId: physical.id, tier: "milestone", title: "Run sub-90 half marathon", kind: "outcome", priority: 4, createdAt: weekStart(w + 4) }).returning();
    const [metric] = await db
      .insert(trajectoryMetrics)
      .values({ name: "Half Marathon PB", categoryId: physical.id, linkedGoalId: outcomeGoal.id, unit: "seconds", direction: "lower_is_better", targetValue: 89 * 60 + 59, targetDate: toDateKey(dateInWeek(w - 8, 0)), createdAt: weekStart(w + 4) })
      .returning();
    for (const [wk, v] of [[w + 3, 100 * 60], [w + 2, 99 * 60 + 45], [w + 1, 99 * 60 + 30], [w, 99 * 60 + 15]] as const) {
      await db.insert(trajectoryCheckpoints).values({ metricId: metric.id, asOfDate: dateKeyInWeek(wk, 3), value: v });
    }
    for (let d = 0; d < 6; d++) {
      await db.insert(dailyActions).values({ date: dateKeyInWeek(w, d), title: `Training session ${d + 1}`, categoryId: physical.id, isStandalone: true, status: "done", priority: 3 });
    }
  });

  await runScenario("6. Neglected high-priority goal (with vision + standard context)", 14, async () => {
    const w = 14;
    await db.insert(visionEntries).values({ categoryId: business.id, whoIWantToBecome: "Financially independent through owned businesses.", whyItMatters: "Everything else in my life depends on not needing a job." }).onConflictDoNothing();
    const [goal] = await db.insert(goals).values({ categoryId: business.id, tier: "weekly", title: "Launch the paid tier", priority: 5, createdAt: dateInWeek(w, 0) }).returning();
    await db.insert(coachSignals).values({
      type: "priority_neglected", severity: "critical", importance: 5, categoryId: business.id, goalId: goal.id,
      detectedAt: dateInWeek(w, 2), status: "active", evidence: { goalTitle: goal.title, priority: 5, daysSinceTouch: 16 },
    });
  });

  await runScenario("7. Repeated issue across multiple Weekly Reviews", 15, async () => {
    const [recGoal] = await db.insert(goals).values({ categoryId: business.id, tier: "weekly", title: "Recurring neglected initiative", priority: 5, createdAt: weekStart(18) }).returning();
    // One signal, detected in week 17 and never resolved — still active through week 15 — so
    // each week's own review genuinely shows the same condition persisting, not three fabricated copies.
    await db.insert(coachSignals).values({
      type: "priority_neglected", severity: "critical", importance: 5, categoryId: business.id, goalId: recGoal.id,
      detectedAt: dateInWeek(17, 1), status: "active", evidence: { goalTitle: recGoal.title, priority: 5, daysSinceTouch: 24 },
    });
    for (const w of [17, 16, 15]) {
      await snapshotWeeklyReview(weekStart(w));
      await db
        .insert(weeklyReflections)
        .values({ weekStartDate: toDateKey(weekStart(w)), biggestMistake: "Still haven't touched the recurring initiative.", whatToChange: "Actually start it this time." })
        .onConflictDoNothing();
    }
  });

  await runScenario("8. Insufficient evidence (thin week, honest qualification expected)", 21, async () => {
    await db.insert(dailyActions).values({ date: dateKeyInWeek(21, 0), title: "One lonely action", categoryId: growth.id, isStandalone: true, status: "pending", priority: 2 });
  });

  console.log(`\n${"=".repeat(70)}\nDone. Also try, separately: toggle a behavior goal's recurrence to\nsimulate improving/declining adherence, and manually corrupt an\nevidenceReferences id in lib/coach/generate.ts temporarily to confirm\nthe hallucination path still fails closed end-to-end through a real\nmodel call (not just the deterministic validator).\n${"=".repeat(70)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
