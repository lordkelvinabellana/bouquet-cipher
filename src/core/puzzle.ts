/**
 * "Decode it yourself": the message as a guessing game.
 *
 * A bouquet's key shuffles which flower means which letter, so it can't be read with a
 * chart. But the shuffle never leaves a group, so the bouquet still gives clues: every
 * bloom is a vowel, and a leaf's colour says which handful of consonants it could be.
 * The reader guesses letters; each right guess fills in every place it's used.
 * Punctuation, digits, hearts and anything else are shown from the start.
 */
import type { LeafTint } from "./alphabet/v1";
import type { Cipher } from "./cipher";
import type { BouquetLayout } from "./layout/v1/layout";
import { readingSequence } from "./reveal/sequence";

/** What a hidden letter could be, from what's drawn there. */
export type Clue = "vowel" | LeafTint;

export const CLUE_LETTERS: Readonly<Record<Clue, string>> = {
  vowel: "aeiouy",
  sage: "trhsnld",
  blue: "pcwgmf",
  coral: "bkvxjqz",
};

export type Slot =
  | { kind: "letter"; key: string; char: string; letter: string; clue: Clue }
  | { kind: "given"; key: string; char: string }
  | { kind: "space" | "newline"; char: string };

/** The plain letter a character is guessed by: "É" and "é" are both "e". */
export function letterOf(char: string): string | null {
  const base = char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return /^[a-z]$/.test(base) ? base : null;
}

export function puzzleOf(layout: BouquetLayout, cipher: Cipher | null): Slot[] {
  const glyphs = new Map(layout.elements.map((e) => [e.key, e.glyph]));
  return readingSequence(layout, cipher).map((step): Slot => {
    if (step.kind !== "element") return { kind: step.kind, char: step.char };
    const glyph = glyphs.get(step.key);
    const letter = letterOf(step.char);
    if (letter && glyph && (glyph.t === "bloom" || glyph.t === "leaf")) {
      return { kind: "letter", key: step.key, char: step.char, letter, clue: glyph.t === "bloom" ? "vowel" : glyph.tint };
    }
    return { kind: "given", key: step.key, char: step.char };
  });
}

/** Indices of the slots a guessed letter fills (empty for a miss). */
export function hitsFor(slots: readonly Slot[], letter: string): number[] {
  const out: number[] = [];
  slots.forEach((s, i) => s.kind === "letter" && s.letter === letter && out.push(i));
  return out;
}

export function isSolved(slots: readonly Slot[], guessed: ReadonlySet<string>): boolean {
  return slots.every((s) => s.kind !== "letter" || guessed.has(s.letter));
}

/** "1:07" */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
