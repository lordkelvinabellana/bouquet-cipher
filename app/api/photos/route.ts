import { NextResponse, type NextRequest } from "next/server";
import { FLAGS } from "@/lib/flags";
import { clientIp, hashIp } from "@/server/ip";
import { getStore } from "@/server/store";

/** Photos are shrunk in the browser first (see lib/photo.ts); this is plenty. */
const MAX_BYTES = 3 * 1024 * 1024;
const PER_WINDOW = process.env.NODE_ENV === "production" ? 20 : 1000;

/** Keep a photo for a letter. The body is the JPEG itself; answers with its name. */
export async function POST(req: NextRequest) {
  if (!FLAGS.photos) return NextResponse.json({ error: "Photos aren't switched on." }, { status: 404 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "That photo is too big." }, { status: 413 });
  // a JPEG starts FF D8 FF
  if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return NextResponse.json({ error: "That doesn't look like a photo." }, { status: 400 });
  }
  const store = getStore();
  if ((await store.bumpRate(await hashIp(clientIp(req), "photo:"))) > PER_WINDOW) {
    return NextResponse.json({ error: "That's a lot of photos. Try again in a few minutes." }, { status: 429 });
  }
  const name = `${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("")}.jpg`;
  try {
    await store.savePhoto(name, bytes);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "The photo couldn't be kept. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ name }, { status: 201 });
}
