import { beforeAll, describe, expect, it } from "vitest";
import { answerMatches, hashAnswer, isGateOpen, gateToken, isUnlocked, normalizeAnswer, passphraseMatches, unlockToken } from "@/lib/gate";

beforeAll(() => {
  process.env.SITE_PASSPHRASE = "Sunflower Fields";
  process.env.COOKIE_SECRET = "a-test-secret";
});

describe("the private garden's gate and locks", () => {
  it("matches answers however they're typed", () => {
    expect(normalizeAnswer("  The Café!! ")).toBe("the cafe");
    expect(normalizeAnswer("Mañana, 2026")).toBe("manana 2026");
  });

  it("opens only for the passphrase, and only with a cookie it signed", async () => {
    expect(await passphraseMatches("sunflower   fields")).toBe(true);
    expect(await passphraseMatches("sunflowers")).toBe(false);
    expect(await isGateOpen(await gateToken())).toBe(true);
    expect(await isGateOpen("0".repeat(64))).toBe(false);
    expect(await isGateOpen(undefined)).toBe(false);
  });

  it("closes again when the passphrase changes", async () => {
    const before = await gateToken();
    process.env.SITE_PASSPHRASE = "a new one";
    expect(await isGateOpen(before)).toBe(false);
    process.env.SITE_PASSPHRASE = "Sunflower Fields";
  });

  it("keeps only a salted hash of a lock's answer", async () => {
    const a = await hashAnswer("The Café");
    const b = await hashAnswer("The Café");
    expect(a).not.toContain("cafe");
    expect(a).not.toBe(b); // a new salt each time
    expect(a).toMatch(/^[0-9a-f]{24}\$[0-9a-f]{64}$/);
    expect(await answerMatches("the cafe", a)).toBe(true);
    expect(await answerMatches("the library", a)).toBe(false);
  });

  it("opens one locked bouquet, not the others", async () => {
    const t = await unlockToken("ABCDE12345");
    expect(await isUnlocked("ABCDE12345", t)).toBe(true);
    expect(await isUnlocked("ZZZZZ99999", t)).toBe(false);
  });
});
