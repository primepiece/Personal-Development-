"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * TEMPORARY DIAGNOSTIC BUILD — see the auth-loop investigation. Rendered
 * on-screen (not just console.log) because this has to be debuggable from
 * an iPhone with no attached Mac/Web Inspector. Never shows a token,
 * refresh token, API key, or magic-link credential — only presence
 * (yes/no), parameter *names*, and cookie *names*. Remove once the loop
 * is root-caused and fixed.
 */
type Diagnostics = {
  hashPresent: boolean;
  hashParamKeys: string[];
  // error/error_code/error_description are GoTrue's own error metadata —
  // an enum-like code and a human-readable description, never a
  // credential — safe to show. Still never access_token/refresh_token/
  // provider_token or anything else from the fragment.
  hashError: string | null;
  hashErrorCode: string | null;
  hashErrorDescription: string | null;
  setSessionCalled: boolean;
  setSessionError: string | null;
  sessionFound: boolean;
  sessionUserIdPrefix: string | null;
  sessionError: string | null;
  cookieNames: string[];
};

/**
 * Completes an implicit-flow magic-link sign-in via an EXPLICIT
 * setSession() call, not detectSessionInUrl's automatic detection.
 *
 * Root cause, confirmed by reading the installed auth-js source directly:
 * detectSessionInUrl's internal _getSessionFromURL() correctly identifies
 * an implicit-flow fragment, then immediately throws
 * `AuthPKCEGrantCodeExchangeError('Not a valid PKCE flow url.')` because
 * it also checks `this.flowType === 'pkce'` — and @supabase/ssr's
 * createBrowserClient hardcodes flowType: "pkce" with no override, on
 * every client it creates, including this callback page's own. That
 * error is swallowed inside _initialize() (which by its own doc comment
 * "never throws"), so getSession() silently returns no session with no
 * error — which is exactly what production showed.
 *
 * setSession({ access_token, refresh_token }) has no such flowType gate
 * (confirmed in source: _setSession() only checks the two tokens are
 * present, then persists via the same this.storage/this.storageKey every
 * other request in this app reads from — the same cookie-backed adapter,
 * unaffected by the flowType mismatch above). So: extract the two tokens
 * ourselves from the fragment (never anything else from it), strip the
 * fragment immediately, and call setSession() explicitly instead of
 * relying on the auto-detection path that this SSR client can't use for
 * an implicit-flow URL.
 */
export function AuthCallbackClient({ next }: { next: string }) {
  const [status, setStatus] = useState<"working" | "ready" | "error">("working");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSession() {
      const rawHash = window.location.hash;
      const hashPresent = rawHash.length > 1;
      const hashParams = hashPresent ? new URLSearchParams(rawHash.substring(1)) : null;
      const hashParamKeys = hashParams ? Array.from(hashParams.keys()) : [];

      const hashError = hashParams?.get("error") ?? null;
      const hashErrorCode = hashParams?.get("error_code") ?? null;
      const hashErrorDescription = hashParams?.get("error_description") ?? null;

      // Extract only what setSession() needs, then immediately strip the
      // fragment from the visible URL/history — before any network call,
      // so the tokens sit exposed there for as little time as possible.
      const accessToken = hashParams?.get("access_token") ?? null;
      const refreshToken = hashParams?.get("refresh_token") ?? null;
      if (hashPresent) {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }

      const supabase = createClient();

      let setSessionCalled = false;
      let setSessionError: string | null = null;

      if (!hashError && accessToken && refreshToken) {
        setSessionCalled = true;
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        setSessionError = error?.message ?? null;
      }
      if (cancelled) return;

      // Independent verification, per the trace request: confirm
      // getSession() now reports the session that setSession() just
      // persisted, rather than trusting setSession()'s own return value
      // alone.
      const { data, error: getSessionErr } = await supabase.auth.getSession();
      if (cancelled) return;

      const cookieNames = document.cookie
        .split(";")
        .map((c) => c.split("=")[0]?.trim())
        .filter((name): name is string => !!name);

      const diag: Diagnostics = {
        hashPresent,
        hashParamKeys,
        hashError,
        hashErrorCode,
        hashErrorDescription,
        setSessionCalled,
        setSessionError,
        sessionFound: !!data.session,
        sessionUserIdPrefix: data.session ? data.session.user.id.slice(0, 8) : null,
        sessionError: getSessionErr?.message ?? null,
        cookieNames,
      };
      setDiagnostics(diag);
      console.log("[auth/callback diagnostics]", diag);

      if (!data.session) {
        setStatus("error");
        return;
      }

      setStatus("ready");
    }

    completeSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-center text-[14px] text-text-secondary">
          {status === "working" && "Signing you in…"}
          {status === "ready" && "Session found on this page."}
          {status === "error" && (
            <>
              That sign-in link didn&apos;t work — it may have expired or already
              been used.{" "}
              <a href="/login" className="text-accent hover:underline">
                Try again
              </a>
              .
            </>
          )}
        </p>

        {status === "ready" && (
          <div className="mt-6 flex justify-center">
            <a href={next} className="btn-primary">
              Continue into the app →
            </a>
          </div>
        )}

        {diagnostics && (
          <div className="mt-8 rounded-sm border border-border bg-surface-sunken px-4 py-3 font-mono text-[11px] leading-relaxed text-text-faint">
            <p className="mb-1 uppercase tracking-[0.08em] text-text-secondary">
              Temporary diagnostics — no secrets shown
            </p>
            <p>hash present: {String(diagnostics.hashPresent)}</p>
            <p>hash param keys: {diagnostics.hashParamKeys.join(", ") || "(none)"}</p>
            <p>error: {diagnostics.hashError ?? "(none)"}</p>
            <p>error_code: {diagnostics.hashErrorCode ?? "(none)"}</p>
            <p>error_description: {diagnostics.hashErrorDescription ?? "(none)"}</p>
            <p>setSession() called: {String(diagnostics.setSessionCalled)}</p>
            <p>setSession() error: {diagnostics.setSessionError ?? "(none)"}</p>
            <p>session found (after setSession): {String(diagnostics.sessionFound)}</p>
            <p>session user id (first 8 chars): {diagnostics.sessionUserIdPrefix ?? "(none)"}</p>
            <p>getSession() error: {diagnostics.sessionError ?? "(none)"}</p>
            <p>cookie names present: {diagnostics.cookieNames.join(", ") || "(none)"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
