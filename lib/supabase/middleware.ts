import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Defense in depth: this is a single-user app with no per-user data
  // isolation anywhere in the schema, so "any successfully authenticated
  // Supabase account" being treated as authorized is only safe as long as
  // exactly one account can ever exist. The real control for that is
  // disabling public signup in the Supabase dashboard — this just makes
  // sure a stray or future second account (signup left on by accident,
  // an invite link, anything) can never actually reach the app's data
  // even if one gets created. No-ops if OWNER_EMAIL isn't set.
  const ownerEmail = process.env.OWNER_EMAIL;
  if (user && !isPublicPath && ownerEmail && user.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
