import { toDateKey } from "@/lib/today/date";

/** Monday 00:00 (local) of the week containing `d` — same convention lib/behavior/adherence.ts uses for period='week' goals, so a Weekly Review's week and a behavior goal's week always agree. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/** Sunday 00:00 (local) — the last day of the week that started at `weekStart`. */
export function endOfWeek(weekStart: Date): Date {
  const copy = new Date(weekStart);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

export function weekStartKey(d: Date): string {
  return toDateKey(startOfWeek(d));
}

/** Standard ISO-8601 week number (1-53) and the ISO week-year it belongs to. */
export function isoWeek(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

export function weekLabel(weekStart: Date): string {
  const { week, year } = isoWeek(weekStart);
  return `WEEK ${week}, ${year}`;
}

/** End-of-day boundary for a date key — for "as of" comparisons against timestamps. */
export function endOfDay(dateKey: string): Date {
  const d = new Date(`${dateKey}T23:59:59.999`);
  return d;
}
