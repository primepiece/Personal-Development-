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
  return (
    <section className="mb-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">Morning Brief</p>

      {status === "failed" ? (
        <p className="mt-3 max-w-[62ch] text-[13.5px] text-text-secondary">
          Morning Mentor couldn&apos;t produce a trustworthy brief this morning
          {failureReason ? `: ${failureReason}` : "."} Nothing untrusted is shown — pick today&apos;s
          Prime Actions yourself below.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[16px] text-text-primary">
            Good morning James. Here&apos;s what I think matters today.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
