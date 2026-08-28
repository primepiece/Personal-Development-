/** Today's date as YYYY-MM-DD, server-local time. Today is scoped to a single day in M2 — no history browser yet. */
export function todayKey(): string {
  return toDateKey(new Date());
}

export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
