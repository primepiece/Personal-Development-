import "@/lib/env";
import { db } from "@/lib/db";
import { lifeCategories } from "@/db/schema";

const PILLARS = [
  { slug: "business-wealth", name: "Business & Wealth" },
  { slug: "physical", name: "Physical" },
  { slug: "mind-discipline", name: "Mind & Discipline" },
  { slug: "relationships-network", name: "Relationships & Network" },
  { slug: "growth-skills", name: "Growth & Skills" },
  { slug: "lifestyle-experience", name: "Lifestyle & Experience" },
  { slug: "purpose-character", name: "Purpose & Character" },
] as const;

async function main() {
  for (const [index, pillar] of PILLARS.entries()) {
    await db
      .insert(lifeCategories)
      .values({ ...pillar, sortOrder: index })
      .onConflictDoNothing({ target: lifeCategories.slug });
  }
  console.log(`Seeded ${PILLARS.length} pillars.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
