import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, gateEnabled, gateToken, passphraseMatches } from "@/lib/gate";
import { clientIp, hashIp } from "@/server/ip";
import { getStore } from "@/server/store";

/** Guesses one address may make per 10 minutes (development is roomier, for test runs). */
const TRIES = process.env.NODE_ENV === "production" ? 12 : 1000;

/** Open the gate: check the passphrase, and remember it with a cookie. */
export async function POST(req: NextRequest) {
  if (!gateEnabled()) return new NextResponse(null, { status: 204 });
  let attempt = "";
  try {
    const body = (await req.json()) as { passphrase?: unknown };
    attempt = typeof body.passphrase === "string" ? body.passphrase.slice(0, 200) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const tries = await getStore().bumpRate(await hashIp(clientIp(req), "gate:"));
  if (tries > TRIES) return NextResponse.json({ error: "That's a lot of tries. Wait a few minutes and try again." }, { status: 429 });
  if (!(await passphraseMatches(attempt))) return NextResponse.json({ error: "That's not it. Try again?" }, { status: 403 });
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(GATE_COOKIE, await gateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
