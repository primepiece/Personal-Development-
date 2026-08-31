import { date, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lifeCategories } from "./categories";
import { goals } from "./goals";
import { dailyActions } from "./daily-actions";

export const morningBriefStatusEnum = pgEnum("morning_brief_status", ["ok", "failed"]);

/**
 * One generation attempt per calendar day — unlike coach_briefs (which
 * allows repeated manual "Regenerate" attempts per week), a Morning Brief
 * is a single automatic once-a-day nudge: the Today page generates one
 * only if no row exists yet for today, so a refresh never produces a
 * different answer or re-hits the model. If that one attempt fails, the
 * failure row stands for the day rather than retrying on every reload.
 *
 * Same discipline as coach_briefs otherwise: insert-only, `evidenceBundle`
 * freezes the entire deterministic input, narrative fields stay null on
 * failure, and the UI has no path to render a failed row as trusted.
 */
export const morningBriefs = pgTable("morning_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  model: text("model").notNull(),
  status: morningBriefStatusEnum("status").notNull(),
  failureReason: text("failure_reason"),
  evidenceBundle: jsonb("evidence_bundle").notNull(),
});

export const morningRecommendationStatusEnum = pgEnum("morning_recommendation_status", [
  "pending",
  "accepted",
  "edited_accepted",
  "dismissed",
]);

/**
 * One row per recommendation slot (rank 1-3), populated only when the
 * parent brief's status = 'ok'. Tracks its own lifecycle independently of
 * the day's Prime Actions so a later evaluation can ask "were Prime
 * James's recommendations actually useful" — accepted/edited/dismissed
 * counts, not just what was shown. `resultingActionId` is set only once
 * accepted or edited-and-accepted, pointing at the real daily_actions row
 * created through the exact same write path manual/suggested actions use.
 */
export const morningRecommendations = pgTable("morning_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  briefId: uuid("brief_id")
    .notNull()
    .references(() => morningBriefs.id),
  rank: integer("rank").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  linkedGoalId: uuid("linked_goal_id").references(() => goals.id),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  status: morningRecommendationStatusEnum("status").notNull().default("pending"),
  editedTitle: text("edited_title"),
  resultingActionId: uuid("resulting_action_id").references(() => dailyActions.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

/** Same shape as coach_brief_references, applied to a recommendation instead of a brief. */
export const morningRecommendationReferences = pgTable("morning_recommendation_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendationId: uuid("recommendation_id")
    .notNull()
    .references(() => morningRecommendations.id),
  refTable: text("ref_table").notNull(),
  refId: uuid("ref_id").notNull(),
  note: text("note").notNull(),
});
