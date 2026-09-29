import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * The link in a sign-in email. Our template (supabase/templates/sign-in.html) sends a
 * token hash, which works on any device; Supabase's default template sends a one-time
 * code instead, which works in the browser that asked for the email.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const auth = (await supabaseServer()).auth;
  if (tokenHash) {
    const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
    const { error } = await auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
