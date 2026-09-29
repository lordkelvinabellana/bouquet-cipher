import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { getStore } from "@/server/store";

/** Who's signed in (for the account link in page headers), and how much is unread. */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!authEnabled()) return NextResponse.json({ enabled: false, user: null, unread: 0 }, { headers });
  const user = await currentUser();
  if (!user) return NextResponse.json({ enabled: true, user: null, unread: 0 }, { headers });
  const store = getStore();
  const [me, unread] = await Promise.all([store.profile(user.id), store.unread(user.id)]);
  return NextResponse.json({ enabled: true, user: { name: me?.displayName ?? null }, unread }, { headers });
}
