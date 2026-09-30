import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isUnlocked, unlockCookie } from "@/lib/gate";
import { loadBouquet } from "@/server/load";
import { getStore } from "@/server/store";

/** The photo tucked in with a bouquet's letter (behind the gate, and behind its question if it has one). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await loadBouquet(id);
  if (!b?.photo) return new NextResponse(null, { status: 404 });
  if (b.lockHash && !(await isUnlocked(b.id, (await cookies()).get(unlockCookie(b.id))?.value))) return new NextResponse(null, { status: 403 });
  const bytes = await getStore().photo(b.photo);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
