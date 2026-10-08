/**
 * Which garden bouquets she has opened, kept in a cookie on her device so the garden can
 * show them (and the next one to open) from its first paint.
 */
export const OPENED_COOKIE = "bc-opened";
const ID = /^[0-9A-Z]{10}$/;

export function parseOpened(value: string | null | undefined): Set<string> {
  return new Set((value ?? "").split(".").filter((id) => ID.test(id)));
}

/** Browser only: the cookie's raw value. */
export function openedCookie(): string {
  return document.cookie.match(new RegExp(`(?:^|; )${OPENED_COOKIE}=([^;]*)`))?.[1] ?? "";
}

/** Browser only. */
export function readOpened(): Set<string> {
  return parseOpened(openedCookie());
}

function write(ids: Set<string>, maxAge: number) {
  document.cookie = `${OPENED_COOKIE}=${[...ids].join(".")}; Path=/; Max-Age=${maxAge}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Browser only. */
export function markOpened(id: string) {
  if (!ID.test(id)) return;
  const ids = readOpened();
  if (ids.has(id)) return;
  ids.add(id);
  write(ids, 60 * 60 * 24 * 400);
}

/** Browser only: start the garden over, every bouquet unopened again. */
export function forgetOpened() {
  write(new Set(), 0);
}
