import { after, NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { isBot } from "@/lib/events";
import { FLAGS } from "@/lib/flags";
import { GATE_COOKIE, hashAnswer, isGateOpen, normalizeAnswer } from "@/lib/gate";
import { isDevTraffic, recordEvent } from "@/server/analytics";
import { getStore, type Addressing } from "@/server/store";
import { warmLinkPreview } from "@/server/warm";
import { clientIp, hashIp } from "@/server/ip";
import { validateNewBouquet } from "@/server/validate";

/** Bouquets one address may create per 10 minutes (development is roomier, for test runs). */
const RATE_LIMIT = process.env.NODE_ENV === "production" ? 30 : 1000;
const MAX_BODY = 8 * 1024;

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
      if (me) value = { ...value, seal: me.seal, sealStyle: me.sealStyle, fromName: value.fromName ?? me.displayName };
    }
    // Private-garden extras: only from past its gate, each only when it's switched on.
    const ours = FLAGS.garden && (await isGateOpen(req.cookies.get(GATE_COOKIE)?.value));
    const planted = ours && value.garden === true;
    value = {
      ...value,
      garden: planted,
      month: planted ? value.month : null,
      test: isDevTraffic(),
      photo: ours && FLAGS.photos ? value.photo : null,
      lock: ours && FLAGS.locks ? value.lock : null,
    };
    if (value.lock) {
      if (!normalizeAnswer(value.lock.answer)) return NextResponse.json({ error: "The answer needs a letter or a number in it." }, { status: 400 });
      value = { ...value, lockHash: await hashAnswer(value.lock.answer) };
    }
    // A reply goes straight to the original sender's inbox, if they have an account.
    if (value.replyTo && FLAGS.accounts) {
      const original = await store.get(value.replyTo);
      if (!original) return NextResponse.json({ error: "The bouquet you're replying to has wilted." }, { status: 400 });
      if (original.senderId && !user) return NextResponse.json({ error: "Sign in to reply to their inbox." }, { status: 401 });
      if (original.senderId && original.senderId !== user?.id) to.recipientId = original.senderId;
    }
    const saved = await store.create(value, to);
    if (!isBot(req.headers.get("user-agent"))) {
      await recordEvent("sent", {
        session: req.headers.get("x-bc-session"),
        bouquet: saved.id,
        props: { kind: value.kind, reply: value.replyTo !== null, signedIn: user !== null, inbox: to.recipientId !== null },
      });
    }
    // on the live site, have the link preview ready before anyone pastes the link
    if (process.env.VERCEL_ENV === "production") after(() => warmLinkPreview(`${req.nextUrl.origin}/b/${saved.id}`));
    return NextResponse.json({ id: saved.id, delivered: to.recipientId !== null }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "The bouquet couldn't be saved. Please try again." }, { status: 500 });
  }
}
