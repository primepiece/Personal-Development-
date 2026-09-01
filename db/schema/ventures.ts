import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A named, owned initiative — "Prime Piece," "PrimeAI," whatever comes
 * next. Reserved primarily for Business & Wealth ownership tracking
 * (Trajectory joins here in M4), but reused now as the optional
 * venture/project tag on daily_actions so that stays a real reference
 * instead of free-text that drifts ("PrimeAI" vs "primeai" vs "Prime AI").
 */
export const ventures = pgTable("ventures", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  status: text("status").notNull().default("active"), // active | sold | shut_down
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
