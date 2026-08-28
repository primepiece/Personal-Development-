import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One review per day. raw_text is never touched by anything but the
 * person writing it — later AI extraction (M5+) writes to a separate
 * jsonb column, never overwrites this. Editing raw_text/ratings snapshots
 * the prior version to daily_review_history first, same pattern as
 * vision_entries: a past day's account of itself shouldn't be silently
 * rewritable.
 */
export const dailyReviews = pgTable("daily_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull().unique(),
  rawText: text("raw_text").notNull(),
  energyRating: integer("energy_rating"), // 1-10, optional
  dayRating: integer("day_rating"), // 1-10, optional
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyReviewHistory = pgTable("daily_review_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  rawText: text("raw_text").notNull(),
  energyRating: integer("energy_rating"),
  dayRating: integer("day_rating"),
  replacedAt: timestamp("replaced_at", { withTimezone: true }).notNull().defaultNow(),
});
