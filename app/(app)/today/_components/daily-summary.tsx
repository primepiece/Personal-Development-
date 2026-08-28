import type { DailySummary } from "@/lib/today/summary";

export function DailySummaryPanel({ summary }: { summary: DailySummary }) {
  const lines: string[] = [
    `${summary.actionsDone}/${summary.actionsTotal || 0} Prime Actions completed`,
    `${summary.pillarsProgressed.length} pillar${summary.pillarsProgressed.length === 1 ? "" : "s"} progressed${
      summary.pillarsProgressed.length
        ? " — " + summary.pillarsProgressed.map((p) => p.name).join(", ")
        : ""
    }`,
    `${summary.recurringCompletedCount} recurring commitment${
      summary.recurringCompletedCount === 1 ? "" : "s"
    } completed`,
  ];

  if (summary.highestPriorityUnfinished) {
    lines.push(`Highest-priority unfinished action: ${summary.highestPriorityUnfinished.title}`);
  }

  for (const g of summary.neglectedWeeklyGoals) {
    lines.push(`"${g.title}" (priority ${g.priority}) received no action today`);
  }

  return (
    <div className="rounded-sm border border-border bg-surface-sunken px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
        Today so far — computed, not written
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {lines.map((line, i) => (
          <li key={i} className="font-mono text-[13px] text-text-secondary">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
