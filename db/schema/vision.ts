import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lifeCategories } from "./categories";

/**
 * One current Vision per pillar — the qualitative "who I want to become"
 * register. This is where Identity lives (see who_i_want_to_become);
 * outcomes and behaviours belong in `goals`, not here.
 */
export const visionEntries = pgTable("vision_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .unique()
    .references(() => lifeCategories.id),
  whoIWantToBecome: text("who_i_want_to_become").notNull().default(""),
  lifeLooksLike: text("life_looks_like").notNull().default(""),
  longTermTargets: text("long_term_targets").notNull().default(""),
  whyItMatters: text("why_it_matters").notNull().default(""),
  refuseToBecome: text("refuse_to_become").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A full snapshot of a vision_entries row written just before it's
 * overwritten, so editing your Vision never erases what it used to say.
 */
export const visionEntryHistory = pgTable("vision_entry_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => lifeCategories.id),
  whoIWantToBecome: text("who_i_want_to_become").notNull(),
  lifeLooksLike: text("life_looks_like").notNull(),
  longTermTargets: text("long_term_targets").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  refuseToBecome: text("refuse_to_become").notNull(),
  replacedAt: timestamp("replaced_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
