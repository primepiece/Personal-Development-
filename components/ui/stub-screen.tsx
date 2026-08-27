type StubScreenProps = {
  eyebrow: string;
  title: string;
  ships: string;
  description: string;
};

/**
 * Placeholder shown for screens not yet built. Deliberately plain — an
 * honest "not built yet" beats a fake dashboard with invented numbers.
 */
export function StubScreen({ eyebrow, title, ships, description }: StubScreenProps) {
  return (
    <div className="px-6 py-10 md:px-12 md:py-14">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
        {description}
      </p>
      <div className="mt-8 inline-block rounded-sm border border-line bg-surface-raised px-4 py-3 font-mono text-[12px] text-ink-faint">
        ships in {ships}
      </div>
    </div>
  );
}
