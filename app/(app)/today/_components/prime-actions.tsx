import { createDailyActionAction } from "../actions";
import { ActionCard } from "./action-card";

export type ActionRow = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  linkedGoalId: string | null;
  linkedGoalTitle: string | null;
  isStandalone: boolean;
  ventureName: string | null;
  priority: number;
  source: "user" | "suggested";
  status: "pending" | "done" | "skipped";
};

export type WeeklyGoalOption = {
  id: string;
  title: string;
  categoryName: string;
};

export type PillarOption = { id: string; name: string };

export function PrimeActions({
  actions,
  weeklyGoals,
  pillars,
}: {
  actions: ActionRow[];
  weeklyGoals: WeeklyGoalOption[];
  pillars: PillarOption[];
}) {
  const full = actions.length >= 5;
  const doneCount = actions.filter((a) => a.status === "done").length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
          Today&apos;s Prime Actions
        </h2>
        <span className="font-mono text-[11px] text-text-faint">
          {doneCount}/{actions.length}
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-text-faint">Nothing picked yet — what matters today?</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {actions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-4 font-mono text-[12px] text-text-faint">
          Today&apos;s five Prime Actions are set. Remove one to swap it out.
        </p>
      ) : (
        <details className="mt-4">
          <summary className="cursor-pointer py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
            + add a Prime Action ({5 - actions.length} left)
          </summary>
          <form
            action={createDailyActionAction}
            className="mt-3 grid grid-cols-1 gap-3 rounded-sm border border-border bg-surface p-4 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Title</span>
              <input
                name="title"
                required
                className="field-input py-2.5 text-[16px]"
                placeholder="Ship one onboarding screen"
              />
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Link to a weekly goal</span>
              <select name="linkedGoalId" defaultValue="" className="field-input">
                <option value="">— none —</option>
                {weeklyGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.categoryName} — {g.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 sm:col-span-2 text-[13px] text-text-secondary">
              <input type="checkbox" name="isStandalone" />
              This is standalone — not linked to any goal (must be intentional, not a default)
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Pillar (only used if standalone)</span>
              <select name="categoryId" defaultValue="" className="field-input">
                <option value="">— select —</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">Priority</span>
              <select name="priority" defaultValue="3" className="field-input">
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Venture / project (optional)</span>
              <input name="ventureName" className="field-input py-2.5 text-[16px]" placeholder="PrimeAI" />
            </label>

            <button type="submit" className="btn-primary self-start py-2.5 sm:col-span-2">
              Add
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
