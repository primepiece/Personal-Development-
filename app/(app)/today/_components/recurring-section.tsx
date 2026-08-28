import Link from "next/link";
import { toggleBehaviorCompletionAction } from "../actions";
import type { AdherenceReport } from "@/lib/behavior/adherence";

export type RecurringGoal = {
  id: string;
  title: string;
  categoryName: string;
  period: "day" | "week" | "month";
  targetFrequency: number;
  doneToday: boolean;
  report: AdherenceReport;
};

export function RecurringSection({ goals }: { goals: RecurringGoal[] }) {
  if (goals.length === 0) {
    return <p className="text-[13.5px] text-text-faint">No recurring commitments yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {goals.map((goal) => (
        <li
          key={goal.id}
          className="flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <Link href={`/goals`} className="text-[14px] text-text-primary hover:text-accent">
              {goal.title}
            </Link>
            <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-text-secondary">
              <span>{goal.categoryName}</span>
              <span>
                · {goal.report.current.count}/{goal.targetFrequency} this {goal.period}
              </span>
              {goal.report.streak > 0 && (
                <span className="text-accent">· {goal.report.streak} streak</span>
              )}
              {goal.report.missedPeriods > 0 && (
                <span className="text-warning">· {goal.report.missedPeriods} missed</span>
              )}
            </p>
          </div>
          <form action={toggleBehaviorCompletionAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <button
              type="submit"
              className={`shrink-0 rounded-sm border px-3 py-1.5 font-mono text-[11px] ${
                goal.doneToday
                  ? "border-positive bg-positive text-text-on-accent"
                  : "border-border-strong text-text-primary"
              }`}
            >
              {goal.doneToday ? "done today" : "log today"}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
