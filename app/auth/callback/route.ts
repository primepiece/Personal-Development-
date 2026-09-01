import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The single point where a magic-link click either becomes a real session
 * or doesn't — every failure path logs *why* server-side (never the code/
 * token itself) instead of silently bouncing to /login indistinguishably
 * from "never signed in at all". That silence was itself the problem the
 * last time this broke: there was no way to tell a failed code exchange
 * apart from GoTrue rejecting the link apart from the app's own
 * post-session OWNER_EMAIL check apart from a host/redirect mismatch —
 * all four produce the exact same "back at Sign In" symptom.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // GoTrue redirects here on a FAILED verify too (expired/already-used
  // link, wrong flow type) — with `error`/`error_description` instead of
  // `code`, not as a thrown exception. Silently falling through to
  // /login here (the previous behavior) made that indistinguishable from
  // never having a session at all.
  const verifyError = searchParams.get("error_description") ?? searchParams.get("error");
  if (verifyError) {
    console.warn(`[auth/callback] Supabase verify redirected with an error: ${verifyError}`);
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!code) {
    console.warn("[auth/callback] no code param on the callback request — nothing to exchange");
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn(`[auth/callback] exchangeCodeForSession failed: ${error.message}`);
    return NextResponse.redirect(`${origin}/login`);
  }

  // Behind Vercel's proxy, `origin` derived from request.url isn't
  // guaranteed to be the public-facing host — this is Supabase's own
  // documented fix for exactly that (redirecting to the wrong host after
  // a successful exchange looks identical to the exchange having failed).
  // See https://supabase.com/docs/guides/auth/server-side/nextjs
  const forwardedHost = request.headers.get("x-forwarded-host");
  const redirectOrigin = forwardedHost ? `https://${forwardedHost}` : origin;
  return NextResponse.redirect(`${redirectOrigin}${next}`);
}
