# Prime James

A personal operating system, not a habit tracker. See the architecture doc
for the full product design, data model, AI architecture and milestone plan
this repo is being built against.

## Current milestone: M0 — foundation

Scaffold, design tokens, navigation shell, and auth wiring only. No goal
logic, no scoring, no AI yet — that starts at M1.

- **Nav:** `Prime` (home) · `Today` · `Goals` · `Trajectory` · `Timeline` ·
  `Coach` — desktop left rail, mobile bottom bar (see
  `components/nav/prime-nav.tsx`).
- **Design tokens:** `app/globals.css` — warm graphite ink, a single brass
  accent, steel-blue as the only secondary hue. Fraunces (display) / IBM
  Plex Sans (body) / IBM Plex Mono (data, schema-shaped text).
- **Auth:** Supabase email magic-link, session refreshed in
  `middleware.ts`. Every route except `/login` and `/auth/callback`
  requires a signed-in user.
- **Data:** Drizzle ORM against Supabase Postgres. Only `life_categories`
  exists so far, seeded with the seven pillars — the full schema (Vision,
  Goals, Daily, Scoring, Coach, Trajectory, Timeline) lands in M1–M8.

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
