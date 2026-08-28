"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SCREENS = [
  { href: "/today", label: "Today" },
  { href: "/goals", label: "Goals" },
  { href: "/trajectory", label: "Trajectory" },
  { href: "/timeline", label: "Timeline" },
  { href: "/coach", label: "Coach" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function PrimeNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Primary"
        className="hidden border-r border-border px-5 py-10 md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto"
      >
        <Link
          href="/"
          className="font-display text-[15px] font-bold tracking-[0.14em] text-text-primary"
        >
          PRIME <span className="text-text-faint">JAMES</span>
        </Link>

        <ul className="mt-8 flex flex-col gap-0.5">
          <NavLink href="/" label="Prime" active={isActive(pathname, "/")} />
          {SCREENS.map((s) => (
            <NavLink
              key={s.href}
              href={s.href}
              label={s.label}
              active={isActive(pathname, s.href)}
            />
          ))}
        </ul>
      </nav>

      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-border px-5 py-4 md:hidden">
        <Link
          href="/"
          className="font-display text-[13px] font-bold tracking-[0.14em] text-text-primary"
        >
          PRIME <span className="text-text-faint">JAMES</span>
        </Link>
      </header>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-between border-t border-border bg-surface px-2 py-2 md:hidden"
      >
        {SCREENS.map((s) => {
          const active = isActive(pathname, s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-sm px-1 py-1.5 text-[11px] ${
                active ? "font-semibold text-accent" : "text-text-faint"
              }`}
            >
              <span
                aria-hidden
                className={`h-[5px] w-[5px] rounded-full ${
                  active ? "bg-accent" : "bg-text-faint/70"
                }`}
              />
              {s.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`block rounded-sm px-2 py-1.5 text-[13.5px] ${
          active
            ? "bg-accent-muted font-medium text-text-primary"
            : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
