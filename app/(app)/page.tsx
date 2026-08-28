export default function PrimeDashboard() {
  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
        Prime
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary md:text-4xl">
        Prime James
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
        Your identity statement, Trajectory State and the seven pillars will
        live here once Vision and the scoring engine ship in M1–M3. For now
        this is the scaffold: navigation, design tokens and auth are wired —
        nothing is measuring anything yet.
      </p>
      <div className="mt-8 inline-block rounded-sm border border-border bg-surface px-4 py-3 font-mono text-[12px] text-text-faint">
        pillar scores ship in M3 · Vision ships in M1
      </div>
    </div>
  );
}
