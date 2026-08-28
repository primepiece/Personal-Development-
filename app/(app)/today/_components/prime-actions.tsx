import Link from "next/link";
import {
  createDailyActionAction,
  removeActionAction,
  toggleActionStatusAction,
} from "../actions";

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

  return (
    <div>
      {actions.length === 0 ? (
        <p className="text-[13.5px] text-text-faint">Nothing picked yet — what matters today?</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex items-start justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3"
            >
              <form action={toggleActionStatusAction} className="mt-0.5">
                <input type="hidden" name="actionId" value={action.id} />
                <button
                  type="submit"
                  aria-label={action.status === "done" ? "Mark not done" : "Mark done"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-[11px] ${
                    action.status === "done"
                      ? "border-positive bg-positive text-text-on-accent"
                      : "border-border-strong text-transparent"
                  }`}
                >
                  ✓
                </button>
              </form>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/today/a/${action.id}`}
                  className={`text-[14.5px] ${
                    action.status === "done" ? "text-text-faint line-through" : "text-text-primary"
                  } hover:text-accent`}
                >
                  {action.title}
                </Link>
                <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-text-secondary">
                  <span>{action.categoryName}</span>
                  {action.linkedGoalTitle && <span>· {action.linkedGoalTitle}</span>}
                  {action.isStandalone && <span className="text-warning">· standalone</span>}
                  {action.ventureName && <span>· {action.ventureName}</span>}
                  <span>· P{action.priority}</span>
                  {action.source === "suggested" && <span>· suggested</span>}
                </p>
              </div>

              {action.status === "pending" && (
                <form action={removeActionAction}>
                  <input type="hidden" name="actionId" value={action.id} />
                  <button type="submit" className="font-mono text-[11px] text-text-faint hover:text-warning">
                    remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-4 font-mono text-[12px] text-text-faint">
          Today&apos;s five Prime Actions are set. Remove one to swap it out.
        </p>
      ) : (
        <details className="mt-4">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
            + add a Prime Action ({5 - actions.length} left)
          </summary>
          <form
            action={createDailyActionAction}
            className="mt-3 grid grid-cols-1 gap-3 rounded-sm border border-border bg-surface p-4 sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Title</span>
              <input name="title" required className="field-input" placeholder="Ship one onboarding screen" />
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
              <input name="ventureName" className="field-input" placeholder="PrimeAI" />
            </label>

            <button
              type="submit"
              className="btn-primary self-start sm:col-span-2"
            >
              Add
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
