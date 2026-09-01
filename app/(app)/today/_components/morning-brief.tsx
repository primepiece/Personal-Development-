"use client";

import { useState } from "react";
import { RecommendationCard, type RecommendationCardData } from "./recommendation-card";

export function MorningBrief({
  status,
  failureReason,
  recommendations,
}: {
  status: "ok" | "failed";
  failureReason?: string | null;
  recommendations: RecommendationCardData[];
}) {
  const allDecided = recommendations.length > 0 && recommendations.every((r) => r.status !== "pending");
  // No override yet -> derive from allDecided (auto-collapses the instant
  // the last recommendation is decided). Once the user clicks View or
  // collapse, that explicit choice wins — and since a fully decided brief
  // never changes again, it never gets silently overridden afterward.
  // Purely presentation: the brief and every recommendation's history
  // stay exactly as persisted either way.
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const expanded = userOverride ?? !allDecided;

  if (status === "failed") {
    return (
      <section className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Morning Brief</p>
        <p className="mt-3 max-w-[62ch] text-[13.5px] text-text-secondary">
          Morning Mentor couldn&apos;t produce a trustworthy brief this morning
          {failureReason ? `: ${failureReason}` : "."} Nothing untrusted is shown — pick today&apos;s
          Prime Actions yourself below.
        </p>
      </section>
    );
  }

  if (allDecided && !expanded) {
    return (
      <section className="mb-8">
        <button
          type="button"
          onClick={() => setUserOverride(true)}
          className="flex w-full items-center justify-between gap-3 rounded-sm border border-border bg-surface-sunken px-4 py-3 text-left"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Morning Brief <span className="text-positive">✓</span> {recommendations.length} recommendation
            {recommendations.length === 1 ? "" : "s"} reviewed
          </span>
          <span className="shrink-0 font-mono text-[11px] text-text-faint hover:text-accent">View</span>
        </button>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Morning Brief</p>
        {allDecided && (
          <button
            type="button"
            onClick={() => setUserOverride(false)}
            className="font-mono text-[11px] text-text-faint hover:text-text-primary"
          >
            collapse
          </button>
        )}
      </div>
      <p className="mt-2 text-[16px] text-text-primary">
        Good morning James. Here&apos;s what I think matters today.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </ul>
    </section>
  );
}
