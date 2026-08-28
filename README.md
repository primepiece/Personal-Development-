# Prime James

A personal operating system, not a habit tracker. See the architecture doc
for the full product design, data model, AI architecture and milestone plan
this repo is being built against.

## Current milestone: M0–M3 — foundation, Goals, Today, the measurement layer

No Trajectory, Timeline, or Coach narration yet — those are M4 onward.
Everything here has been verified end-to-end against a real local
Postgres — schema push, seed, a full Vision → Standard → Milestone →
Annual → Quarterly → Monthly → Weekly chain, a full day through Today,
and now a full pillar-scoring + signal-detection pass across seven
pillars with deliberately mixed data (some healthy, some genuinely
neglected, some too new to judge) — it just hasn't touched *your*
database yet, because only you can create the Supabase project.

- **Nav:** `Prime` (home) · `Today` · `Goals` · `Trajectory` · `Timeline` ·
  `Coach` — desktop left rail, mobile bottom bar (see
  `components/nav/prime-nav.tsx`).
- **Design tokens:** `app/globals.css` — black / teal / white, a
  deliberate single dark identity. Fully semantic (`background`,
  `surface`/`surface-raised`, `text-primary`/`secondary`/`faint`,
  `accent`/`accent-muted`, `positive`/`warning`/`danger`) so shades can
  be retuned without touching a component. Teal is restrained by
  convention (active nav, the one `.btn-primary` style, progress,
  selected states) — checked against WCAG AA, not eyeballed.
- **Auth:** Supabase email magic-link, session refreshed in `proxy.ts`.
  Every route except `/login` and `/auth/callback` requires a signed-in
  user.
- **Data:** Drizzle ORM against Supabase Postgres.
  - `life_categories` — the seven pillars. `id`/`slug` are immutable,
    `name` is the only mutable field, retirement is `is_active = false`
    (never a delete).
  - `vision_entries` (+ `vision_entry_history`), `standards` — Vision and
    standing rules per pillar, separate from goals.
  - `goals` (+ `goal_history`, `goal_recurrence` / `goal_recurrence_history`,
    `behavior_completions`) — the cascade: `milestone` (optionally
    age-anchored) → `annual` → `quarterly` → `monthly` → `weekly`.
  - `ventures`, `daily_actions` (a `CHECK` constraint enforces every
    action links to a weekly goal or is explicitly marked standalone),
    `daily_reviews` (+ `daily_review_history`).
  - `category_scores` — insert-only pillar score snapshots. `score` and
    `trend` are nullable (Insufficient data is a stored state); the
    `breakdown` jsonb embeds each component's exact value, weight,
    period and calculation text as computed at that moment, so a later
    formula change can never retroactively rewrite what an old snapshot
    meant.
  - `coach_signals` + `coach_signal_references` — the deterministic
    Layer 1 signal engine (`lib/signals/detect.ts`): seven detector
    types, reconciled (not re-inserted) on every run, each claim backed
    by real referenced rows.
  - Timeline and Coach's LLM narration land in M5–M8.
- **`/goals`** is both the Vision/Standards/Goals feature and M0's
  database verification in one place: once you're signed in against
  your own Supabase project, it reads the seven pillars live from
  Postgres.
- **`/today`** is the core operating loop: pick ≤5 Prime Actions, log a
  recurring commitment in one click (adherence % and streak computed
  live from `lib/behavior/adherence.ts`), see a rules-based "Suggested"
  list (`lib/today/suggestions.ts` — no model call, real counts only),
  write the evening review, and read the deterministic Daily Summary
  (`lib/today/summary.ts`) computed fresh from the day's actual rows.
- **`/` (Prime dashboard)** shows the Trajectory State (Strong / Mixed /
  Off Track / Establishing Baseline — never an average of the seven
  scores), the seven pillars with real scores or honest blanks, and the
  active signals list. **`/pillars/[category]`** exposes the full
  breakdown — component, value, weight, source, period, calculation,
  underlying records — plus that pillar's history and active signals.
  A "Recompute" button (`recomputeAllAction`) runs the whole
  deterministic layer; nothing recomputes silently on page load.

## One-time setup (do this once, outside of this session)

This session can't create accounts on your behalf — you'll need to do
this yourself before the app can run against real data:

1. **Create a Supabase project** at supabase.com.
2. In the project's **Authentication → URL Configuration**, add your local
   dev URL (`http://localhost:3000/auth/callback`) and, once deployed,
   your production URL as redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project
     Settings → API.
   - `DATABASE_URL` — Project Settings → Database → Connection string
     (use the **Transaction pooler** URI).
4. Push the schema and seed the seven pillars:
   ```bash
   npm run db:push
   npm run db:seed
   ```
5. **Deploy:** connect this repo to Vercel and add the same three env
   vars there. `npm run build` is the build command Vercel will use.

## Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/login` until Supabase
auth is configured per the steps above.
