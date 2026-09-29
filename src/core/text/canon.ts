/**
 * Canonical text: the exact form a message is stored, encoded and compared in.
 *
 * Every step is invisible to the writer:
 *  1. line endings (CRLF, CR, U+2028/2029, U+0085) become "\n"
 *  2. tabs and every Unicode space separator become " "
 *  3. control characters (except "\n"), zero-width space, word joiner, BOM and soft hyphen are removed
 *  4. NFC normalisation (never NFKC, which would lose information)
 *  5. runs of whitespace collapse to one " " (or one "\n" if the run held a newline)
 *  6. leading whitespace is trimmed; trailing whitespace too, except in "live" mode,
 *     where a single trailing separator is kept so the composer can show a sprout
 *     for the stem that's about to grow.
 */
import { collectGraphemes } from "unicode-segmenter/grapheme";

/** Build strings from code points, so invisible characters never appear literally in source. */
const cp = (...points: number[]) => String.fromCodePoint(...points);

const NEWLINES = new RegExp(`\\r\\n?|[${cp(0x2028, 0x2029, 0x85)}]`, "g");
const SPACES = /[\t\p{Zs}]/gu;
const INVISIBLE = new RegExp(`[\\x00-\\x09\\x0B-\\x1F\\x7F-\\x9F${cp(0xad, 0x200b, 0x2060, 0xfeff)}]`, "g");
const WHITESPACE_RUN = /[ \n]+/g;

export type CanonMode = "final" | "live";

export function canon(input: string, mode: CanonMode = "final"): string {
  let s = input.replace(NEWLINES, "\n").replace(SPACES, " ").replace(INVISIBLE, "");
  s = s.normalize("NFC");
  s = s.replace(WHITESPACE_RUN, (run) => (run.includes("\n") ? "\n" : " "));
  s = s.replace(/^[ \n]+/, "");
  if (mode === "final") s = s.replace(/[ \n]+$/, "");
  return s;
}

/** Split into user-perceived characters, identically in every browser and on the server. */
export function graphemes(s: string): string[] {
  return collectGraphemes(s);
}

export function isSeparator(g: string): boolean {
  return g === " " || g === "\n";
}
