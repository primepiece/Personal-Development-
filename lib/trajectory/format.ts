const CURRENCY_UNITS = new Set(["nzd", "usd", "aud", "gbp", "eur", "cad"]);
const DURATION_UNITS = new Set(["seconds", "duration", "duration_seconds", "s"]);

const CURRENCY_SYMBOL: Record<string, string> = {
  nzd: "$",
  usd: "$",
  aud: "$",
  cad: "$",
  gbp: "£",
  eur: "€",
};

/** Formats a raw stored number for display given a metric's free-text unit. Never changes the stored value, only how it reads. */
export function formatMetricValue(unit: string, value: number): string {
  const key = unit.trim().toLowerCase();

  if (CURRENCY_UNITS.has(key)) {
    const symbol = CURRENCY_SYMBOL[key] ?? "";
    return `${symbol}${Math.round(value).toLocaleString("en-US")}`;
  }

  if (DURATION_UNITS.has(key)) {
    return formatDuration(value);
  }

  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("en-US")}${unit ? ` ${unit}` : ""}`;
}

export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const s = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${pad(m)}:${pad(sec)}` : `${sign}${m}:${pad(sec)}`;
}

/** Signed delta, formatted with an explicit +/- so a chart caption reads honestly either direction. */
export function formatMetricDelta(unit: string, value: number): string {
  const formatted = formatMetricValue(unit, Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}
