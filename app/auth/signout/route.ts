import { NextResponse, type NextRequest } from "next/server";
import { authEnabled } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (authEnabled()) await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.nextUrl.origin), { status: 303 });
}
