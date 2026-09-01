import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lifeCategories } from "./categories";

/**
 * A standing rule you hold yourself to per pillar — not a target, not a
 * task. "I don't repeatedly break commitments I've made to myself."
 * Deliberately not a goal: it has no target_date and no progress bar.
 * `standard_events` (upheld/broken evidence) is Coach infrastructure and
 * arrives with Prime Coach in M5 — not needed for the cascade in M1.
 */
export const standards = pgTable("standards", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  statement: text("statement").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();
