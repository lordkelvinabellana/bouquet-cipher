import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ACCENTS, BLOOM_OF, HEARTS, LEAF_OF, MARKS, charFor, glyphFor } from "@/core/alphabet/v1";
import { buildGenome, decodeGenome } from "@/core/genome/genome";
import { canon, graphemes, isSeparator } from "@/core/text/canon";
import { MAX_GRAPHEMES, MAX_STEM_GRAPHEMES, fitToLimits, measure } from "@/core/text/limits";

/** Strings from code points, so no invisible characters live in this file. */
const u = (...points: number[]) => String.fromCodePoint(...points);

const ACUTE = u(0x301);
const ZWJ = u(0x200d);
const FAMILY = [u(0x1f469), u(0x1f469), u(0x1f467)].join(ZWJ);

/** Text weighted toward the awkward cases: whitespace runs, NFD accents, emoji sequences, invisibles. */
const tricky = fc.constantFrom(
  " ",
  "   ",
  "\n",
  "\r\n",
  "\r",
  "\t",
  u(0xa0), // no-break space
  u(0x3000), // ideographic space
  u(0x2028), // line separator
  "e" + ACUTE, // decomposed e-acute
  "a" + u(0x308),
  ACUTE, // lone combining mark
  " " + ACUTE, // space carrying a mark (not a separator)
  u(0x1ec6), // precomposed E with circumflex and dot below
  "e" + u(0x323, 0x302), // stacked marks
  FAMILY,
  u(0x2764, 0xfe0f),
  u(0x1f1ef, 0x1f1f5), // flag
  u(0x1f44d, 0x1f3fd), // skin tone
  u(0xdf), // sharp s
  u(0x200b), // zero-width space
  u(0xfeff), // BOM
  u(0xad), // soft hyphen
  u(0x2026),
  u(0x2019),
  u(0x2014),
  u(0x1c5), // titlecase digraph
);
const plain = fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,!?'-0123456789");
const textArb = fc
  .array(fc.oneof(plain, plain, tricky, fc.string({ unit: "grapheme", maxLength: 4 }), fc.string({ unit: "binary", maxLength: 3 })), {
    maxLength: 60,
  })
  .map((parts) => parts.join(""));

const RUNS = { numRuns: 3000 };

describe("canonical text", () => {
  it("is idempotent in both modes", () => {
    fc.assert(
      fc.property(textArb, (t) => {
        expect(canon(canon(t))).toBe(canon(t));
        expect(canon(canon(t, "live"), "live")).toBe(canon(t, "live"));
        expect(canon(canon(t, "live"))).toBe(canon(t));
      }),
      RUNS,
    );
  });

  it("has no leading whitespace, no runs, no invisibles, and no trailing whitespace when final", () => {
    const banned = new RegExp(`[\\r\\t${u(0xa0, 0x200b, 0xfeff, 0xad, 0x2028)}]`);
    fc.assert(
      fc.property(textArb, (t) => {
        const c = canon(t);
        expect(c).not.toMatch(/^[ \n]/);
        expect(c).not.toMatch(/[ \n]$/);
        expect(c).not.toMatch(/[ \n]{2}/);
        expect(c).not.toMatch(banned);
        expect(c).toBe(c.normalize("NFC"));
      }),
      RUNS,
    );
  });

  it("handles the everyday cases", () => {
    expect(canon("  hello   world \r\n\r\n  bye  ")).toBe("hello world\nbye");
    expect(canon("hi ", "live")).toBe("hi ");
    expect(canon("hi   \n ", "live")).toBe("hi\n");
    expect(canon("Cafe" + ACUTE)).toBe("Caf" + u(0xe9));
    expect(canon("a" + u(0x200b) + "b" + u(0xfeff) + "c")).toBe("abc");
  });
});

