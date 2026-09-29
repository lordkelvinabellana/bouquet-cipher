import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { charFor, glyphFor, type Glyph } from "@/core/alphabet/v1";
import { charForKeyed, glyphForKeyed } from "@/core/alphabet/v2";
import { ALL_LEAF_TONES, PALETTES } from "@/core/art/palette";
import { cipherOf, growBouquet, ribbonSeedOf, saltOf, sealOf } from "@/core/bouquet";
import { cipherFor, isCipherKey, newCipherKey, sealFromSecret, siphash24 } from "@/core/cipher";
import { buildGenome, decodeGenome, signatureOf } from "@/core/genome/genome";
import { readingSequence } from "@/core/reveal/sequence";
import { canon, graphemes } from "@/core/text/canon";
import { fitToLimits } from "@/core/text/limits";
import { expectOnlySwings } from "./stable";

const u = (...points: number[]) => String.fromCodePoint(...points);

/** Any 16 bytes, written the way the app writes keys. */
const keyArb = fc.uint8Array({ minLength: 16, maxLength: 16 }).map((b) => Buffer.from(b).toString("base64url"));

/** Letters, capitals, accents, digits, punctuation, hearts, a mystery emoji and spaces. */
const EXTRA = [u(0xe9), u(0xf1), u(0xfc), u(0xc9), u(0xe7), u(0x2764, 0xfe0f), u(0x1f337), u(0x2019)];
const typed = fc
  .array(fc.constantFrom(..."etaoinshrdlucmwfgypbvkjxqzETAOIS.,!?'-0123456789     ", ...EXTRA), { maxLength: 70 })
  .map((cs) => fitToLimits(canon(cs.join(""), "live")));

/** One of everything the alphabet knows, plus things it doesn't. */
const GRAPHEMES = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?'-", ...EXTRA, u(0x1f469, 0x200d, 0x1f467), u(0x436)];

/** What a glyph is, minus the part a key may change (which bloom, which leaf of its tint, how many berries). */
function group(x: Glyph): string {
  switch (x.t) {
    case "bloom":
      return JSON.stringify({ ...x, species: null });
    case "leaf":
      return JSON.stringify({ ...x, shape: null });
    case "berries":
    case "pod":
      return "digit";
    default:
      return JSON.stringify(x);
  }
}

describe("SipHash-2-4", () => {
  // Reference vectors (key 00..0f, message 00..len-1) from the SipHash paper and reference code.
  const key = Uint8Array.from({ length: 16 }, (_, i) => i);
  const msg = (n: number) => Uint8Array.from({ length: n }, (_, i) => i);
  it("matches the published test vectors", () => {
    expect(siphash24(key, msg(0))).toBe(0x726fdb47dd0e0e31n);
    expect(siphash24(key, msg(1))).toBe(0x74f839c593dc67fdn);
    expect(siphash24(key, msg(15))).toBe(0xa129ca6149be45e5n);
  });
});

describe("bouquet keys", () => {
  it("are 22 url-safe characters, all different", () => {
    const keys = new Set(Array.from({ length: 2000 }, newCipherKey));
    expect(keys.size).toBe(2000);
    for (const k of keys) {
      expect(k).toHaveLength(22);
      expect(isCipherKey(k)).toBe(true);
    }
  });

  it("accepts exactly 16 bytes of base64url", () => {
    fc.assert(
      fc.property(keyArb, (k) => {
        expect(isCipherKey(k)).toBe(true);
      }),
    );
    const k = newCipherKey();
    for (const bad of [k.slice(0, 21), k + "A", k.slice(0, 21) + "B", k.slice(0, 20) + "+A", k.slice(0, 20) + "=A", "", null, 42, undefined]) {
      expect(isCipherKey(bad)).toBe(false);
    }
    expect(() => cipherFor("not a key", PALETTES.length)).toThrow();
    expect(cipherOf(null)).toBeNull();
    expect(cipherOf("")).toBeNull();
  });

  it("always give the same cipher", () => {
    fc.assert(
      fc.property(keyArb, (k) => {
        const a = cipherOf(k)!;
        const b = cipherOf(k)!;
        expect([a.salt, a.palette, a.shift(0), a.shift(79)]).toEqual([b.salt, b.palette, b.shift(0), b.shift(79)]);
        expect(a.salt).toBeGreaterThanOrEqual(0);
        expect(a.salt).toBeLessThanOrEqual(0x7fffffff);
        expect(a.palette).toBeGreaterThanOrEqual(0);
        expect(a.palette).toBeLessThan(PALETTES.length);
      }),
      { numRuns: 200 },
    );
  });

  it("reach every palette", () => {
    const used = new Set(Array.from({ length: 400 }, () => cipherOf(newCipherKey())!.palette));
    expect(used.size).toBe(PALETTES.length);
  });
});

