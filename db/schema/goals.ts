import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeCategories } from "./categories";

export const goalTierEnum = pgEnum("goal_tier", [
  "milestone",
  "annual",
  "quarterly",
  "monthly",
  "weekly",
]);

export const goalKindEnum = pgEnum("goal_kind", ["outcome", "behavior"]);

export const goalStatusEnum = pgEnum("goal_status", [
  "active",
  "done",
  "abandoned",
]);

export const recurrencePeriodEnum = pgEnum("recurrence_period", [
  "day",
  "week",
  "month",
]);

/**
 * The self-referencing cascade: milestone → annual → quarterly → monthly
 * → weekly. A root goal (parent_goal_id null) is usually tier='milestone'
 * — this is also where the old standalone age_visions table lives now,
 * as milestone_age. There's no synthetic 'vision' tier: the qualitative
 * Vision for a chain lives in vision_entries, joined by category_id once
 * you reach the root.
 */
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentGoalId: uuid("parent_goal_id").references(
    (): AnyPgColumn => goals.id,
  ),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  tier: goalTierEnum("tier").notNull(),
  kind: goalKindEnum("kind").notNull().default("outcome"),
  milestoneAge: integer("milestone_age"),
  title: text("title").notNull(),
  description: text("description"),
  targetMetric: text("target_metric"),
  targetValue: doublePrecision("target_value"),
  targetDate: date("target_date"),
  priority: integer("priority").notNull().default(3),
  status: goalStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/** Snapshot of a goal row written just before an edit overwrites it. */
export const goalHistory = pgTable("goal_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id),
  title: text("title").notNull(),
  targetMetric: text("target_metric"),
  targetValue: doublePrecision("target_value"),
  targetDate: date("target_date"),
  priority: integer("priority").notNull(),
  status: goalStatusEnum("status").notNull(),
  replacedAt: timestamp("replaced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/** The commitment shape for a kind='behavior' goal — "run 4x/week". */
export const goalRecurrence = pgTable("goal_recurrence", {
  goalId: uuid("goal_id")
    .primaryKey()
    .references(() => goals.id),
  period: recurrencePeriodEnum("period").notNull(),
  targetFrequency: integer("target_frequency").notNull(),
}).enableRLS();

/**
 * Snapshot of a goal_recurrence row written just before an edit changes
 * it — "run 4x/week" becoming "run 5x/week" shouldn't retroactively
 * change what a past week's adherence % meant. Unused until recurrence
 * editing ships (same status as goal_history in M1), wired now so the
 * migration doesn't have to happen later.
 */
export const goalRecurrenceHistory = pgTable("goal_recurrence_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => goals.id),
  period: recurrencePeriodEnum("period").notNull(),
  targetFrequency: integer("target_frequency").notNull(),
  replacedAt: timestamp("replaced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}).enableRLS();

/**
 * The actual completion log for a behavior goal. Adherence % and streak
 * are always computed from these rows against goal_recurrence — never
 * stored as a separate hand-set number. One row per (goal, day): logging
 * is a toggle, not an append, so a mis-click is undone by clicking again
 * rather than leaving duplicate rows to dedupe later.
 */
export const behaviorCompletions = pgTable(
  "behavior_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id),
    date: date("date").notNull(),
    completed: boolean("completed").notNull().default(true),
    source: text("source").notNull().default("manual"), // manual | daily_action | review_extracted
  },
  (table) => [unique("behavior_completions_goal_date").on(table.goalId, table.date)],
).enableRLS();
