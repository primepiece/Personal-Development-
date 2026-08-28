"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-display text-[15px] font-bold tracking-[0.14em] text-text-primary">
          PRIME <span className="text-text-faint">JAMES</span>
        </p>
        <h1 className="mt-6 font-display text-2xl font-semibold text-text-primary">
          Sign in
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary">
          One person, one account. We&apos;ll email a link — no password to
          leak alongside everything else this app will know about you.
        </p>

        {status === "sent" ? (
          <p className="mt-8 rounded-sm border border-border bg-surface px-4 py-3 text-[14px] text-text-secondary">
            Check {email} for a sign-in link.
          </p>
        ) : (
          <form onSubmit={sendLink} className="mt-8 flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="field-input"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-primary disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <p className="text-[13px] text-warning">
                Something went wrong sending that link. Try again.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
