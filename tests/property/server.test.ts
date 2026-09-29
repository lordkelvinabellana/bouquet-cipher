import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fitInsertion } from "@/input/useGardenInput";
import { canon } from "@/core/text/canon";
import { measure } from "@/core/text/limits";
import { isCipherKey, newCipherKey } from "@/core/cipher";
import { safeNext } from "@/lib/redirect";
import { ID_PATTERN, newBouquetId, validateNewBouquet } from "@/server/validate";

describe("validateNewBouquet", () => {
  it("accepts a normal bouquet and canonicalises it", () => {
    const v = validateNewBouquet({ message: "  I love   you  ", salt: 3, toName: " Sam ", fromName: "" });
    expect(v).toEqual({
      ok: true,
      value: {
        kind: "bouquet",
        message: "I love you",
        salt: 3,
        paper: 0,
        cipherKey: expect.any(String),
        seal: null,
        toName: "Sam",
        fromName: null,
        replyTo: null,
      },
    });
  });

  it("keeps the sender's key and seal, and makes a key when there isn't one", () => {
    const key = newCipherKey();
    const kept = validateNewBouquet({ message: "hi", key, seal: 0xffffffff });
    expect(kept.ok && [kept.value.cipherKey, kept.value.seal]).toEqual([key, 0xffffffff]);
    const a = validateNewBouquet({ message: "hi" });
    const b = validateNewBouquet({ message: "hi", key: null, seal: null });
    expect(a.ok && isCipherKey(a.value.cipherKey)).toBe(true);
    expect(b.ok && isCipherKey(b.value.cipherKey)).toBe(true);
    expect(a.ok && b.ok && a.value.cipherKey !== b.value.cipherKey).toBe(true);
    expect(validateNewBouquet({ message: "hi", seal: 0 }).ok).toBe(true);
  });

  it("refuses broken keys and seals", () => {
    const key = newCipherKey();
    for (const bad of ["abc", key + "x", key.slice(0, 21) + "B", 42, {}]) {
      expect(validateNewBouquet({ message: "hi", key: bad }).ok).toBe(false);
    }
    for (const bad of [-1, 1.5, 2 ** 32, "12", Number.NaN]) {
      expect(validateNewBouquet({ message: "hi", seal: bad }).ok).toBe(false);
    }
  });

  it("refuses what the composer would refuse", () => {
    expect(validateNewBouquet({ message: "" }).ok).toBe(false);
    expect(validateNewBouquet({ message: " \n " }).ok).toBe(false);
    expect(validateNewBouquet({ message: "ab ".repeat(45) }).ok).toBe(false);
    expect(validateNewBouquet({ message: "ab ".repeat(26) + "ab" }).ok).toBe(true);
    expect(validateNewBouquet({ message: "x".repeat(25) }).ok).toBe(false);
    expect(validateNewBouquet({ message: "hi", salt: -1 }).ok).toBe(false);
    expect(validateNewBouquet({ message: "hi", salt: 1.5 }).ok).toBe(false);
    expect(validateNewBouquet({ message: "hi", toName: "n".repeat(41) }).ok).toBe(false);
    expect(validateNewBouquet({ message: 42 }).ok).toBe(false);
    expect(validateNewBouquet({ message: "hi", paper: 4 }).ok).toBe(false);
    expect(validateNewBouquet({ message: "hi", paper: -1 }).ok).toBe(false);
    expect(validateNewBouquet(null).ok).toBe(false);
  });

  it("turns line breaks in names into spaces", () => {
    const v = validateNewBouquet({ message: "hi", fromName: "Alex\nand Sam" });
    expect(v.ok && v.value.fromName).toBe("Alex and Sam");
  });
});

describe("replies and cards", () => {
  it("accepts a reply to a bouquet code, and refuses anything else", () => {
    const ok = validateNewBouquet({ message: "Thank you", replyTo: "K7M2Q9XWPT" });
    expect(ok.ok && ok.value.replyTo).toBe("K7M2Q9XWPT");
    for (const bad of ["abc", "K7M2Q-9XWPT", 12, {}, "../../etc"]) expect(validateNewBouquet({ message: "hi", replyTo: bad }).ok).toBe(false);
    expect(validateNewBouquet({ message: "hi", replyTo: null }).ok).toBe(true);
  });

  it("knows bouquets from cards, and lets a card have long words", () => {
    const card = validateNewBouquet({ kind: "card", message: "Supercalifragilisticexpialidocious!" });
    expect(card.ok && card.value.kind).toBe("card");
    expect(validateNewBouquet({ message: "Supercalifragilisticexpialidocious!" }).ok).toBe(false);
    expect(validateNewBouquet({ kind: "letter", message: "hi" }).ok).toBe(false);
    expect(validateNewBouquet({ kind: "card", message: "ab ".repeat(45) }).ok).toBe(false);
  });
});

describe("where sign-in returns to", () => {
  it("only ever goes to a page on this site", () => {
    expect(safeNext("/bouquets?tab=sent")).toBe("/bouquets?tab=sent");
    expect(safeNext("/b/K7M2Q9XWPT")).toBe("/b/K7M2Q9XWPT");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined, "bouquets"]) {
      expect(safeNext(bad)).toBe("/");
    }
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = safeNext(s);
        expect(out.startsWith("/") && !out.startsWith("//") && !out.startsWith("/\\")).toBe(true);
      }),
    );
  });
});

describe("bouquet ids", () => {
  it("are 10 random, unambiguous characters", () => {
    const ids = new Set(Array.from({ length: 2000 }, newBouquetId));
    expect(ids.size).toBe(2000);
    for (const id of ids) {
      expect(id).toMatch(ID_PATTERN);
      expect(id).not.toMatch(/[ILOU]/);
    }
  });
});

describe("fitInsertion (pasting over the limit)", () => {
  const words = fc.array(fc.constantFrom(..."abcdefgh ,.!"), { maxLength: 120 }).map((a) => a.join(""));
  it("keeps the text around the paste and trims only the pasted part", () => {
    fc.assert(
      fc.property(words, words, fc.nat(), (before, pasted, at) => {
        const prev = canon(before, "live").slice(0, 60);
        if (!measure(canon(prev, "live")).ok) return;
        const cut = at % (prev.length + 1);
        const next = prev.slice(0, cut) + pasted + prev.slice(cut);
        const fitted = fitInsertion(prev, next);
        expect(measure(canon(fitted.value, "live")).ok).toBe(true);
        expect(fitted.value.startsWith(prev.slice(0, Math.min(cut, fitted.caret)))).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});
