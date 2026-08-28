const WIDTH = 480;
const HEIGHT = 120;
const PAD = 12;

export function CheckpointChart({
  checkpoints,
  targetValue,
}: {
  checkpoints: { asOfDate: string; value: number }[];
  targetValue: number | null;
}) {
  if (checkpoints.length < 2) return null;

  const dates = checkpoints.map((c) => new Date(c.asOfDate).getTime());
  const values = checkpoints.map((c) => c.value);
  const allValues = targetValue !== null ? [...values, targetValue] : values;

  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  const dateRange = maxDate - minDate || 1;

  const x = (t: number) => PAD + ((t - minDate) / dateRange) * (WIDTH - PAD * 2);
  const y = (v: number) => HEIGHT - PAD - ((v - minValue) / valueRange) * (HEIGHT - PAD * 2);

  const points = checkpoints.map((c) => `${x(new Date(c.asOfDate).getTime())},${y(c.value)}`).join(" ");
  const last = checkpoints[checkpoints.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mt-3 w-full max-w-[480px]"
      role="img"
      aria-label="Checkpoint history over time"
    >
      {targetValue !== null && (
        <line
          x1={PAD}
          x2={WIDTH - PAD}
          y1={y(targetValue)}
          y2={y(targetValue)}
          stroke="var(--border-strong)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={1.75} />
      <circle cx={x(new Date(last.asOfDate).getTime())} cy={y(last.value)} r={2.75} fill="var(--accent)" />
    </svg>
  );
}
