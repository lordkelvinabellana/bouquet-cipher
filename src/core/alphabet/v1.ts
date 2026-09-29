/**
 * Floral Alphabet v1: the cipher that turns characters into plant parts.
 *
 * FROZEN once shipped. Bouquets store `alphabet_v = 1`, and changing any mapping here
 * would change what old bouquets say. New ideas go into a v2 module instead.
 */

export type BloomSpecies = "tulip" | "anemone" | "rose" | "iris" | "violet" | "yarrow";
export type LeafShape = "teardrop" | "round" | "heart" | "slender" | "needle" | "lobed" | "fern";
export type LeafTint = "sage" | "blue" | "coral";
export type MarkKind = "bud" | "tendril" | "starburst" | "snowdrop" | "thorn" | "knuckle";

export type Glyph =
  | { t: "bloom"; species: BloomSpecies; upper: boolean; accents: number[] }
  | { t: "leaf"; shape: LeafShape; tint: LeafTint; upper: boolean; accents: number[] }
  | { t: "mark"; mark: MarkKind; variant: number }
  | { t: "berries"; n: number }
  | { t: "pod" }
  | { t: "heart"; variant: number }
  | { t: "seed"; g: string };

/** Vowels and Y bloom. */
export const BLOOM_OF: Readonly<Record<string, BloomSpecies>> = {
  e: "tulip",
  a: "anemone",
  o: "rose",
  i: "iris",
  u: "violet",
  y: "yarrow",
};

/**
 * Consonants leaf. Tints follow English letter frequency: the seven most common
 * consonants are sage, the rarest seven coral, so everyday text looks like the
 * reference bouquet (mostly sage, some blue, a few coral accents).
 */
export const LEAF_OF: Readonly<Record<string, { shape: LeafShape; tint: LeafTint }>> = {
  t: { shape: "teardrop", tint: "sage" },
  r: { shape: "round", tint: "sage" },
  h: { shape: "heart", tint: "sage" },
  s: { shape: "slender", tint: "sage" },
  n: { shape: "needle", tint: "sage" },
  l: { shape: "lobed", tint: "sage" },
  d: { shape: "fern", tint: "sage" },

  p: { shape: "teardrop", tint: "blue" },
  c: { shape: "round", tint: "blue" },
  w: { shape: "heart", tint: "blue" },
  g: { shape: "slender", tint: "blue" },
  // blue needle is deliberately unassigned (spare slot for a future version)
  m: { shape: "lobed", tint: "blue" },
  f: { shape: "fern", tint: "blue" },

  b: { shape: "teardrop", tint: "coral" },
  k: { shape: "round", tint: "coral" },
  v: { shape: "heart", tint: "coral" },
  x: { shape: "slender", tint: "coral" },
  j: { shape: "needle", tint: "coral" },
  q: { shape: "lobed", tint: "coral" },
  z: { shape: "fern", tint: "coral" },
};

/** Build strings from code points, so invisible characters never appear literally in source. */
const cp = (...points: number[]) => String.fromCodePoint(...points);

/**
 * Combining accents a letter may carry; each becomes a dewdrop with its own shape.
 * The index into this list is what the genome stores.
 */
export const ACCENTS: readonly string[] = [
  cp(0x0301), // acute        e.g. e-acute
  cp(0x0300), // grave
  cp(0x0302), // circumflex
  cp(0x0308), // diaeresis
  cp(0x0303), // tilde        e.g. n-tilde
  cp(0x030a), // ring above   e.g. a-ring
  cp(0x0327), // cedilla      e.g. c-cedilla
  cp(0x030c), // caron
  cp(0x0304), // macron
  cp(0x0306), // breve
  cp(0x0307), // dot above
  cp(0x030b), // double acute
  cp(0x0328), // ogonek
];

export const ACCENT_NAMES: readonly string[] = [
  "acute",
  "grave",
  "circumflex",
  "diaeresis",
  "tilde",
  "ring",
  "cedilla",
  "caron",
  "macron",
  "breve",
  "dot above",
  "double acute",
  "ogonek",
];

/** Punctuation marks. Variants keep smart quotes and dashes exact. */
export const MARKS: ReadonlyArray<readonly [string, MarkKind, number]> = [
  [".", "bud", 0],
  [cp(0x2026), "bud", 1], // ellipsis
  [",", "tendril", 0],
  ["!", "starburst", 0],
  ["?", "snowdrop", 0],
  ["'", "thorn", 0],
  [cp(0x2019), "thorn", 1], // right single quote (iOS smart apostrophe)
  [cp(0x2018), "thorn", 2], // left single quote
  ['"', "thorn", 3],
  [cp(0x201c), "thorn", 4], // left double quote
  [cp(0x201d), "thorn", 5], // right double quote
  ["-", "knuckle", 0],
  [cp(0x2013), "knuckle", 1], // en dash
  [cp(0x2014), "knuckle", 2], // em dash
];

