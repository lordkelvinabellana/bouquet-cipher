import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { supabaseServer } from "@/lib/supabase/server";

/** Where Google (or any sign-in provider) sends people back to, with a one-time code. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=provider&next=${encodeURIComponent(next)}`, url.origin));
}