describe("alphabet v2 (the keyed alphabet)", () => {
  const shiftArb = fc.nat({ max: 0xffffffff });

  it("is exactly v1 when the shift is 0", () => {
    for (const g of GRAPHEMES) {
      expect(glyphForKeyed(g, 0)).toEqual(glyphFor(g));
      expect(charForKeyed(glyphFor(g), 0)).toBe(charFor(glyphFor(g)));
    }
  });

  it("reads back every character under every shift", () => {
    fc.assert(
      fc.property(fc.constantFrom(...GRAPHEMES), shiftArb, (g, s) => {
        expect(charForKeyed(glyphForKeyed(g, s), s)).toBe(charFor(glyphFor(g)));
      }),
      { numRuns: 3000 },
    );
  });

  it("only shuffles within a group: vowels stay flowers, consonants stay leaves of their tint", () => {
    fc.assert(
      fc.property(fc.constantFrom(...GRAPHEMES), shiftArb, (g, s) => {
        expect(group(glyphForKeyed(g, s))).toBe(group(glyphFor(g)));
      }),
      { numRuns: 3000 },
    );
  });

  it("gives different letters different glyphs at the same position", () => {
    fc.assert(
      fc.property(shiftArb, (s) => {
        const letters = [..."abcdefghijklmnopqrstuvwxyz0123456789"];
        const glyphs = new Set(letters.map((c) => JSON.stringify(glyphForKeyed(c, s))));
        expect(glyphs.size).toBe(letters.length);
      }),
      { numRuns: 300 },
    );
  });
});

describe("keyed bouquets", () => {
  it("read back exactly the message they were grown from", () => {
    fc.assert(
      fc.property(typed, keyArb, (t, k) => {
        const c = canon(t);
        const cipher = cipherOf(k);
        expect(decodeGenome(buildGenome(c, cipher), cipher)).toBe(c);
        const read = readingSequence(growBouquet(c, cipher), cipher)
          .map((s) => s.char)
          .join("");
        expect(read).toBe(c);
      }),
      { numRuns: 300 },
    );
  });

  it("can't be read with the wrong key, or without one", () => {
    const message = "I love you more than words can say";
    fc.assert(
      fc.property(keyArb, keyArb, (k1, k2) => {
        fc.pre(k1 !== k2);
        const genome = buildGenome(message, cipherOf(k1));
        expect(decodeGenome(genome, cipherOf(k2))).not.toBe(message);
        expect(decodeGenome(genome, null)).not.toBe(message);
      }),
      { numRuns: 200 },
    );
  });

  it('make every "I love you" different', () => {
    const keys = Array.from({ length: 100 }, newCipherKey);
    const bouquets = keys.map((k) => growBouquet("I love you", cipherOf(k)));
    const looks = new Set(bouquets.map((b) => JSON.stringify(b.elements.map((e) => [e.glyph, e.m, e.art.shapes]))));
    expect(looks.size).toBe(keys.length);
    // the flowers themselves differ, not just where they sit
    const spellings = new Set(bouquets.map((b) => JSON.stringify(b.elements.map((e) => e.glyph))));
    expect(spellings.size).toBeGreaterThan(90);
  });

  it("spell the same letter differently along the message (not a simple substitution)", () => {
    fc.assert(
      fc.property(keyArb, (k) => {
        const genome = buildGenome("o".repeat(20), cipherOf(k));
        const species = new Set(genome.stems[0].elements.map((e) => (e.glyph.t === "bloom" ? e.glyph.species : "")));
        expect(species.size).toBeGreaterThan(1);
      }),
      { numRuns: 100 },
    );
  });

  it("never redraw an element when more is typed after it", () => {
    fc.assert(
      fc.property(typed, typed, keyArb, (a, more, k) => {
        const cipher = cipherOf(k);
        expectOnlySwings(growBouquet(a, cipher), growBouquet(fitToLimits(canon(a + more, "live")), cipher));
      }),
      { numRuns: 150 },
    );
  });

  it("keep older, unkeyed bouquets exactly as they were", () => {
    const t = "Happy birthday! Wishing you all the love";
    expect(JSON.stringify(growBouquet(t, null, 9))).toBe(JSON.stringify(growBouquet(t, cipherOf(null), 9)));
    const v1 = buildGenome(t);
    expect(v1.v).toBe(1);
    expect(buildGenome(t, cipherOf(newCipherKey())).v).toBe(2);
    expect(graphemes(t).filter((g) => g !== " ")).toHaveLength(growBouquet(t, null).elements.length);
  });
});

