import { acceptSuggestionAction } from "../actions";
import type { SuggestedAction } from "@/lib/today/suggestions";

export function SuggestedActions({ suggestions }: { suggestions: SuggestedAction[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="text-[13px] text-text-faint">
        No suggestions right now — not enough signal yet, or nothing&apos;s behind. Rules-based,
        not guessed.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((s) => (
        <li
          key={s.goalId}
          className="flex items-center justify-between gap-4 rounded-sm border border-border border-dashed bg-surface-sunken px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-[13.5px] text-text-primary">{s.title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
              {s.categoryName} · {s.reason}
            </p>
          </div>
          <form action={acceptSuggestionAction}>
            <input type="hidden" name="goalId" value={s.goalId} />
            <button
              type="submit"
              className="shrink-0 rounded-sm border border-border-strong px-3 py-1.5 font-mono text-[11px] text-text-primary"
            >
              add
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
