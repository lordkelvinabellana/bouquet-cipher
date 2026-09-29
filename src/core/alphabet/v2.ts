/**
 * Floral Alphabet v2: the v1 alphabet, shuffled by a bouquet's key.
 *
 * At every position the key picks a shift, and each character moves that many places
 * *within its own group*:
 *   - vowels among the six blooms,
 *   - consonants among the leaf shapes of their own colour tier (sage, blue, coral),
 *   - digits among the ten berry counts (0 is the seed pod).
 * Groups never mix, so a keyed bouquet keeps v1's balance (vowels are flowers, common
 * consonants the main green, rare ones the warm accent), but which flower means which
 * letter changes from bouquet to bouquet and from position to position. With a shift of
 * 0 everywhere, v2 is exactly v1. Punctuation, hearts and mystery seeds aren't shuffled.
 *
 * FROZEN once shipped, like v1.
 */
import { BLOOM_OF, charFor, glyphFor, LEAF_OF, type BloomSpecies, type Glyph, type LeafShape, type LeafTint } from "./v1";

/** Blooms in v1's vowel order: e a o i u y. */
const SPECIES: readonly BloomSpecies[] = ["e", "a", "o", "i", "u", "y"].map((v) => BLOOM_OF[v]);

/** Each tier's shapes, in v1's letter order (so index i is v1's i-th letter of the tier). */
const TIER_SHAPES: Readonly<Record<LeafTint, readonly LeafShape[]>> = {
  sage: Array.from("trhsnld", (c) => LEAF_OF[c].shape),
  blue: Array.from("pcwgmf", (c) => LEAF_OF[c].shape),
  coral: Array.from("bkvxjqz", (c) => LEAF_OF[c].shape),
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** The glyph for one grapheme at a position whose shift is `shift`. */
export function glyphForKeyed(g: string, shift: number): Glyph {
  const base = glyphFor(g);
  switch (base.t) {
    case "bloom":
      return { ...base, species: SPECIES[mod(SPECIES.indexOf(base.species) + shift, SPECIES.length)] };
    case "leaf": {
      const shapes = TIER_SHAPES[base.tint];
      return { ...base, shape: shapes[mod(shapes.indexOf(base.shape) + shift, shapes.length)] };
    }
    case "berries":
    case "pod": {
      const v = mod((base.t === "pod" ? 0 : base.n) + shift, 10);
      return v === 0 ? { t: "pod" } : { t: "berries", n: v };
    }
    default:
      return base;
  }
}

/** Read a keyed glyph back into its character. The exact inverse of `glyphForKeyed`. */
export function charForKeyed(glyph: Glyph, shift: number): string {
  switch (glyph.t) {
    case "bloom":
      return charFor({ ...glyph, species: SPECIES[mod(SPECIES.indexOf(glyph.species) - shift, SPECIES.length)] });
    case "leaf": {
      const shapes = TIER_SHAPES[glyph.tint];
      return charFor({ ...glyph, shape: shapes[mod(shapes.indexOf(glyph.shape) - shift, shapes.length)] });
    }
    case "berries":
    case "pod":
      return String(mod((glyph.t === "pod" ? 0 : glyph.n) - shift, 10));
    default:
      return charFor(glyph);
  }
}