describe("genome", () => {
  it("round-trips any text exactly", () => {
    fc.assert(
      fc.property(textArb, (t) => {
        const c = canon(t);
        expect(decodeGenome(buildGenome(c))).toBe(c);
        const live = canon(t, "live");
        expect(decodeGenome(buildGenome(live))).toBe(live);
      }),
      RUNS,
    );
  });

  it("maps every grapheme to a glyph that maps back to it", () => {
    fc.assert(
      fc.property(textArb, (t) => {
        for (const g of graphemes(canon(t))) {
          if (!isSeparator(g)) expect(charFor(glyphFor(g))).toBe(g);
        }
      }),
      RUNS,
    );
  });

  it("makes one stem per word, read bottom to top", () => {
    const genome = buildGenome("I love you");
    expect(genome.stems.map((s) => s.elements.map((e) => e.g).join(""))).toEqual(["I", "love", "you"]);
    expect(genome.stems.map((s) => s.end)).toEqual(["space", "space", "eof"]);
    const love = genome.stems[1].elements.map((e) => e.glyph);
    expect(love[0]).toMatchObject({ t: "leaf", shape: "lobed", tint: "sage", upper: false });
    expect(love[1]).toMatchObject({ t: "bloom", species: "rose" });
    expect(love[2]).toMatchObject({ t: "leaf", shape: "heart", tint: "coral" });
    expect(love[3]).toMatchObject({ t: "bloom", species: "tulip" });
    expect(genome.pending).toBe(false);
    expect(buildGenome("I love ").pending).toBe(true);
  });

  it("keeps newlines as stem endings", () => {
    const genome = buildGenome("Dear Sam,\nhappy day");
    expect(genome.stems.map((s) => s.end)).toEqual(["space", "newline", "space", "eof"]);
  });
});

describe("floral alphabet v1", () => {
  it("covers every Latin letter exactly once", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz") {
      expect(ch in BLOOM_OF !== ch in LEAF_OF).toBe(true);
    }
    expect(Object.keys(BLOOM_OF).sort().join("")).toBe("aeiouy");
    const leafKeys = Object.values(LEAF_OF).map((l) => `${l.shape}/${l.tint}`);
    expect(new Set(leafKeys).size).toBe(leafKeys.length);
  });

  it("round-trips letters with every supported accent, in both cases", () => {
    for (const ch of "aeiouybcdfghjklmnpqrstvwxz") {
      for (const base of [ch, ch.toUpperCase()]) {
        expect(charFor(glyphFor(base))).toBe(base);
        for (const acc of ACCENTS) {
          const g = (base + acc).normalize("NFC");
          if (graphemes(g).length !== 1) continue;
          expect(charFor(glyphFor(g))).toBe(g);
        }
      }
    }
    expect(glyphFor(u(0xe9))).toEqual({ t: "bloom", species: "tulip", upper: false, accents: [0] });
  });

  it("round-trips marks, digits and hearts", () => {
    for (const [ch] of MARKS) expect(charFor(glyphFor(ch))).toBe(ch);
    for (const ch of "0123456789") expect(charFor(glyphFor(ch))).toBe(ch);
    for (const h of HEARTS) {
      expect(glyphFor(h).t).toBe("heart");
      expect(charFor(glyphFor(h))).toBe(h);
    }
  });

  it("turns anything else into a mystery seed that keeps the character", () => {
    for (const g of [u(0xdf), u(0xf8), u(0x1f60a), "&", FAMILY, u(0x65e5)]) {
      const glyph = glyphFor(g);
      expect(glyph.t).toBe("seed");
      expect(charFor(glyph)).toBe(g);
    }
  });
});

describe("limits", () => {
  it("fits any text into a prefix that passes", () => {
    fc.assert(
      fc.property(textArb, textArb, (a, b) => {
        const c = canon(a + " " + b + a + b, "live");
        const fitted = fitToLimits(c);
        expect(c.startsWith(fitted)).toBe(true);
        const report = measure(fitted);
        expect(report.ok).toBe(true);
        expect(report.count).toBeLessThanOrEqual(MAX_GRAPHEMES);
        expect(report.longestStem).toBeLessThanOrEqual(MAX_STEM_GRAPHEMES);
      }),
      RUNS,
    );
  });

  it("counts graphemes, not code units", () => {
    expect(measure(FAMILY + " hi").count).toBe(4);
    expect(measure("x".repeat(25)).stemTooLong).toBe(true);
    expect(measure("a".repeat(MAX_GRAPHEMES)).tooLong).toBe(false);
    expect(measure("a".repeat(MAX_GRAPHEMES + 1)).tooLong).toBe(true);
  });
});
