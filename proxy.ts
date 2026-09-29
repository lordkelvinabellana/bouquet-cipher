import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Keeps sign-in sessions fresh: before a page renders, an expired access token is
 * swapped for a new one and the cookies are updated. Signed-out visits pass straight through.
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled() || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // pages and API routes, not static files or images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
