import { date, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { weeklyReviews } from "./weekly-review";

export const coachBriefStatusEnum = pgEnum("coach_brief_status", ["ok", "failed"]);

/**
 * One row per generation attempt — insert-only, same discipline as
 * category_scores and weekly_reviews. A brief is never regenerated in
 * place: asking for a new one for the same week inserts a fresh row, so
 * "what was Prime Coach telling me six months ago" stays answerable
 * exactly as it was said, even if the underlying data or the model
 * later changes.
 *
 * `evidenceBundle` freezes the *entire* deterministic input handed to
 * the model — not just a pointer to weekly_reviews, since the bundle
 * also includes prior weeks, unresolved signals, goal hierarchy, vision,
 * standards and reflections that can each change independently of the
 * pinned `weeklyReviewId`. `weeklyReviewId` stays as a fast join target
 * for "which week is this."
 *
 * `status = 'failed'` rows exist purely as an audit trail (the model
 * call errored, schema validation failed, or an evidence reference
 * didn't resolve against the whitelist) — the narrative fields stay
 * null and the UI must never render a failed row as if it were trusted
 * coaching. The deterministic Weekly Review remains fully usable
 * whether or not Coach is available at all.
 */
export const coachBriefs = pgTable("coach_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStartDate: date("week_start_date").notNull(),
  weeklyReviewId: uuid("weekly_review_id")
    .notNull()
    .references(() => weeklyReviews.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  model: text("model").notNull(),
  status: coachBriefStatusEnum("status").notNull(),
  failureReason: text("failure_reason"),
  evidenceBundle: jsonb("evidence_bundle").notNull(),

  // Populated only when status = 'ok'.
  summary: text("summary"),
  progress: text("progress"),
  concern: text("concern"),
  contradiction: text("contradiction"),
  recommendation: text("recommendation"),
  nextWeekPriorities: jsonb("next_week_priorities"),
  confidence: text("confidence"),
});

/**
 * Same shape as coach_signal_references, applied to a new parent — one
 * row per real database record behind a Prime Brief claim. This is what
 * "Why are you saying this?" queries for a Coach claim, exactly like it
 * already does for a signal.
 */
export const coachBriefReferences = pgTable("coach_brief_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  briefId: uuid("brief_id")
    .notNull()
    .references(() => coachBriefs.id),
  refTable: text("ref_table").notNull(),
  refId: uuid("ref_id").notNull(),
  note: text("note").notNull(),
});
