import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const dogfoodCategoryEnum = pgEnum("dogfood_category", [
  "friction",
  "missing_capability",
  "confusing_ui",
  "bad_calculation",
  "bad_recommendation",
  "coach_quality",
  "bug",
]);

/**
 * Append-only. This is a log of what real usage reveals during M6.5, not
 * an issue tracker — no status workflow, no auto-triage. The point is to
 * collect evidence before deciding what's worth building, not to turn
 * every entry into a task the moment it's written down.
 */
export const dogfoodLog = pgTable("dogfood_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: dogfoodCategoryEnum("category").notNull(),
  note: text("note").notNull(),
  context: text("context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
