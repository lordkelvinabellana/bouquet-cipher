import "server-only";
import { isSessionId, type EventName, type EventProps } from "@/lib/events";
import { getStore } from "./store";

/** Only the live site's traffic counts; local runs and preview deployments are marked dev. */
export const isDevTraffic = () => process.env.VERCEL_ENV !== "production";

/** Count an event the server saw happen (a bouquet sent). Never throws. */
export async function recordEvent(name: EventName, opts: { session?: string | null; bouquet?: string | null; props?: EventProps | null } = {}) {
  try {
    await getStore().track(
      { name, session: isSessionId(opts.session) ? opts.session : null, bouquet: opts.bouquet ?? null, props: opts.props ?? null },
      isDevTraffic(),
    );
  } catch (err) {
    console.error(err);
  }
}
