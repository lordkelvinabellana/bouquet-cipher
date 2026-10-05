/**
 * The share video's timeline: when the bouquet grows in, when each flower pops open,
 * and when each one is read back into its letter. Pure numbers, so the renderer only
 * has to ask "what does the picture look like at time t?".
 *
 *   intro    the card, its ribbon and seal
 *   grow     a line sweeps up from the ribbon; stems rise behind it and every flower
 *            and leaf pops open as the line reaches it
 *   read     (reveal) each flower glows in reading order and its letter is written
 *            below the card; (mystery) "Can you read it?"
 *   outro    the whole message (or the question) held on screen
 */
import { apply } from "../art/geom";
import type { Cipher } from "../cipher";
import type { BouquetLayout } from "../layout/v1/layout";
import { readingSequence, stepPause, type ReadStep } from "../reveal/sequence";
import { cameraMatrix, presentedCamera, type Camera } from "../scene/scene";

export const FPS = 30;
const INTRO = 0.7;
/** How long one flower takes to pop open. */
export const POP = 0.42;
const AFTER_GROW = 0.5;
/** How long a letter's pop over its flower lasts (the message types it at the same moment). */
export const LETTER_POP = 0.5;
/** Reading is sped up so even a full message fits in a short clip. */
const MAX_READ = 7.5;
const PACE = 0.8;
const OUTRO_REVEAL = 3;
const OUTRO_MYSTERY = 3.6;

export interface VideoPlan {
  camera: Camera;
  duration: number;
  /** The growth line, in frame coordinates: it rises from `fromY` to `toY`. */
  sweep: { start: number; end: number; fromY: number; toY: number };
  /** When each element (by key) starts to pop open. */
  pops: ReadonlyMap<string, number>;
  /** When the flowers are all open. */
  grown: number;
  /** Each reading step and when it's read (empty when the message stays a mystery). */
  reads: ReadonlyArray<{ at: number; step: ReadStep }>;
  /** When the ending (full message or the question) appears. */
  outro: number;
}

export function planVideo(layout: BouquetLayout, cipher: Cipher | null, reveal: boolean): VideoPlan {
  const camera = presentedCamera(layout);
  const m = cameraMatrix(camera);
  const placed = layout.elements.map((e) => {
    const [, y] = apply(m, e.focus);
    return { key: e.key, y, r: e.hit.r * camera.zoom };
  });

  const fromY = camera.y + 12;
  const toY = Math.min(fromY - 1, ...placed.map((p) => p.y - p.r)) - 10;
  const growFor = Math.min(3.4, Math.max(1.6, 0.9 + placed.length * 0.045));
  const sweep = { start: INTRO, end: INTRO + growFor, fromY, toY };
  // a flower opens once the line has passed its lower half
  const pops = new Map<string, number>();
  for (const p of placed) {
    const u = Math.min(1, Math.max(0, (fromY - (p.y + p.r * 0.4)) / (fromY - toY)));
    pops.set(p.key, sweep.start + u * growFor);
  }
  const grown = Math.max(sweep.end, ...pops.values()) + POP;

  const reads: Array<{ at: number; step: ReadStep }> = [];
  let outro = grown + AFTER_GROW;
  if (reveal) {
    const steps = readingSequence(layout, cipher);
    const natural = steps.reduce((sum, s) => sum + stepPause(s) * PACE, 0);
    const k = natural > MAX_READ ? MAX_READ / natural : 1;
    let t = grown + AFTER_GROW;
    for (const step of steps) {
      reads.push({ at: t, step });
      t += stepPause(step) * PACE * k;
    }
    // wait for the last letter to land
    outro = (reads.length ? reads[reads.length - 1].at + LETTER_POP : t) + 0.3;
  }
  const duration = outro + (reveal ? OUTRO_REVEAL : OUTRO_MYSTERY);
  return { camera, duration: Math.ceil(duration * FPS) / FPS, sweep, pops, grown, reads, outro };
}

/** Where the growth line is at time t. */
export function sweepAt(plan: VideoPlan, t: number): number {
  const { start, end, fromY, toY } = plan.sweep;
  const u = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return fromY + (toY - fromY) * u;
}

/** Index of the step being read at time t (-1 before the first). */
export function readingAt(plan: VideoPlan, t: number): number {
  let i = -1;
  for (let k = 0; k < plan.reads.length && plan.reads[k].at <= t; k++) i = k;
  return i;
}

/** A pop with a little overshoot, 0 → 1. */
export function popScale(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c = 1.9;
  const q = p - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
}
