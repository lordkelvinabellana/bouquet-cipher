/**
 * Where to go after signing in. Only paths on this site are allowed ("/bouquets", not
 * "https://elsewhere" or "//elsewhere"), so a link can't bounce someone off-site.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://x");
    return url.origin === "http://x" ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
