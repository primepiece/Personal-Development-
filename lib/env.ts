import { config } from "dotenv";

// Standalone CLI scripts (drizzle-kit, tsx db/seed.ts) run outside the
// Next.js runtime, so they never get Next's automatic .env.local loading —
// import this as the very first line of any such script. Silently no-ops
// if .env.local doesn't exist (e.g. env vars already set inline), and
// never overrides a real process.env value that's already set.
config({ path: ".env.local" });
