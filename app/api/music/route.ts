import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/flags";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

/** The garden's songs, in order, to play while she reads. Behind the gate. */
export async function GET() {
  if (!FLAGS.garden) return NextResponse.json([], { status: 404 });
  return NextResponse.json(await getStore().songs(), { headers: { "Cache-Control": "private, no-store" } });
}
