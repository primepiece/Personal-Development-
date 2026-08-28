import { date, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Insert-only, same pattern as category_scores — a Weekly Review is never
 * rewritten in place. `snapshot` freezes the entire deterministic bundle
 * (every section of the review, plus the evidence bundle handed to a
 * future Coach) exactly as computed at `computedAt`, so a later change to
 * a formula, or new data logged after the fact, can never silently
 * rewrite what an old review said. Regenerating a week's review inserts
 * a new row rather than updating the old one; the latest row per
 * `weekStartDate` is "the" review shown by default, but every prior
 * generation stays queryable.
 *
 * `trajectoryState` is pulled out of `snapshot` as its own column purely
 * so week-over-week comparisons (this week vs last week vs 4-week trend)
 * don't have to reach into jsonb for the one field they need most.
 */
export const weeklyReviews = pgTable("weekly_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStartDate: date("week_start_date").notNull(),
  weekEndDate: date("week_end_date").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  trajectoryState: text("trajectory_state").notNull(),
  snapshot: jsonb("snapshot").notNull(),
});

/**
 * The one current reflection per week — same current+history pattern as
 * daily_reviews / vision_entries. Lightweight and entirely optional;
 * editing it snapshots the previous version first, so a past week's
 * reflection can't be silently rewritten either.
 */
export const weeklyReflections = pgTable("weekly_reflections", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStartDate: date("week_start_date").notNull().unique(),
  biggestWin: text("biggest_win").notNull().default(""),
  biggestMistake: text("biggest_mistake").notNull().default(""),
  whatLearned: text("what_learned").notNull().default(""),
  whatToChange: text("what_to_change").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyReflectionHistory = pgTable("weekly_reflection_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStartDate: date("week_start_date").notNull(),
  biggestWin: text("biggest_win").notNull(),
  biggestMistake: text("biggest_mistake").notNull(),
  whatLearned: text("what_learned").notNull(),
  whatToChange: text("what_to_change").notNull(),
  replacedAt: timestamp("replaced_at", { withTimezone: true }).notNull().defaultNow(),
});
