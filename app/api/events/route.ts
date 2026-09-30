import { NextResponse, type NextRequest } from "next/server";
import { isBot, parseEvent } from "@/lib/events";
import { isDevTraffic } from "@/server/analytics";
import { getStore } from "@/server/store";

const MAX_BODY = 1024;

/** Count one event from the browser. Always answers 204: counting never fails loudly. */
export async function POST(req: NextRequest) {
  try {
    if (isBot(req.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });
    const text = await req.text();
    if (text.length > MAX_BODY) return new NextResponse(null, { status: 204 });
    const event = parseEvent(JSON.parse(text));
    if (event) await getStore().track(event, isDevTraffic());
  } catch (err) {
    console.error(err);
  }
  return new NextResponse(null, { status: 204 });
}
