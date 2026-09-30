import { NextResponse, type NextRequest } from "next/server";
import { answerMatches, unlockCookie, unlockToken } from "@/lib/gate";
import { clientIp, hashIp } from "@/server/ip";
import { loadBouquet } from "@/server/load";
import { getStore } from "@/server/store";

/** Tries per bouquet and address, per 10 minutes (development is roomier, for test runs). */
const TRIES = process.env.NODE_ENV === "production" ? 15 : 1000;

/** Answer a bouquet's secret question; the right answer opens it on this device. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await loadBouquet(id);
  if (!b?.lockHash) return new NextResponse(null, { status: 404 });
  let attempt = "";
  try {
    const body = (await req.json()) as { answer?: unknown };
    attempt = typeof body.answer === "string" ? body.answer.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if ((await getStore().bumpRate(await hashIp(clientIp(req), `unlock:${b.id}:`))) > TRIES) {
    return NextResponse.json({ error: "That's a lot of guesses. Take a breath and try again in a few minutes." }, { status: 429 });
  }
  if (!(await answerMatches(attempt, b.lockHash))) return NextResponse.json({ error: "Not quite. Try again?" }, { status: 403 });
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(unlockCookie(b.id), await unlockToken(b.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
