import { toDateKey } from "@/lib/today/date";

export type RecurrencePeriod = "day" | "week" | "month";

export type Period = {
  key: string;
  start: string;
  end: string;
};

export type PeriodSummary = Period & {
  count: number;
  target: number;
  met: boolean;
};

export type AdherenceReport = {
  current: PeriodSummary;
  /** Past, complete periods only — most recent first. */
  history: PeriodSummary[];
  streak: number;
  missedPeriods: number;
};

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // back up to Monday
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function periodFor(dateKey: string, period: RecurrencePeriod): Period {
  const d = parseDateKey(dateKey);
  if (period === "day") {
    return { key: dateKey, start: dateKey, end: dateKey };
  }
  if (period === "week") {
    const start = startOfWeek(d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { key: toDateKey(start), start: toDateKey(start), end: toDateKey(end) };
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

function nextPeriodStartKey(period: Period): string {
  const end = parseDateKey(period.end);
  const next = new Date(end);
  next.setDate(end.getDate() + 1);
  return toDateKey(next);
}

/**
 * Computes current-period adherence, a streak, and missed-period count
 * for a behavior goal — purely from its recurrence shape and its actual
 * completion rows. No target_frequency is ever read out of anywhere but
 * `recurrence`, so this always reflects what the commitment actually was.
 */
export function computeAdherence(
  recurrence: { period: RecurrencePeriod; targetFrequency: number },
  goalCreatedAt: Date,
  completions: { date: string; completed: boolean }[],
  now: Date = new Date(),
): AdherenceReport {
  const completedDates = new Set(
    completions.filter((c) => c.completed).map((c) => c.date),
  );

  const firstPeriod = periodFor(toDateKey(goalCreatedAt), recurrence.period);
  const currentPeriod = periodFor(toDateKey(now), recurrence.period);

  // Walk periods from the goal's creation forward to (and including) now.
  const periods: PeriodSummary[] = [];
  let cursor = firstPeriod;
  let guard = 0;
  while (guard < 2000) {
    guard += 1;
    const count = countCompletionsInRange(completedDates, cursor.start, cursor.end);
    periods.push({
      ...cursor,
      count,
      target: recurrence.targetFrequency,
      met: count >= recurrence.targetFrequency,
    });
    if (cursor.key === currentPeriod.key) break;
    cursor = periodFor(nextPeriodStartKey(cursor), recurrence.period);
  }

  const current = periods[periods.length - 1];
  const history = periods.slice(0, -1).reverse(); // most recent complete period first

  let streak = 0;
  for (const p of history) {
    if (p.met) streak += 1;
    else break;
  }

  const missedPeriods = history.filter((p) => !p.met).length;

  return { current, history, streak, missedPeriods };
}

function countCompletionsInRange(dates: Set<string>, start: string, end: string): number {
  let count = 0;
  for (const d of dates) {
    if (d >= start && d <= end) count += 1;
  }
  return count;
}
