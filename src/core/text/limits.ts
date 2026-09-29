/**
 * Size limits keep every bouquet comfortably bouquet-sized.
 * Enforced identically in the composer and in the API.
 */
import { graphemes, isSeparator } from "./canon";

/** Total characters (graphemes, spaces included), like a florist's card. */
export const MAX_GRAPHEMES = 80;

/** Characters on one stem (one word). */
export const MAX_STEM_GRAPHEMES = 24;

export interface LimitReport {
  count: number;
  longestStem: number;
  tooLong: boolean;
  stemTooLong: boolean;
  ok: boolean;
}

/** Measure canonical text against the limits. */
export function measure(text: string): LimitReport {
  const gs = graphemes(text);
  let longest = 0;
  let run = 0;
  for (const g of gs) {
    if (isSeparator(g)) {
      run = 0;
    } else {
      run++;
      if (run > longest) longest = run;
    }
  }
  const tooLong = gs.length > MAX_GRAPHEMES;
  const stemTooLong = longest > MAX_STEM_GRAPHEMES;
  return { count: gs.length, longestStem: longest, tooLong, stemTooLong, ok: !tooLong && !stemTooLong };
}

/**
 * The longest prefix of canonical text that fits the limits (used when a paste would
 * overflow). The result is always a grapheme-aligned prefix of the input.
 */
export function fitToLimits(text: string): string {
  const gs = graphemes(text);
  let run = 0;
  let out = "";
  for (let i = 0; i < gs.length && i < MAX_GRAPHEMES; i++) {
    const g = gs[i];
    if (isSeparator(g)) {
      run = 0;
    } else if (++run > MAX_STEM_GRAPHEMES) {
      break;
    }
    out += g;
  }
  return out;
}
