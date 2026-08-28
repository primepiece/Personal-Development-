import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * The seven pillars Prime James is scored against. Every other table in
 * the schema carries a category_id foreign key back to this table, and
 * years of historical data end up hanging off these seven rows — so their
 * identity has to be stable for the life of the app:
 *
 *  - `id` and `slug` are IMMUTABLE. Nothing in the app ever writes to
 *    them after the seed script creates them. Treat a slug change as
 *    "create a new pillar," never as "rename this one."
 *  - `name` is the only field anyone should ever update — the display
 *    label can change without touching the identity every other table
 *    references.
 *  - Pillars are never hard-deleted. `is_active` is how one gets retired;
 *    every table that references category_id keeps a valid foreign key
 *    forever, so historical records never lose their pillar association.
 *    (There's no delete path in the app for this table at all — the
 *    foreign keys from vision_entries/standards/goals would reject it
 *    anyway once real data exists.)
 */
export const lifeCategories = pgTable("life_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});
