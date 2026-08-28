import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestWeeklyReview } from "@/lib/weekly/compute";
import { weekLabel, weekStartKey } from "@/lib/weekly/date";
import { getCoachBriefAttempts, getCoachBriefReferences, getLatestCoachBrief } from "@/lib/coach/query";
import { resolveEvidenceLink } from "@/lib/coach/links";
import { generateCoachBriefAction } from "../actions";

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftWeeks(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n * 7);
  return weekStartKey(d);
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-positive",
  medium: "text-text-secondary",
  low: "text-warning",
};

export default async function CoachPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  if (!WEEK_KEY_RE.test(week)) notFound();
  const canonicalWeek = weekStartKey(new Date(`${week}T00:00:00`));
  if (canonicalWeek !== week) notFound();

  const [reviewRow, brief, attempts] = await Promise.all([
    getLatestWeeklyReview(week),
    getLatestCoachBrief(week),
    getCoachBriefAttempts(week),
  ]);

  const references = brief?.status === "ok" ? await getCoachBriefReferences(brief.id) : [];
  const refLinks = await Promise.all(references.map((r) => resolveEvidenceLink(r.refTable, r.refId)));

  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Prime Coach</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
            {weekLabel(new Date(`${week}T00:00:00`))}
          </h1>
          <p className="mt-1 font-mono text-[12px] text-text-faint">
            {brief ? `last attempt ${brief.generatedAt.toISOString().slice(0, 16).replace("T", " ")}` : "no brief generated yet"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/coach/${shiftWeeks(week, -1)}`} className="font-mono text-[11px] text-text-faint hover:text-text-primary">
            ← prior week
          </Link>
          <Link href={`/coach/${shiftWeeks(week, 1)}`} className="font-mono text-[11px] text-text-faint hover:text-text-primary">
            next week →
          </Link>
          {reviewRow && (
            <form action={generateCoachBriefAction}>
              <input type="hidden" name="weekStartDate" value={week} />
              <button type="submit" className="btn-primary">
                {brief ? "Regenerate" : "Generate"}
              </button>
            </form>
          )}
        </div>
      </div>

      {!reviewRow ? (
        <p className="mt-10 max-w-[62ch] text-[14.5px] text-text-secondary">
          No Weekly Review exists for this week yet. Prime Coach reasons entirely over the deterministic
          Weekly Review — generate that first.{" "}
          <Link href={`/weekly/${week}`} className="text-accent hover:underline">
            Go to Weekly Review →
          </Link>
        </p>
      ) : !brief ? (
        <p className="mt-10 max-w-[62ch] text-[14.5px] text-text-secondary">
          The Weekly Review for this week is ready. Generate the Prime Brief when you want Coach&apos;s read on it.
        </p>
      ) : brief.status === "failed" ? (
        <div className="mt-8 rounded-sm border border-danger bg-danger-muted px-5 py-4">
          <p className="field-label text-danger">Coach couldn&apos;t produce a trustworthy brief</p>
          <p className="mt-2 text-[13.5px] text-text-primary">{brief.failureReason}</p>
          <p className="mt-3 text-[12.5px] text-text-secondary">
            Nothing untrusted is shown or stored as coaching. The deterministic Weekly Review above remains
            fully available regardless —{" "}
            <Link href={`/weekly/${week}`} className="text-accent hover:underline">
              view it
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-faint">
              Confidence
            </p>
            <span className={`font-mono text-[12px] uppercase ${CONFIDENCE_COLOR[brief.confidence ?? ""] ?? ""}`}>
              {brief.confidence}
            </span>
          </div>

          <BriefSection title="The Week">{brief.summary}</BriefSection>
          <BriefSection title="What Moved">{brief.progress}</BriefSection>
          <BriefSection title="What's Off">{brief.concern}</BriefSection>
          {brief.contradiction && <BriefSection title="Contradiction">{brief.contradiction}</BriefSection>}
          <BriefSection title="The Call">{brief.recommendation}</BriefSection>

          <section className="mt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Next Week</h2>
            <ol className="mt-3 flex flex-col gap-2">
              {(brief.nextWeekPriorities as string[]).map((p, i) => (
                <li key={i} className="flex gap-3 rounded-sm border border-border bg-surface px-4 py-3 text-[14px] text-text-primary">
                  <span className="font-mono text-[11px] text-accent">#{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-10">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
              Why are you saying this? — {references.length} evidence reference{references.length === 1 ? "" : "s"}
            </h2>
            <ul className="mt-3 flex flex-col gap-1.5">
              {references.map((r, i) => {
                const href = refLinks[i];
                const content = (
                  <>
                    <span className="font-mono text-[10.5px] uppercase text-text-faint">{r.refTable.replace(/_/g, " ")}</span>{" "}
                    <span className="text-text-secondary">{r.note}</span>
                  </>
                );
                return (
                  <li key={r.id} className="text-[13px]">
                    {href ? (
                      <Link href={href} className="hover:text-accent">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {attempts.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
            Generation history ({attempts.length})
          </h2>
          <ul className="mt-3 flex flex-col gap-1">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 font-mono text-[11.5px] text-text-secondary">
                <span>{a.generatedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                <span>{a.model}</span>
                <span className={a.status === "ok" ? "text-positive" : "text-danger"}>{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">{title}</h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-text-primary">{children}</p>
    </section>
  );
}
