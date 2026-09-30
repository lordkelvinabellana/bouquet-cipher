/**
 * The private garden: when SITE_PASSPHRASE is set, the whole site asks for it once, and a
 * cookie remembers the answer. The cookie holds a keyed hash, never the passphrase, and
 * changing the passphrase closes the gate for everyone again.
 *
 * Link previews still work: bouquet pages keep their preview tags and pictures (the
 * flowers, never the words) for chat apps, and show the gate in place of the bouquet.
 *
 * Runs in the proxy and on the server alike (Web Crypto only).
 */

export const GATE_COOKIE = "bc-gate";
/** Remembered for a year: she shouldn't have to type it every time. */
export const GATE_MAX_AGE = 60 * 60 * 24 * 365;

export const gateEnabled = () => Boolean(process.env.SITE_PASSPHRASE?.trim());

/** Answers match however they're typed: "Our Café!" is "our cafe". */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/**
 * The server's own secret for signing cookies (COOKIE_SECRET, or else the server-only
 * Supabase key), mixed with the passphrase so changing it closes the gate again.
 */
const pepper = () => process.env.COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development-only";
const serverSecret = () => `${pepper()}:${process.env.SITE_PASSPHRASE ?? ""}`;

/** What the gate cookie holds once the passphrase is right. */
export const gateToken = () => hmac(serverSecret(), "gate:v1");

export async function isGateOpen(cookie: string | undefined): Promise<boolean> {
  if (!gateEnabled()) return true;
  return !!cookie && timingSafeEqual(cookie, await gateToken());
}

export async function passphraseMatches(attempt: string): Promise<boolean> {
  const want = normalizeAnswer(process.env.SITE_PASSPHRASE ?? "");
  return !!want && timingSafeEqual(await hmac(serverSecret(), normalizeAnswer(attempt)), await hmac(serverSecret(), want));
}

/** A locked bouquet, once answered: a cookie per bouquet. */
export const unlockCookie = (id: string) => `bc-open-${id}`;
export const unlockToken = (id: string) => hmac(serverSecret(), `unlock:${id}`);

export async function isUnlocked(id: string, cookie: string | undefined): Promise<boolean> {
  return !!cookie && timingSafeEqual(cookie, await unlockToken(id));
}

/** A secret question's answer, salted, as stored: "salt$hash". */
export async function hashAnswer(answer: string, salt = hex(crypto.getRandomValues(new Uint8Array(12)).buffer)): Promise<string> {
  return `${salt}$${await hmac(`${salt}:${pepper()}`, normalizeAnswer(answer))}`;
}

export async function answerMatches(attempt: string, stored: string): Promise<boolean> {
  const [salt] = stored.split("$");
  return !!salt && timingSafeEqual(await hashAnswer(attempt, salt), stored);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