/** Hearts become a heart-shaped bloom; the variant remembers exactly which heart. */
export const HEARTS: readonly string[] = [
  cp(0x2764, 0xfe0f), // red heart (emoji style)
  cp(0x2764), // red heart (text style)
  cp(0x2665, 0xfe0f), // heart suit (emoji style)
  cp(0x2665), // heart suit
  cp(0x2661), // white heart suit
  cp(0x1f495), // two hearts
  cp(0x1f496), // sparkling heart
  cp(0x1f497), // growing heart
  cp(0x1f493), // beating heart
  cp(0x1f49e), // revolving hearts
  cp(0x1f498), // heart with arrow
  cp(0x1f49d), // heart with ribbon
  cp(0x1fa77), // pink heart
  cp(0x1f9e1), // orange heart
  cp(0x1f49b), // yellow heart
  cp(0x1f49a), // green heart
  cp(0x1f499), // blue heart
  cp(0x1fa75), // light blue heart
  cp(0x1f49c), // purple heart
  cp(0x1f90e), // brown heart
  cp(0x1f5a4), // black heart
  cp(0x1fa76), // grey heart
  cp(0x1f90d), // white heart
];

const MARK_BY_CHAR = new Map(MARKS.map(([ch, mark, variant]) => [ch, { mark, variant }]));

const IS_LATIN_LETTER = /^[A-Za-z]$/;

function letterGlyph(g: string): Glyph | null {
  const nfd = g.normalize("NFD");
  const cps = Array.from(nfd);
  const base = cps[0];
  if (!base || !IS_LATIN_LETTER.test(base)) return null;
  const marks = cps.slice(1);
  const accents: number[] = [];
  for (const m of marks) {
    const idx = ACCENTS.indexOf(m);
    if (idx < 0) return null;
    accents.push(idx);
  }
  // Only accept graphemes we can rebuild exactly.
  if ((base + marks.join("")).normalize("NFC") !== g) return null;
  const lower = base.toLowerCase();
  const upper = base !== lower;
  const bloom = BLOOM_OF[lower];
  if (bloom) return { t: "bloom", species: bloom, upper, accents };
  const leaf = LEAF_OF[lower];
  if (leaf) return { t: "leaf", shape: leaf.shape, tint: leaf.tint, upper, accents };
  return null;
}

/** The plant part for one grapheme (never call with a space or newline: those end stems). */
export function glyphFor(g: string): Glyph {
  const letter = letterGlyph(g);
  if (letter) return letter;
  if (g.length === 1 && g >= "1" && g <= "9") return { t: "berries", n: g.charCodeAt(0) - 48 };
  if (g === "0") return { t: "pod" };
  const mark = MARK_BY_CHAR.get(g);
  if (mark) return { t: "mark", mark: mark.mark, variant: mark.variant };
  const heart = HEARTS.indexOf(g);
  if (heart >= 0) return { t: "heart", variant: heart };
  return { t: "seed", g };
}

const LETTER_OF_BLOOM = new Map(Object.entries(BLOOM_OF).map(([ch, sp]) => [sp, ch]));
const LETTER_OF_LEAF = new Map(Object.entries(LEAF_OF).map(([ch, l]) => [`${l.shape}/${l.tint}`, ch]));

/** Read a plant part back into its character. The exact inverse of `glyphFor`. */
export function charFor(glyph: Glyph): string {
  switch (glyph.t) {
    case "bloom":
    case "leaf": {
      const letter =
        glyph.t === "bloom" ? LETTER_OF_BLOOM.get(glyph.species) : LETTER_OF_LEAF.get(`${glyph.shape}/${glyph.tint}`);
      if (!letter) throw new Error(`Unknown ${glyph.t} glyph`);
      const base = glyph.upper ? letter.toUpperCase() : letter;
      return (base + glyph.accents.map((i) => ACCENTS[i]).join("")).normalize("NFC");
    }
    case "mark": {
      const entry = MARKS.find(([, m, v]) => m === glyph.mark && v === glyph.variant);
      if (!entry) throw new Error(`Unknown mark ${glyph.mark}/${glyph.variant}`);
      return entry[0];
    }
    case "berries":
      return String(glyph.n);
    case "pod":
      return "0";
    case "heart":
      return HEARTS[glyph.variant];
    case "seed":
      return glyph.g;
  }
}

/** Human-readable name, used by the legend and screen-reader announcements. */
export function glyphName(glyph: Glyph): string {
  switch (glyph.t) {
    case "bloom": {
      const names: Record<BloomSpecies, string> = {
        tulip: "tulip",
        anemone: "anemone",
        rose: "rose",
        iris: "iris",
        violet: "Philippine violet",
        yarrow: "yarrow",
      };
      return `${glyph.upper ? "large " : ""}${names[glyph.species]}${glyph.accents.length ? " with dew" : ""}`;
    }
    case "leaf":
      return `${glyph.upper ? "large " : ""}${glyph.tint === "blue" ? "dusty blue" : glyph.tint} ${glyph.shape} leaf${
        glyph.accents.length ? " with dew" : ""
      }`;
    case "mark": {
      const names: Record<MarkKind, string> = {
        bud: glyph.variant === 1 ? "trio of buds" : "closed bud",
        tendril: "curled tendril",
        starburst: "starburst of florets",
        snowdrop: "nodding snowdrop",
        thorn: glyph.variant >= 3 ? "pair of thorns" : "thorn",
        knuckle: glyph.variant === 2 ? "double knuckle ring" : "knuckle ring",
      };
      return names[glyph.mark];
    }
    case "berries":
      return `sprig of ${glyph.n} ${glyph.n === 1 ? "berry" : "berries"}`;
    case "pod":
      return "seed pod";
    case "heart":
      return "heart bloom";
    case "seed":
      return "mystery seed";
  }
}