describe("seals and seeds", () => {
  it("draw the sender's seal when there is one, else one from the message", () => {
    const cipher = cipherOf(newCipherKey());
    expect(sealOf(12345, "hi", cipher)).toBe(12345);
    expect(sealOf(0, "hi", cipher)).toBe(0);
    expect(sealOf(null, "hi", cipher)).toBe(signatureOf("hi", cipher!.salt));
    expect(sealOf(undefined, "hi", null, 5)).toBe(signatureOf("hi", 5));
  });

  it("derive a steady, private seal from each device's secret", () => {
    const secrets = Array.from({ length: 300 }, newCipherKey);
    for (const s of secrets.slice(0, 20)) {
      const seal = sealFromSecret(s);
      expect(seal).toBe(sealFromSecret(s));
      expect(Number.isInteger(seal) && seal >= 0 && seal <= 0xffffffff).toBe(true);
    }
    expect(new Set(secrets.map(sealFromSecret)).size).toBeGreaterThan(295);
  });

  it("keep older bouquets' arrangement and ribbon seeds", () => {
    expect(saltOf(null, 42)).toBe(42);
    expect(ribbonSeedOf(null, 42)).toBe(49);
    const cipher = cipherOf(newCipherKey())!;
    expect(saltOf(cipher, 42)).toBe(cipher.salt);
    expect(ribbonSeedOf(cipher)).toBeGreaterThanOrEqual(7);
    expect(ribbonSeedOf(cipher)).toBeLessThan(100_007);
  });
});

describe("palettes", () => {
  /** Hue (degrees), saturation and lightness of a #RRGGBB colour. */
  function hsl(hex: string): [number, number, number] {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }

  it("never give leaves a dark, grey or brown (withered) colour", () => {
    for (const tone of ALL_LEAF_TONES) {
      for (const [which, hex] of Object.entries(tone)) {
        const [h, s, l] = hsl(hex);
        const where = `${which} ${hex}`;
        expect(l, `${where} is too dark`).toBeGreaterThanOrEqual(which === "dark" ? 0.4 : 0.55);
        expect(s, `${where} is too grey`).toBeGreaterThanOrEqual(0.12);
        // oranges and ambers go brown when dull or dark: keep them bright
        if (h >= 10 && h <= 55) {
          expect(s, `${where} could look brown`).toBeGreaterThanOrEqual(0.5);
          expect(l, `${where} could look brown`).toBeGreaterThanOrEqual(0.6);
        }
        // yellow-greens go olive (dried out) when dull
        if (h > 55 && h < 85) {
          expect(s, `${where} could look olive`).toBeGreaterThanOrEqual(0.35);
          expect(l, `${where} could look olive`).toBeGreaterThanOrEqual(0.5);
        }
      }
    }
  });

  it("dress each leaf tier differently", () => {
    for (const p of PALETTES) {
      const bases = new Set(Object.values(p.leaves).map((t) => t.base));
      expect(bases.size, p.name).toBe(3);
    }
  });

  it("keep palette 0 as the original look", () => {
    expect(PALETTES[0].name).toBe("Garden");
    expect(PALETTES.map((p) => p.id)).toEqual(PALETTES.map((_, i) => i));
  });
});
