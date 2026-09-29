/**
 * "Read the flowers": walk a bouquet in reading order (stems in order, each from the
 * bottom up) and decode every element back into its character. This is the decoder the
 * recipient watches: the text comes from the flowers, not from a stored string.
 */
import type { Cipher } from "../cipher";
import { readElement } from "../genome/genome";
import type { Pt } from "../art/geom";
import type { BouquetLayout } from "../layout/v1/layout";

export type ReadStep =
  | { kind: "element"; key: string; char: string; focus: Pt; r: number }
  | { kind: "space" | "newline"; char: string };

export function readingSequence(layout: BouquetLayout, cipher?: Cipher | null): ReadStep[] {
  const steps: ReadStep[] = [];
  let i = 0;
  for (const stem of layout.stems) {
    while (i < layout.elements.length && layout.elements[i].stem === stem.ordinal) {
      const e = layout.elements[i++];
      steps.push({ kind: "element", key: e.key, char: readElement(e.glyph, e.index, cipher), focus: e.focus, r: e.hit.r });
    }
    if (stem.end === "space") steps.push({ kind: "space", char: " " });
    else if (stem.end === "newline") steps.push({ kind: "newline", char: "\n" });
  }
  return steps;
}

/** Pause after each step, in seconds: letters quickly, word breaks and line breaks a beat longer. */
export function stepPause(step: ReadStep): number {
  return step.kind === "element" ? 0.2 : step.kind === "space" ? 0.3 : 0.6;
}
