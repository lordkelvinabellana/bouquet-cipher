import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/flags";
import { today } from "@/server/personal";

export const dynamic = "force-dynamic";

/** Today in the private garden: the nickname, and on a monthsary its greeting and note. Behind the gate. */
export function GET() {
  if (!FLAGS.garden) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(today(), { headers: { "Cache-Control": "private, no-store" } });
}
