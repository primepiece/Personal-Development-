import { createClient } from "@supabase/supabase-js";

/**
 * A plain (non-SSR) Supabase client used only to request the magic-link
 * email. @supabase/ssr's createBrowserClient hardcodes flowType: "pkce",
 * with no override — but PKCE requires the code_verifier cookie it writes
 * to still be readable wherever the link is later opened, which an
 * emailed link can't guarantee (Gmail's in-app browser, an installed
 * standalone PWA's own isolated storage vs. regular Safari, a different
 * device — all normal, not edge cases, for something delivered by email).
 *
 * This client explicitly requests the implicit flow instead: Supabase
 * then redirects the completed session directly in the URL fragment,
 * which needs no stored state to complete — see
 * app/auth/callback/auth-callback-client.tsx. Only used for the one
 * signInWithOtp() call; never persists or reads a session itself.
 */
export function createOtpRequestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
