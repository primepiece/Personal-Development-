import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * The seven pillars Prime James is scored against. Not hardcoded as an
 * enum anywhere in the app — every other table references this table's
 * id, so a pillar can be renamed or reweighted without a migration.
 */
export const lifeCategories = pgTable("life_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
});
