"use client";

import { useState } from "react";
import Link from "next/link";
import {
  acceptMorningRecommendationAction,
  dismissMorningRecommendationAction,
  editAndAcceptMorningRecommendationAction,
} from "../morning-actions";

export type RecommendationReference = {
  refTable: string;
  note: string;
  href: string | null;
};

export type RecommendationCardData = {
  id: string;
  categoryName: string;
  title: string;
  reason: string;
  status: "pending" | "accepted" | "edited_accepted" | "dismissed";
  editedTitle: string | null;
  references: RecommendationReference[];
};

const STATUS_LABEL: Record<string, string> = {
  accepted: "✓ added to today",
  edited_accepted: "✓ added (edited)",
  dismissed: "dismissed",
};

export function RecommendationCard({ rec }: { rec: RecommendationCardData }) {
  const [editing, setEditing] = useState(false);

  if (rec.status !== "pending") {
    return (
      <li className="rounded-sm border border-border bg-surface-sunken px-4 py-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-faint">
          {rec.categoryName}
        </p>
        <p
          className={`mt-1 text-[14px] ${
            rec.status === "dismissed" ? "text-text-faint line-through" : "text-text-primary"
          }`}
        >
          {rec.status === "edited_accepted" && rec.editedTitle ? rec.editedTitle : rec.title}
        </p>
        <p
          className={`mt-1.5 font-mono text-[11px] ${
            rec.status === "dismissed" ? "text-text-faint" : "text-positive"
          }`}
        >
          {STATUS_LABEL[rec.status]}
        </p>
      </li>
    );
  }

  return (
    <li className="rounded-sm border border-border bg-surface px-4 py-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-faint">{rec.categoryName}</p>
      <p className="mt-1.5 text-[15px] text-text-primary">{rec.title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{rec.reason}</p>

      {rec.references.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {rec.references.map((ref, i) => (
            <li key={i} className="font-mono text-[10.5px] text-text-faint">
              {ref.href ? (
                <Link href={ref.href} className="hover:text-accent">
                  {ref.note}
                </Link>
              ) : (
                ref.note
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form
          action={editAndAcceptMorningRecommendationAction}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="recommendationId" value={rec.id} />
          <input name="title" defaultValue={rec.title} required className="field-input flex-1" />
          <div className="flex shrink-0 gap-3">
            <button type="submit" className="btn-primary shrink-0">
              Save &amp; accept
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="shrink-0 font-mono text-[11px] text-text-faint hover:text-text-primary"
            >
              cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <form action={acceptMorningRecommendationAction}>
            <input type="hidden" name="recommendationId" value={rec.id} />
            <button type="submit" className="btn-primary">
              Accept
            </button>
          </form>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-[11px] text-text-faint hover:text-text-primary"
          >
            edit &amp; accept
          </button>
          <form action={dismissMorningRecommendationAction}>
            <input type="hidden" name="recommendationId" value={rec.id} />
            <button type="submit" className="font-mono text-[11px] text-text-faint hover:text-warning">
              dismiss
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
