import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { loadBouquet } from "@/server/load";
import { getStore } from "@/server/store";

/**
 * A signed-in visitor opened this bouquet: an inbox item is marked read, and one opened
 * from a link is kept in their Received gallery. (Their own bouquets are left alone.)
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const b = await loadBouquet((await params).id);
  if (!b) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const store = getStore();
  if (b.recipientId === user.id) await store.markRead(user.id, b.id);
  else if (b.senderId !== user.id) await store.keep(user.id, b.id);
  return NextResponse.json({ ok: true });
}
