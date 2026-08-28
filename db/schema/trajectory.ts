import { boolean, date, doublePrecision, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lifeCategories } from "./categories";
import { goals } from "./goals";
import { ventures } from "./ventures";

export const metricDirectionEnum = pgEnum("metric_direction", [
  "higher_is_better",
  "lower_is_better",
]);

/**
 * A generic, pluggable measurement — no hard-coded net_worth or
 * half_marathon_pb columns anywhere. "Net Worth," "Owned Business
 * Revenue," "Half Marathon PB" are just rows here, distinguished by
 * name/unit/direction, not by schema. `linkedGoalId` is what lets an
 * outcome goal have real, non-fabricated progress: the goal points at a
 * metric, the metric's checkpoints are the evidence.
 *
 * `baselineValue` is a declared starting reference ("when I started
 * tracking this, it was roughly $X") — separate from checkpoints on
 * purpose, and never used in projection math, so an imprecise starting
 * guess can't quietly contaminate a real trend calculation.
 */
export const trajectoryMetrics = pgTable("trajectory_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  ventureId: uuid("venture_id").references(() => ventures.id),
  linkedGoalId: uuid("linked_goal_id").references(() => goals.id),
  unit: text("unit").notNull(),
  direction: metricDirectionEnum("direction").notNull(),
  targetValue: doublePrecision("target_value"),
  targetDate: date("target_date"),
  baselineValue: doublePrecision("baseline_value"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only. Nothing in this app ever updates or deletes a checkpoint
 * — a correction is a new row, not a rewrite, so "what did I believe on
 * that date" stays answerable forever. `asOfDate` is when the value was
 * true; `createdAt` is when it was logged, which can differ if you
 * backfill history.
 */
export const trajectoryCheckpoints = pgTable("trajectory_checkpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  metricId: uuid("metric_id")
    .notNull()
    .references(() => trajectoryMetrics.id),
  asOfDate: date("as_of_date").notNull(),
  value: doublePrecision("value").notNull(),
  source: text("source").notNull().default("manual"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
