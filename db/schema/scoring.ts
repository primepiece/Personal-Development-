import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeCategories } from "./categories";

export const scoreConfidenceEnum = pgEnum("score_confidence", [
  "insufficient",
  "low",
  "medium",
  "high",
]);

export const scoreTrendEnum = pgEnum("score_trend", ["up", "flat", "down"]);

/**
 * Insert-only time series — a pillar score snapshot, never updated in
 * place. `breakdown` embeds the exact components, weights, periods and
 * calculation text used to produce `score` at that moment, so a later
 * change to the scoring formula can never silently rewrite what an old
 * snapshot meant — the old row still explains itself on its own terms.
 *
 * `score` and `trend` are nullable on purpose: "insufficient data" is a
 * real, storable state, not a fallback the UI invents.
 */
export const categoryScores = pgTable("category_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  score: doublePrecision("score"),
  confidence: scoreConfidenceEnum("confidence").notNull(),
  trend: scoreTrendEnum("trend"),
  breakdown: jsonb("breakdown").notNull(),
}).enableRLS();

export const signalTypeEnum = pgEnum("signal_type", [
  "priority_neglected",
  "deadline_at_risk",
  "adherence_declining",
  "adherence_improving",
  "consistency_streak",
  "pillar_neglected",
  "action_completion_falling",
  "goal_completed",
]);

export const signalSeverityEnum = pgEnum("signal_severity", [
  "info",
  "warning",
  "critical",
]);

/**
 * new — just appeared this detector run, never surfaced before.
 * active — still true, has been seen in at least one prior run.
 * acknowledged — you've explicitly said "I know, still tracking it" (the
 *   condition can still be true; this just stops it reading as unseen).
 * resolved — the underlying condition is no longer true. System-driven
 *   only; never set by a user action.
 * suppressed — you've explicitly said "stop showing me this," independent
 *   of whether the condition is still true. Stays quiet even if it
 *   resolves later; the row is kept for the record, not deleted.
 */
export const signalStatusEnum = pgEnum("signal_status", [
  "new",
  "active",
  "acknowledged",
  "resolved",
  "suppressed",
]);

/**
 * A deterministic Layer 1 signal — no model call anywhere near this
 * table. `evidence` is a compact, human-checkable summary (counts,
 * dates); `coach_signal_references` below is what the summary actually
 * proves — real rows, not prose. Reconciled on every detector run: a
 * still-true condition never duplicates its row, a no-longer-true one
 * gets resolved rather than left to rot as a stale claim.
 *
 * `severity` and `importance` are deliberately separate axes. Severity
 * is how bad the technical breach is (how many days neglected, how close
 * the deadline). Importance is how much this goal or pillar is supposed
 * to matter — for a goal-scoped signal it's that goal's own priority;
 * for a pillar-scoped one it's the highest priority among that pillar's
 * active goals. A critical deadline miss on a priority-2 goal and a
 * moderate neglect of a priority-5 goal are not the same problem, and
 * Coach needs both numbers to rank them, not one blended score.
 */
export const coachSignals = pgTable("coach_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: signalTypeEnum("type").notNull(),
  severity: signalSeverityEnum("severity").notNull(),
  importance: integer("importance").notNull().default(3),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  goalId: uuid("goal_id"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  status: signalStatusEnum("status").notNull().default("new"),
  evidence: jsonb("evidence").notNull(),
  narrativeText: text("narrative_text"),
}).enableRLS();

/** One row per source record behind a signal's claim — the "why are you saying this" join target. */
export const coachSignalReferences = pgTable("coach_signal_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  signalId: uuid("signal_id")
    .notNull()
    .references(() => coachSignals.id),
  refTable: text("ref_table").notNull(),
  refId: uuid("ref_id").notNull(),
}).enableRLS();
