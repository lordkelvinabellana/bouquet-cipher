/**
 * What the app counts, and nothing more. Events carry no message text, names, emails or
 * IP addresses: just what happened, a random id for the browser tab it happened in (so
 * a funnel can be followed), and at most a few small flags.
 */

export const EVENTS = {
  // pages
  home_view: "Visited the home page",
  create_view: "Opened the composer",
  // sending
  write_start: "Started writing",
  wrap: "Wrapped a bouquet",
  sent: "Sent a bouquet or card",
  link_copy: "Copied a link",
  picture_save: "Saved or shared the picture",
  video_make: "Made a video",
  video_share: "Shared or saved a video",
  // receiving
  open: "Opened a bouquet",
  read: "Read one to the end",
  puzzle_start: "Started decoding it themselves",
  puzzle_solved: "Solved it themselves",
  puzzle_give_up: "Gave up on the puzzle",
  reply_start: "Started a reply",
  // accounts
  signin: "Signed in",
  signup: "Made an account",
} as const;

export type EventName = keyof typeof EVENTS;

/** A few small flags: `{ reveal: true }`, `{ kind: "card" }`, `{ guesses: 7 }`. */
export type EventProps = Record<string, string | number | boolean>;

export interface TrackedEvent {
  name: EventName;
  session: string | null;
  bouquet: string | null;
  props: EventProps | null;
}

const SESSION = /^[A-Za-z0-9_-]{8,40}$/;
const BOUQUET = /^[0-9A-Z]{10}$/;
const PROP_KEY = /^[a-z][a-zA-Z]{0,15}$/;

export const isEventName = (s: unknown): s is EventName => typeof s === "string" && Object.hasOwn(EVENTS, s);
export const isSessionId = (s: unknown): s is string => typeof s === "string" && SESSION.test(s);

function cleanProps(p: unknown): EventProps | null {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const out: EventProps = {};
  for (const [k, v] of Object.entries(p).slice(0, 6)) {
    if (!PROP_KEY.test(k)) continue;
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
    else if (typeof v === "string" && v.length <= 24) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** An event from the browser, checked; null if it isn't one we count. */
export function parseEvent(body: unknown): TrackedEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!isEventName(b.name)) return null;
  return {
    name: b.name,
    session: isSessionId(b.session) ? b.session : null,
    bouquet: typeof b.bouquet === "string" && BOUQUET.test(b.bouquet) ? b.bouquet : null,
    props: cleanProps(b.props),
  };
}

/** Link previews, crawlers and uptime checks aren't people. */
export const isBot = (userAgent: string | null) => !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse/i.test(userAgent);
