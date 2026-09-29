/**
 * The genome: a message as a bouquet's structure.
 *
 *   message → stems (one per word) → elements (one per character, bottom to top)
 *
 * `buildGenome` and `decodeGenome` are exact inverses for canonical text:
 *   decodeGenome(buildGenome(canon(t))) === canon(t)
 */
import { charFor, glyphFor, type Glyph } from "../alphabet/v1";
import { charForKeyed, glyphForKeyed } from "../alphabet/v2";
import type { Cipher } from "../cipher";
import { hashString, mixSeed } from "../rng";
import { graphemes, isSeparator } from "../text/canon";

export interface GElement {
  /** The grapheme this element encodes. */
  g: string;
  glyph: Glyph;
  /** Position of the grapheme in the canonical text. */
  index: number;
}

export interface GStem {
  /** 0-based stem number, in reading order. */
  ordinal: number;
  elements: GElement[];
  /** What ended the stem. */
  end: "space" | "newline" | "eof";
}

export interface Genome {
  /** 1: the open alphabet; 2: shuffled by a bouquet key. */
  v: 1 | 2;
  stems: GStem[];
  /** Live text ending in a separator: the next stem is about to sprout. */
  pending: boolean;
}

/**
 * Build a genome from canonical text (see core/text/canon.ts). With a cipher, every
 * position is shuffled by the bouquet's key (alphabet v2); without, it's the open v1.
 */
export function buildGenome(text: string, cipher?: Cipher | null): Genome {
  const gs = graphemes(text);
  const stems: GStem[] = [];
  let current: GElement[] = [];
  gs.forEach((g, index) => {
    if (isSeparator(g)) {
      if (current.length > 0) {
        stems.push({ ordinal: stems.length, elements: current, end: g === " " ? "space" : "newline" });
        current = [];
      }
      return;
    }
    current.push({ g, glyph: cipher ? glyphForKeyed(g, cipher.shift(index)) : glyphFor(g), index });
  });
  if (current.length > 0) stems.push({ ordinal: stems.length, elements: current, end: "eof" });
  const last = gs[gs.length - 1];
  return { v: cipher ? 2 : 1, stems, pending: last !== undefined && isSeparator(last) };
}

/** Read one element back into its character, with the bouquet's key if it has one. */
export function readElement(glyph: Glyph, index: number, cipher?: Cipher | null): string {
  return cipher ? charForKeyed(glyph, cipher.shift(index)) : charFor(glyph);
}

/** Read a genome back into text: this is what "Read the flowers" does. */
export function decodeGenome(genome: Genome, cipher?: Cipher | null): string {
  return genome.stems
    .map(
      (s) =>
        s.elements.map((e) => readElement(e.glyph, e.index, cipher)).join("") + (s.end === "space" ? " " : s.end === "newline" ? "\n" : ""),
    )
    .join("");
}

/**
 * Seed for one element's decoration. It depends only on the element's own position and
 * character (plus the bouquet's salt), so typing more never changes earlier elements.
 */
export function elementSeed(salt: number, stem: number, node: number, g: string): number {
  return mixSeed(salt, stem, node, hashString(g));
}

/** The whole message's fingerprint, drawn as the wax seal. */
export function signatureOf(text: string, salt = 0): number {
  return mixSeed(hashString(text), salt);
}
