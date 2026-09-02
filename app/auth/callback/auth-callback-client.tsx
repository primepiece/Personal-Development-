"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Completes an implicit-flow magic-link sign-in. Supabase redirected here
 * with the session in the URL fragment (#access_token=...&refresh_token=...)
 * — never sent to any server, only readable by this page's own JS.
 *
 * No manual fragment parsing needed: @supabase/ssr's browser client has
 * detectSessionInUrl on by default, which reads it during the client's own
 * initialization and persists the session via the same cookie-backed
 * storage every other request in this app reads from. `getSession()`
 * awaits that initialization internally, so it's the correct signal for
 * "did this actually work" rather than a race.
 */
export function AuthCallbackClient({ next }: { next: string }) {
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    let cancelled = false;

    async function completeSession() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data.session) {
        console.warn(`[auth/callback] no session found in URL: ${error?.message ?? "none present"}`);
        setStatus("error");
        return;
      }

      // Hard navigation, not client-side routing: the proxy/middleware
      // auth check needs a fresh request to see the cookies that were
      // just written, not a cached RSC tree from before they existed.
      window.location.href = next;
    }

    completeSession();
    return () => {
      cancelled = true;
    };
  }, [next]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-[14px] text-text-secondary">
            That sign-in link didn&apos;t work — it may have expired or already
            been used.{" "}
            <a href="/login" className="text-accent hover:underline">
              Try again
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-[14px] text-text-secondary">Signing you in…</p>
      </div>
    </div>
  );
}
