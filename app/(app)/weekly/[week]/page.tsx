import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weeklyReflections } from "@/db/schema";
import { getLatestWeeklyReview } from "@/lib/weekly/compute";
import { weekLabel, weekStartKey } from "@/lib/weekly/date";
import { formatMetricValue } from "@/lib/trajectory/format";
import { TRAJECTORY_LABEL } from "@/lib/scoring/labels";
import type { WeeklyReviewSnapshot } from "@/lib/weekly/types";
import { generateWeeklyReviewAction, saveWeeklyReflectionAction } from "../actions";

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftWeeks(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n * 7);
  return weekStartKey(d);
}

function trajectoryColor(state: string) {
  if (state === "strong") return "text-positive";
  if (state === "off_track") return "text-danger";
  if (state === "mixed") return "text-warning";
  return "text-text-secondary";
}

function paceColor(status: string) {
  if (status === "behind_pace" || status === "target_date_passed") return "text-warning";
  if (status === "on_pace" || status === "ahead_pace" || status === "target_reached") return "text-positive";
  return "text-text-faint";
}

export default async function WeeklyReviewPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  if (!WEEK_KEY_RE.test(week)) notFound();
  const canonicalWeek = weekStartKey(new Date(`${week}T00:00:00`));
  if (canonicalWeek !== week) notFound();

  const [row, [reflection]] = await Promise.all([
    getLatestWeeklyReview(week),
    db.select().from(weeklyReflections).where(eq(weeklyReflections.weekStartDate, week)).limit(1),
  ]);

  const comparisonKeys = { lastWeek: shiftWeeks(week, -1), fourWeeksAgo: shiftWeeks(week, -4), quarterAgo: shiftWeeks(week, -13) };
  const [lastWeekRow, fourWeekRow, quarterRow] = await Promise.all([
    getLatestWeeklyReview(comparisonKeys.lastWeek),
    getLatestWeeklyReview(comparisonKeys.fourWeeksAgo),
    getLatestWeeklyReview(comparisonKeys.quarterAgo),
  ]);

  const snapshot = row?.snapshot as WeeklyReviewSnapshot | undefined;

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Weekly Review</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
            {weekLabel(new Date(`${week}T00:00:00`))}
          </h1>
          <p className="mt-1 font-mono text-[12px] text-text-faint">
            {week} — {shiftWeeks(week, 1) === week ? "" : ""}
            {row ? `generated ${row.computedAt.toISOString().slice(0, 16).replace("T", " ")}` : "not yet generated"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/weekly/${shiftWeeks(week, -1)}`} className="font-mono text-[11px] text-text-faint hover:text-text-primary">
            ← prior week
          </Link>
          <Link href={`/weekly/${shiftWeeks(week, 1)}`} className="font-mono text-[11px] text-text-faint hover:text-text-primary">
            next week →
          </Link>
          <form action={generateWeeklyReviewAction}>
            <input type="hidden" name="weekStartDate" value={week} />
            <button type="submit" className="btn-primary">
              {row ? "Regenerate" : "Generate"}
            </button>
          </form>
        </div>
      </div>

      {!snapshot ? (
        <p className="mt-10 max-w-[60ch] text-[14.5px] text-text-secondary">
          No review generated for this week yet. Generate produces a snapshot from real stored data as of
          right now — regenerating later never rewrites this one, it inserts a fresh snapshot alongside it.
        </p>
      ) : (
        <>
          <div className="mt-8 rounded-sm border border-border bg-surface px-5 py-4">
            <p className="field-label">Trajectory State</p>
            <p className={`mt-1 font-display text-2xl font-semibold ${trajectoryColor(snapshot.trajectory.state)}`}>
              {TRAJECTORY_LABEL[snapshot.trajectory.state]}
            </p>
            <p className="mt-1 text-[13px] text-text-secondary">{snapshot.trajectory.reason}</p>
          </div>

          <Section title="Prime Actions">
            <div className="rounded-sm border border-border bg-surface px-5 py-4">
              <p className="font-display text-2xl font-semibold text-text-primary">
                {snapshot.primeActions.done}/{snapshot.primeActions.total}
                {snapshot.primeActions.completionRate !== null && (
                  <span className="ml-2 font-mono text-[13px] text-text-faint">
                    {snapshot.primeActions.completionRate}%
                  </span>
                )}
              </p>
              {snapshot.primeActions.unfinished.length > 0 && (
                <div className="mt-3">
                  <p className="field-label">Highest-priority unfinished</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {snapshot.primeActions.unfinished.map((a) => (
                      <li key={a.id} className="text-[13.5px] text-text-secondary">
                        {a.title} <span className="font-mono text-[11px] text-text-faint">— {a.categoryName} · priority {a.priority} · {a.date}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>

          <Section title="Recurring Behaviours">
            {snapshot.recurringBehaviours.length === 0 ? (
              <Empty>No active recurring behaviour goals.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {snapshot.recurringBehaviours.map((rb) => (
                  <li key={rb.goalId} className="flex items-center justify-between gap-4 rounded-sm border border-border bg-surface px-4 py-3">
                    <div>
                      <p className="text-[14px] text-text-primary">{rb.goalTitle}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
                        {rb.categoryName} · {rb.periodCount}/{rb.targetFrequency} this {rb.period}
                        {rb.maturity === "baseline" && " · establishing baseline"}
                      </p>
                    </div>
                    {rb.trend && (
                      <span className={`font-mono text-[11px] uppercase ${rb.trend === "improving" ? "text-positive" : "text-warning"}`}>
                        {rb.trend}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Goals">
            <div className="grid gap-4 sm:grid-cols-2">
              <GoalList label="Completed this week" items={snapshot.goals.completed.map((g) => `${g.title} — ${g.categoryName}`)} tone="positive" />
              <GoalList label="Neglected" items={snapshot.goals.neglected.map((g) => `${g.title} — ${g.daysSinceTouch}d untouched`)} tone="warning" />
              <GoalList
                label="Approaching deadline"
                items={snapshot.goals.approachingDeadline.map((g) => `${g.title} — ${g.daysUntil < 0 ? `${Math.abs(g.daysUntil)}d overdue` : `due in ${g.daysUntil}d`}`)}
                tone="warning"
              />
              <GoalList label="Outcome goals on pace" items={snapshot.goals.outcomeOnPace.map((g) => `${g.title} (${g.metricName})`)} tone="positive" />
            </div>
            {snapshot.goals.outcomeBehindPace.length > 0 && (
              <div className="mt-3">
                <GoalList label="Outcome goals behind pace" items={snapshot.goals.outcomeBehindPace.map((g) => `${g.title} (${g.metricName})`)} tone="warning" />
              </div>
            )}
          </Section>

          <Section title="Pillars">
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {snapshot.pillars.map((p) => (
                <li key={p.categoryId} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
                  <div>
                    <Link href={`/pillars/${p.categorySlug}`} className="text-[14px] text-text-primary hover:text-accent">
                      {p.categoryName}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
                      {p.meaningfulActivity ? `activity on ${p.activityDays}/7 days` : "no activity this week"}
                      {p.outcomeEvidence.length > 0 && ` · ${p.outcomeEvidence.length} outcome metric${p.outcomeEvidence.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-text-faint">
                    {p.score !== null ? `${Math.round(p.score)} · ${p.confidence}` : p.confidence === "insufficient" ? "insufficient data" : p.confidence}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Signals">
            <div className="grid gap-4 sm:grid-cols-2">
              <SignalList label="New this week" items={snapshot.signals.newThisWeek} />
              <SignalList label="High-importance, active" items={snapshot.signals.highImportanceActive} />
              <SignalList label="Acknowledged, unresolved" items={snapshot.signals.acknowledgedUnresolved} />
              <SignalList label="Resolved this week" items={snapshot.signals.resolvedThisWeek} tone="positive" />
            </div>
          </Section>

          <Section title="Trajectory">
            {snapshot.trajectoryMetrics.length === 0 ? (
              <Empty>No metric movement to report this week.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {snapshot.trajectoryMetrics.map((m) => (
                  <li key={m.metricId} className="rounded-sm border border-border bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <Link href="/trajectory" className="text-[14px] text-text-primary hover:text-accent">
                        {m.name}
                      </Link>
                      <span className={`font-mono text-[11px] uppercase ${paceColor(m.status)}`}>
                        {m.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-text-secondary">{m.statusReason}</p>
                    {m.requiredMonthlyChange !== null && m.observedMonthlyChange !== null && (
                      <p className="mt-1 font-mono text-[11px] text-text-faint">
                        required {formatMetricValue(m.unit, m.requiredMonthlyChange)}/mo vs observed {formatMetricValue(m.unit, m.observedMonthlyChange)}/mo
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Daily Reviews">
            <div className="rounded-sm border border-border bg-surface px-5 py-4">
              <p className="font-display text-2xl font-semibold text-text-primary">
                {snapshot.dailyReviews.completedCount}/{snapshot.dailyReviews.possibleDays}
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-secondary">
                avg energy {snapshot.dailyReviews.avgEnergyRating ?? "—"} · avg day rating {snapshot.dailyReviews.avgDayRating ?? "—"}
              </p>
            </div>
          </Section>

          <Section title="Deterministic Insights">
            {snapshot.insights.length === 0 ? (
              <Empty>Nothing high-confidence enough to state yet.</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {snapshot.insights.map((line, i) => (
                  <li key={i} className="text-[13.5px] text-text-secondary">
                    · {line}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Weekly Priority — next week's top 3">
            {snapshot.priorities.length === 0 ? (
              <Empty>No unresolved high-severity issue or behind-pace metric right now.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {snapshot.priorities.map((p) => (
                  <li key={p.rank} className="rounded-sm border border-border bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[14px] text-text-primary">
                        <span className="mr-2 font-mono text-[11px] text-accent">#{p.rank}</span>
                        {p.label}
                      </p>
                      <span className="font-mono text-[11px] text-text-faint">score {p.score}</span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.06em] text-text-faint">
                        why this ranked here
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {p.factors.map((f) => (
                          <li key={f.name} className="flex justify-between gap-4 font-mono text-[11px] text-text-secondary">
                            <span>{f.name}</span>
                            <span className="text-right text-text-faint">+{f.points} — {f.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Weekly History">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HistoryCell label="This week" row={row} />
              <HistoryCell label="Last week" row={lastWeekRow} />
              <HistoryCell label="4 weeks ago" row={fourWeekRow} />
              <HistoryCell label="~1 quarter ago" row={quarterRow} />
            </div>
          </Section>

          <Section title="Manual Reflection">
            <form action={saveWeeklyReflectionAction} className="flex flex-col gap-4">
              <input type="hidden" name="weekStartDate" value={week} />
              <ReflectionField name="biggestWin" label="Biggest win" defaultValue={reflection?.biggestWin} />
              <ReflectionField name="biggestMistake" label="Biggest mistake" defaultValue={reflection?.biggestMistake} />
              <ReflectionField name="whatLearned" label="What I learned" defaultValue={reflection?.whatLearned} />
              <ReflectionField name="whatToChange" label="What needs to change next week" defaultValue={reflection?.whatToChange} />
              <button type="submit" className="btn-primary self-start">
                {reflection ? "Update reflection" : "Save reflection"}
              </button>
            </form>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-text-faint">{children}</p>;
}

function GoalList({ label, items, tone }: { label: string; items: string[]; tone: "positive" | "warning" }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[13px] text-text-faint">None.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={i} className={`text-[13px] ${tone === "positive" ? "text-positive" : "text-warning"}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignalList({
  label,
  items,
  tone,
}: {
  label: string;
  items: WeeklyReviewSnapshot["signals"]["newThisWeek"];
  tone?: "positive";
}) {
  return (
    <div>
      <p className="field-label">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[13px] text-text-faint">None.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {items.map((s) => (
            <li key={s.id} className={`text-[13px] ${tone === "positive" ? "text-positive" : "text-text-secondary"}`}>
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryCell({ label, row }: { label: string; row: { trajectoryState: string; snapshot: unknown } | undefined }) {
  const snap = row?.snapshot as WeeklyReviewSnapshot | undefined;
  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-3">
      <p className="field-label">{label}</p>
      {!row || !snap ? (
        <p className="mt-1.5 text-[12.5px] text-text-faint">not generated</p>
      ) : (
        <>
          <p className={`mt-1.5 text-[13px] font-semibold ${trajectoryColor(row.trajectoryState)}`}>
            {TRAJECTORY_LABEL[row.trajectoryState] ?? row.trajectoryState}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-text-faint">
            {snap.primeActions.done}/{snap.primeActions.total} actions
          </p>
        </>
      )}
    </div>
  );
}

function ReflectionField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string | undefined }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={2} className="field-input resize-y" />
    </label>
  );
}
