import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The single point where a magic-link click either becomes a real session
 * or doesn't — every failure path logs *why* server-side (never the code/
 * token itself) instead of silently bouncing to /login indistinguishably
 * from "never signed in at all".
 *
 * Handles two different completion shapes:
 *
 * - `token_hash` + `type` — server-side OTP verification (verifyOtp).
 *   Needs NO prior client-side state at all: the hash alone is enough to
 *   look up and consume the pending OTP on Supabase's side. This is the
 *   path the Magic Link email template must use (see README) — it's the
 *   only one that works reliably when the link is opened somewhere other
 *   than the exact browser tab that requested it, which for an *emailed*
 *   link is the normal case, not an edge case: tapped from the Gmail app
 *   (its own sandboxed in-app browser, cookie jar isolated from Safari's)
 *   handing off to Safari, a different device, whatever.
 *
 * - `code` — the PKCE flow (exchangeCodeForSession). Kept as a fallback
 *   for completeness, but this is what was actually breaking production:
 *   it requires the code_verifier auth-js wrote into a cookie in
 *   whichever browser context called signInWithOtp() to still be
 *   readable from whichever browser context loads this callback. Those
 *   are only guaranteed to be the same context for same-tab flows (OAuth
 *   redirects); an emailed link has no such guarantee, hence
 *   "PKCE code verifier not found in storage" the moment the two differ.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";

  // Behind Vercel's proxy, `origin` derived from request.url isn't
  // guaranteed to be the public-facing host — Supabase's own documented
  // fix for exactly that (redirecting to the wrong host after a
  // successful verification looks identical to it having failed).
  // See https://supabase.com/docs/guides/auth/server-side/nextjs
  const forwardedHost = request.headers.get("x-forwarded-host");
  const redirectOrigin = forwardedHost ? `https://${forwardedHost}` : origin;

  // GoTrue redirects here on a FAILED verify too (expired/already-used
  // link) — with `error`/`error_description` instead of a token, not as
  // a thrown exception. Silently falling through to /login here (the
  // previous behavior) made that indistinguishable from never having a
  // session at all.
  const verifyError = searchParams.get("error_description") ?? searchParams.get("error");
  if (verifyError) {
    console.warn(`[auth/callback] Supabase verify redirected with an error: ${verifyError}`);
    return NextResponse.redirect(`${redirectOrigin}/login`);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.warn(`[auth/callback] verifyOtp failed: ${error.message}`);
      return NextResponse.redirect(`${redirectOrigin}/login`);
    }
    return NextResponse.redirect(`${redirectOrigin}${next}`);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn(`[auth/callback] exchangeCodeForSession failed: ${error.message}`);
      return NextResponse.redirect(`${redirectOrigin}/login`);
    }
    return NextResponse.redirect(`${redirectOrigin}${next}`);
  }

  console.warn("[auth/callback] no token_hash or code param on the callback request — nothing to verify");
  return NextResponse.redirect(`${redirectOrigin}/login`);
}
