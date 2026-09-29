import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { getStore, type Addressing } from "@/server/store";
import { validateNewBouquet } from "@/server/validate";

/** Bouquets one address may create per 10 minutes. */
const RATE_LIMIT = 30;
const MAX_BODY = 8 * 1024;

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${process.env.RATE_LIMIT_SALT ?? "bouquet-cipher"}:${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "That's too much for one bouquet." }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const v = validateNewBouquet(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const store = getStore();
    const count = await store.bumpRate(await hashIp(clientIp(req)));
    if (count > RATE_LIMIT) {
      return NextResponse.json({ error: "You've sent a lot of bouquets. Try again in a few minutes." }, { status: 429 });
    }
    // Signed in, it's yours: saved to your Sent gallery and sealed with your account's seal.
    const user = await currentUser();
    let value = v.value;
    const to: Addressing = { senderId: user?.id ?? null, recipientId: null };
    if (user) {
      const me = await store.profile(user.id);
      if (me) value = { ...value, seal: me.seal, fromName: value.fromName ?? me.displayName };
    }
    // A reply goes straight to the original sender's inbox, if they have an account.
    if (value.replyTo) {
      const original = await store.get(value.replyTo);
      if (!original) return NextResponse.json({ error: "The bouquet you're replying to has wilted." }, { status: 400 });
      if (original.senderId && !user) return NextResponse.json({ error: "Sign in to reply to their inbox." }, { status: 401 });
      if (original.senderId && original.senderId !== user?.id) to.recipientId = original.senderId;
    }
    const saved = await store.create(value, to);
    return NextResponse.json({ id: saved.id, delivered: to.recipientId !== null }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "The bouquet couldn't be saved. Please try again." }, { status: 500 });
  }
}
