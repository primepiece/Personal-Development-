# Prime James

A personal operating system, not a habit tracker. See the architecture doc
for the full product design, data model, AI architecture and milestone plan
this repo is being built against.

## Current milestone: M0–M6 shipped — M6.5 real-user validation in progress

Vision → Standards → Goals cascade, the Today operating loop, the
deterministic measurement layer (pillar scores, signal lifecycle,
Trajectory State), Trajectory (generic metrics + checkpoints), Weekly
Review (a zero-model-call synthesis of everything above, with an
inspectable top-3 priority ranking), and Prime Coach's first grounded
output — a Weekly Prime Brief reasoned over one deterministic evidence
bundle, returned as validated structured output, every claim checked
against an exact evidence allow-list before it's ever shown or stored.
Everything has been verified end-to-end against a real local Postgres.
Open-ended Coach chat, semantic memory and any further product features
are explicitly on hold until real usage (this milestone) says what's
actually worth building next.

- **Nav:** `Prime` (home) · `Today` · `Goals` · `Trajectory` · `Weekly` ·
  `Timeline` · `Coach` — desktop left rail, mobile bottom bar (see
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
  user; if `OWNER_EMAIL` is set, any signed-in account that isn't that
  exact address is signed out and redirected — this app has no per-user
  data isolation (it's built for exactly one person), so that's the
  backstop against a stray second Supabase account ever seeing anything.
  The primary control is still disabling public signup in the Supabase
  dashboard.
- **RLS:** every table has Row Level Security enabled with zero policies
  (`.enableRLS()` in each `db/schema/*.ts`), so Supabase's public REST
  API (reachable by anyone with the publishable/anon key, which is
  necessarily public — it ships in the browser bundle) returns zero rows
  for every table. The app itself is unaffected: it only ever talks to
  Postgres through `DATABASE_URL` directly (Drizzle, not the REST API),
  using a role that bypasses RLS.
- **Data:** Drizzle ORM against Supabase Postgres — `life_categories`
  (immutable pillar identity), `vision_entries`/`standards`/`goals` (the
  full milestone → annual → quarterly → monthly → weekly cascade),
  `daily_actions`/`daily_reviews` (the Today loop), `category_scores` +
  `coach_signals` (the deterministic measurement layer), `trajectory_metrics`
  + `trajectory_checkpoints` (generic, no hardcoded metrics),
  `weekly_reviews` + `weekly_reflections` (insert-only synthesis), and
  `coach_briefs` + `coach_brief_references` (Prime Coach, same
  insert-only + evidence-reference discipline as everything above). Full
  field-level detail is in the architecture doc, not duplicated here.
- **`/coach`** requires `ANTHROPIC_API_KEY` to generate a new brief — every
  other screen in the app works with it unset.

## Production setup

This session can't create accounts on your behalf, so this is written as
something you run yourself, in order. **Never paste a real API key,
secret, or connection string into this chat** — they only ever go into
Supabase/Vercel's own dashboards or a local `.env.local` (already
git-ignored).

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, **New project**.
2. Pick an org, name it (`prime-james` is fine), set a database
   password (Supabase generates and stores one for you — you won't need
   it directly, `DATABASE_URL` embeds it), pick a region close to you.
3. Wait for provisioning (~2 minutes).

### 2. Collect the three connection values

Still in the Supabase dashboard, **Project Settings**:

- **API** → copy the **Project URL** and the **`anon` `public`** key
  (not the `service_role` key — the app never uses that one).
- **Database** → **Connect** → copy the **Transaction pooler** connection
  string (port 6543). Replace `[YOUR-PASSWORD]` in it with the database
  password from step 1.

You now have the three values `.env.example` names:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`.

### 3. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API
   Keys** → **Create Key**.
2. This is `ANTHROPIC_API_KEY`. Only Prime Coach (`/coach`) needs it —
   nothing else in the app calls it.

### 4. Configure auth redirect URLs

Supabase dashboard → **Authentication** → **URL Configuration** → **Redirect
URLs**, add:

- `http://localhost:3000/auth/callback` (local dev)
- `https://<your-vercel-domain>/auth/callback` (add this once you know
  the domain from step 6 — you can come back and add it after deploying)

### 5. Push the schema and seed the seven pillars

Locally, with the three Supabase values (not the Anthropic key — the
schema/seed scripts never call the model):

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL
# in .env.local — never here in chat
npm install
npm run db:push    # creates every table against your real Supabase Postgres
npm run db:seed    # inserts the seven pillars (safe to re-run — no-ops if already seeded)
```

`npm run dev` and visit `http://localhost:3000` — you should land on
`/login`, and a magic-link email should arrive at the address you enter.
Confirm you can sign in and `/goals` shows the seven real pillars before
moving on — this is the same check M0 verified against a local database;
now it's verifying your actual production one.

### 6. Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import
   this GitHub repo.
2. Vercel auto-detects Next.js; leave the build command as `npm run
   build`.
3. **Environment Variables** — add all four: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`.
4. Deploy. Note the resulting domain (`your-app.vercel.app` or a custom
   one).
5. Go back to step 4 and add `https://<that-domain>/auth/callback` to
   Supabase's redirect URLs if you haven't already.
6. Visit the deployed URL, sign in, confirm `/goals` again shows the
   seven pillars in production.

At that point the schema is live, auth works, and every screen —
including `/coach` — is running against your real Supabase project.
Nothing in this repo needs to run again to "activate" it; the app read
straight from the database you just set up.

## Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/login` until Supabase
auth is configured per the steps above.
