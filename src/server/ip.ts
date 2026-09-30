import "server-only";
import type { NextRequest } from "next/server";

/** A salted hash of the caller's address (for rate limits; the address itself is never kept). */
export async function hashIp(ip: string, scope = ""): Promise<string> {
  const data = new TextEncoder().encode(`${process.env.RATE_LIMIT_SALT ?? "bouquet-cipher"}:${scope}${ip}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
