import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AuthCallbackClient } from "./auth-callback-client";

function paramString(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * The single point where a magic-link click either becomes a real session
 * or doesn't. A page, not a Route Handler, because the flow this app
 * actually uses (implicit — see lib/supabase/otp-client.ts) delivers the
 * session as a URL *fragment* (#access_token=...), which is never sent to
 * a server at all; only client-side JS can see it. See
 * ./auth-callback-client.tsx for that half.
 *
 * The `token_hash`/`code` handling below is kept for robustness (a fully
 * server-side completion, no client JS required) in case the Supabase
 * project's email template or client flow config ever changes back — but
 * with the default, uneditable Magic Link template, Supabase always
 * redirects here with neither, so the client component is the path that
 * actually runs today.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = paramString(params.next) ?? "/";

  // GoTrue redirects here on a FAILED verify too (expired/already-used
  // link) — with `error`/`error_description`, not as a thrown exception.
  const verifyError = paramString(params.error_description) ?? paramString(params.error);
  if (verifyError) {
    console.warn(`[auth/callback] Supabase verify redirected with an error: ${verifyError}`);
    redirect("/login");
  }

  const tokenHash = paramString(params.token_hash);
  const type = paramString(params.type) as EmailOtpType | null;
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.warn(`[auth/callback] verifyOtp failed: ${error.message}`);
      redirect("/login");
    }
    redirect(next);
  }

  const code = paramString(params.code);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn(`[auth/callback] exchangeCodeForSession failed: ${error.message}`);
      redirect("/login");
    }
    redirect(next);
  }

  // No recognized query param — the expected shape with the default
  // template: the session is in the URL fragment, which only the browser
  // can see. Hand off to client-side completion.
  return <AuthCallbackClient next={next} />;
}
