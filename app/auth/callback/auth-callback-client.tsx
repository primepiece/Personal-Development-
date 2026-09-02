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
  sessionFound: boolean;
  sessionUserIdPrefix: string | null;
  sessionError: string | null;
  cookieNames: string[];
};

/**
 * Completes an implicit-flow magic-link sign-in. Supabase redirected here
 * with the session in the URL fragment (#access_token=...&refresh_token=...)
 * — never sent to any server, only readable by this page's own JS.
 *
 * detectSessionInUrl (on by default on @supabase/ssr's browser client)
 * reads that fragment during the client's own initialization and persists
 * the session via the same cookie-backed storage every other request in
 * this app reads from. getSession() awaits that initialization internally.
 */
export function AuthCallbackClient({ next }: { next: string }) {
  const [status, setStatus] = useState<"working" | "ready" | "error">("working");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSession() {
      const rawHash = window.location.hash;
      const hashPresent = rawHash.length > 1;
      const hashParamKeys = hashPresent
        ? Array.from(new URLSearchParams(rawHash.substring(1)).keys())
        : [];

      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      const cookieNames = document.cookie
        .split(";")
        .map((c) => c.split("=")[0]?.trim())
        .filter((name): name is string => !!name);

      const diag: Diagnostics = {
        hashPresent,
        hashParamKeys,
        sessionFound: !!data.session,
        sessionUserIdPrefix: data.session ? data.session.user.id.slice(0, 8) : null,
        sessionError: error?.message ?? null,
        cookieNames,
      };
      setDiagnostics(diag);
      console.log("[auth/callback diagnostics]", diag);

      if (error || !data.session) {
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
            <p>session found: {String(diagnostics.sessionFound)}</p>
            <p>session user id (first 8 chars): {diagnostics.sessionUserIdPrefix ?? "(none)"}</p>
            <p>session error: {diagnostics.sessionError ?? "(none)"}</p>
            <p>cookie names present: {diagnostics.cookieNames.join(", ") || "(none)"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
