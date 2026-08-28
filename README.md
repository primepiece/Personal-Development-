# Prime James

A personal operating system, not a habit tracker. See the architecture doc
for the full product design, data model, AI architecture and milestone plan
this repo is being built against.

## Current milestone: M0–M2 — foundation, Vision → Standards → Goals, Today

No scoring, no AI, no Trajectory/Timeline/Coach content yet — those are
M3 onward. Everything here has been verified end-to-end against a real
local Postgres — schema push, seed, a full Vision → Standard →
Milestone(age 25) → Annual → Quarterly → Monthly → Weekly chain, and a
full day through Today (Prime Actions, a logged recurring completion,
an evening review, an edited review preserving its original in history)
— it just hasn't touched *your* database yet, because only you can
create the Supabase project.

- **Nav:** `Prime` (home) · `Today` · `Goals` · `Trajectory` · `Timeline` ·
  `Coach` — desktop left rail, mobile bottom bar (see
  `components/nav/prime-nav.tsx`).
- **Design tokens:** `app/globals.css` — warm graphite ink, a single brass
  accent, steel-blue as the only secondary hue. Fraunces (display) / IBM
  Plex Sans (body) / IBM Plex Mono (data, schema-shaped text).
- **Auth:** Supabase email magic-link, session refreshed in `proxy.ts`.
  Every route except `/login` and `/auth/callback` requires a signed-in
  user.
- **Data:** Drizzle ORM against Supabase Postgres.
  - `life_categories` — the seven pillars. `id`/`slug` are immutable,
    `name` is the only mutable field, retirement is `is_active = false`
    (never a delete).
  - `vision_entries` (+ `vision_entry_history`) — one current Vision per
    pillar, edits snapshotted before they overwrite.
  - `standards` — standing rules per pillar, separate from goals.
  - `goals` (+ `goal_history`, `goal_recurrence` / `goal_recurrence_history`,
    `behavior_completions`) — the cascade: `milestone` (optionally
    age-anchored) → `annual` → `quarterly` → `monthly` → `weekly`.
  - `ventures` — named initiatives ("PrimeAI"), find-or-create by name,
    optionally tagged onto a Prime Action.
  - `daily_actions` — today's up-to-five. A `CHECK` constraint enforces
    that every action either links to a weekly goal or is explicitly
    marked standalone — going without a goal can never be a silent
    default.
  - `daily_reviews` (+ `daily_review_history`) — one review per day,
    `raw_text` never touched by anything but you; edits snapshot the
    prior version first.
  - Scoring, Trajectory, Timeline and Coach tables land in M3–M8.
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
