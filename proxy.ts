import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { FLAGS } from "@/lib/flags";
import { GATE_COOKIE, gateEnabled, isGateOpen } from "@/lib/gate";
import { specialPath } from "@/server/personal";
import { authEnabled, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Runs before every page and API route: switched-off features lead home, the private
 * garden's gate is kept, and sign-in sessions are kept fresh: before a page renders, an expired access token is
 * swapped for a new one and the cookies are updated. Signed-out visits pass straight through.
 */
/** With accounts off, their pages simply lead home. */
const ACCOUNT_PAGES = /^\/(login|reset|bouquets|auth)(\/|$)/;

/**
 * The private garden's own pages, behind the gate (the special link too); the rest is the
 * public app. Bouquet pages decide for themselves: only the garden's ask for the secret word,
 * and they keep their preview tags while showing the gate in place of the flowers.
 */
const BEHIND_THE_GATE = /^\/(greeting|garden|finale|api\/(today|music|photos)|b\/[0-9A-Z]{10}\/(photo|thumb))(\/|$)/;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if ((!FLAGS.accounts && ACCOUNT_PAGES.test(path)) || (!FLAGS.stats && path.startsWith("/stats"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (gateEnabled() && (BEHIND_THE_GATE.test(path) || path === specialPath()) && !(await isGateOpen(request.cookies.get(GATE_COOKIE)?.value))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "This garden is private." }, { status: 401 });
    const gate = new URL("/gate", request.url);
    gate.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(gate);
  }
  // the special link (e.g. /for-april) opens on the greeting, past the gate
  if (FLAGS.garden && path === specialPath()) return NextResponse.rewrite(new URL("/greeting", request.url));
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
