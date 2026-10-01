import { NextResponse } from "next/server";
import { getStore } from "@/server/store";

/** One of the greeting's photos (greeting-1.jpg … in the private bucket), behind the gate. */
export async function GET(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  if (!/^[1-9]$/.test(n)) return new NextResponse(null, { status: 404 });
  const bytes = await getStore().photo(`greeting-${n}.jpg`);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
