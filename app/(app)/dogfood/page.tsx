import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dogfoodLog } from "@/db/schema";
import { addDogfoodEntryAction } from "./actions";

const CATEGORY_LABEL: Record<string, string> = {
  friction: "Friction",
  missing_capability: "Missing capability",
  confusing_ui: "Confusing UI",
  bad_calculation: "Bad calculation",
  bad_recommendation: "Bad recommendation",
  coach_quality: "Coach quality",
  bug: "Bug",
};

export default async function DogfoodPage() {
  const entries = await db.select().from(dogfoodLog).orderBy(desc(dogfoodLog.createdAt));

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">M6.5</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        Dogfood log
      </h1>
      <p className="mt-2 max-w-[62ch] text-[14.5px] text-text-secondary">
        Whatever goes wrong or feels off while actually using the app — write it down here, don&apos;t
        fix it on reflex. This is evidence for what to build next, not a task list.
      </p>

      <form action={addDogfoodEntryAction} className="mt-8 flex flex-col gap-4 rounded-sm border border-border bg-surface px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Category</span>
            <select name="category" defaultValue="friction" className="field-input">
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Where (optional)</span>
            <input name="context" placeholder="e.g. /today, evening review" className="field-input" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">What happened</span>
          <textarea name="note" required rows={3} placeholder="Be specific — what you expected vs. what happened." className="field-input resize-y" />
        </label>
        <button type="submit" className="btn-primary self-start">
          Log it
        </button>
      </form>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          {entries.length} logged
        </h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-text-faint">Nothing logged yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-sm border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-accent">
                    {CATEGORY_LABEL[e.category]}
                  </span>
                  <span className="font-mono text-[11px] text-text-faint">
                    {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-text-primary">{e.note}</p>
                {e.context && <p className="mt-1 font-mono text-[11px] text-text-secondary">{e.context}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
