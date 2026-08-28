import Link from "next/link";
import { createGoalAction } from "../../actions";
import type { GoalRow } from "@/lib/goals/trace";
import { TIER_LABEL, type GoalTier } from "@/lib/goals/tiers";

export function GoalTierSection({
  categoryId,
  categorySlug,
  tier,
  goalsInTier,
  parentTier,
  parentOptions,
}: {
  categoryId: string;
  categorySlug: string;
  tier: GoalTier;
  goalsInTier: GoalRow[];
  parentTier: GoalTier | null;
  parentOptions: GoalRow[];
}) {
  return (
    <div className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-semibold text-text-primary">
          {TIER_LABEL[tier]}
        </h3>
        <span className="font-mono text-[11px] text-text-faint">
          {goalsInTier.length}
        </span>
      </div>

      {goalsInTier.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {goalsInTier.map((goal) => (
            <li key={goal.id}>
              <Link
                href={`/goals/${categorySlug}/g/${goal.id}`}
                className="flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-3 py-2.5 hover:border-border-strong"
              >
                <span className="text-[14px] text-text-primary">
                  {goal.title}
                  {goal.milestoneAge && (
                    <span className="ml-2 font-mono text-[11px] text-accent">
                      age {goal.milestoneAge}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-text-secondary">
                  {goal.kind === "behavior" ? "behavior" : "outcome"} · P{goal.priority}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
          + add {tier} goal
        </summary>
        <form
          action={createGoalAction}
          className="mt-3 grid grid-cols-1 gap-3 rounded-sm border border-border bg-surface p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="tier" value={tier} />

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="field-label">Title</span>
            <input
              name="title"
              required
              className="field-input"
              placeholder={
                tier === "milestone"
                  ? "Own two profitable businesses"
                  : "Ship the onboarding rebuild"
              }
            />
          </label>

          {parentTier && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Parent goal ({TIER_LABEL[parentTier]})</span>
              <select name="parentGoalId" required className="field-input">
                <option value="">Select a parent goal…</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
              {parentOptions.length === 0 && (
                <span className="text-[12px] text-warning">
                  No {parentTier} goals in this pillar yet — add one first.
                </span>
              )}
            </label>
          )}

          {tier === "milestone" && (
            <label className="flex flex-col gap-1">
              <span className="field-label">Age (optional)</span>
              <input
                type="number"
                name="milestoneAge"
                min={0}
                className="field-input"
                placeholder="25"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="field-label">Kind</span>
            <select name="kind" defaultValue="outcome" className="field-input">
              <option value="outcome">Outcome</option>
              <option value="behavior">Behavior (recurring)</option>
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

          <label className="flex flex-col gap-1">
            <span className="field-label">Target metric</span>
            <input name="targetMetric" className="field-input" placeholder="Net worth ($)" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="field-label">Target value</span>
            <input type="number" step="any" name="targetValue" className="field-input" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="field-label">Target date</span>
            <input type="date" name="targetDate" className="field-input" />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="field-label">Description</span>
            <textarea name="description" rows={2} className="field-input resize-y" />
          </label>

          <fieldset className="flex flex-col gap-1 sm:col-span-2 rounded-sm border border-border-strong p-3">
            <legend className="field-label px-1">Only used if kind = Behavior</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="field-label">Period</span>
                <select name="recurrencePeriod" defaultValue="week" className="field-input">
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label">Target frequency</span>
                <input type="number" min={1} name="targetFrequency" className="field-input" placeholder="4" />
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            className="btn-primary self-start sm:col-span-2"
          >
            Create {TIER_LABEL[tier]} goal
          </button>
        </form>
      </details>
    </div>
  );
}
