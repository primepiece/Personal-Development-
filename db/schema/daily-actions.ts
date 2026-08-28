import { boolean, check, date, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { lifeCategories } from "./categories";
import { goals } from "./goals";
import { ventures } from "./ventures";

export const actionSourceEnum = pgEnum("action_source", ["user", "suggested"]);
export const actionStatusEnum = pgEnum("action_status", ["pending", "done", "skipped"]);

/**
 * Today's up-to-five Prime Actions. Rule: an action normally connects to
 * a weekly goal. Going without one is allowed but must be a deliberate
 * choice, not a default — is_standalone has to be explicitly true, and
 * the CHECK constraint below makes "neither linked nor marked standalone"
 * impossible to insert, not just discouraged in the UI.
 */
export const dailyActions = pgTable(
  "daily_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    title: text("title").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => lifeCategories.id),
    linkedGoalId: uuid("linked_goal_id").references(() => goals.id),
    isStandalone: boolean("is_standalone").notNull().default(false),
    ventureId: uuid("venture_id").references(() => ventures.id),
    priority: integer("priority").notNull().default(3),
    source: actionSourceEnum("source").notNull().default("user"),
    status: actionStatusEnum("status").notNull().default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "daily_actions_goal_or_explicit_standalone",
      sql`${table.linkedGoalId} is not null or ${table.isStandalone} = true`,
    ),
  ],
);
