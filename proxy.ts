import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // manifest.webmanifest/icon/apple-icon are fetched directly by the
    // browser/iOS (install prompt, home-screen icon lookup) without an
    // authenticated session — they must stay reachable unauthenticated,
    // same reasoning as favicon.ico below.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
