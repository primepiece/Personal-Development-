import { ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { ventures } from "@/db/schema";

/** Case-insensitive find-or-create by name, so "PrimeAI" and "primeai" resolve to the same venture. */
export async function findOrCreateVenture(name: string): Promise<string> {
  const [existing] = await db.select().from(ventures).where(ilike(ventures.name, name)).limit(1);
  if (existing) return existing.id;

  const [created] = await db.insert(ventures).values({ name }).returning();
  return created.id;
}
