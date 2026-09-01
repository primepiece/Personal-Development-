"use client";

import { useState } from "react";
import Link from "next/link";
import { editDailyActionAction, removeActionAction, toggleActionStatusAction } from "../actions";
import type { ActionRow } from "./prime-actions";

/**
 * One Prime Action, rendered as a daily-execution card: the action itself
 * dominates (large tap target + large title), pillar/linked-goal context
 * is present but visually secondary, and Edit/Remove are clearly
 * secondary actions rather than competing with the title.
 */
export function ActionCard({ action }: { action: ActionRow }) {
  const [editing, setEditing] = useState(false);
  const isDone = action.status === "done";

  if (editing) {
    return (
      <li className="rounded-sm border border-border-strong bg-surface px-4 py-4 sm:px-5 sm:py-5">
        <form action={editDailyActionAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="hidden" name="actionId" value={action.id} />
          <input
            name="title"
            defaultValue={action.title}
            required
            autoFocus
            className="field-input flex-1 py-2.5 text-[16px]"
          />
          <div className="flex shrink-0 gap-4">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="font-mono text-[12px] text-text-faint hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`flex flex-col gap-3 rounded-sm border px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-5 ${
        isDone ? "border-border bg-surface-sunken" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-1 items-start gap-4">
        <form action={toggleActionStatusAction} className="mt-0.5 shrink-0">
          <input type="hidden" name="actionId" value={action.id} />
          <button
            type="submit"
            aria-label={isDone ? "Mark not done" : "Mark done"}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-2 text-[16px] transition-colors ${
              isDone
                ? "border-positive bg-positive text-text-on-accent"
                : "border-border-strong text-transparent hover:border-accent"
            }`}
          >
            ✓
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <Link
            href={`/today/a/${action.id}`}
            className={`block text-[17px] font-medium leading-snug sm:text-[18px] ${
              isDone ? "text-text-faint line-through" : "text-text-primary"
            } hover:text-accent`}
          >
            {action.title}
          </Link>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-secondary">
            {action.categoryName}
          </p>
          {(action.linkedGoalTitle || action.isStandalone || action.ventureName) && (
            <p className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-text-faint">
              {action.linkedGoalTitle && <span>{action.linkedGoalTitle}</span>}
              {action.isStandalone && <span className="text-warning">standalone</span>}
              {action.ventureName && <span>{action.ventureName}</span>}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 pl-12 sm:flex-col sm:items-end sm:gap-2 sm:pl-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono text-[12px] text-text-faint hover:text-text-primary"
        >
          Edit
        </button>
        {action.status === "pending" && (
          <form action={removeActionAction}>
            <input type="hidden" name="actionId" value={action.id} />
            <button type="submit" className="font-mono text-[12px] text-text-faint hover:text-warning">
              Remove
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
