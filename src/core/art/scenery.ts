/**
 * Everything that isn't a letter: the cream card with its stitched border, the stems,
 * the ribbon tie and the wax seal.
 */
import { makeRng } from "../rng";
import { shade, type Tone } from "./color";
import { applyAll, circlePath, compose, fmt, rotate, translate, type Pt } from "./geom";
import { dot, paintBlade, paintOutline, strokeShape } from "./paint";
import { ACCENT, PAPER } from "./palette";
import type { Shape } from "./types";

/** The whole picture is a 600×900 frame, like the reference. */
export const FRAME = { w: 600, h: 900 } as const;

/** The cream pill-shaped card. */
export const CARD = { x: 62, y: 68, w: 476, h: 764 } as const;

function pillPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return (
    `M${fmt(x)} ${fmt(y + r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}` +
    `L${fmt(x + w)} ${fmt(y + h - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + h - r)}Z`
  );
}

/** Evenly spaced points around a pill outline, starting at the top centre, clockwise. */
function pillWalk(x: number, y: number, w: number, h: number, spacing: number): Pt[] {
  const r = w / 2;
  const cx = x + r;
  const side = h - 2 * r;
  const arc = Math.PI * r;
  const total = 2 * arc + 2 * side;
  const count = Math.round(total / spacing);
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    let s = (i * total) / count;
    if (s < arc / 2) {
      const a = -Math.PI / 2 + s / r;
      pts.push([cx + Math.cos(a) * r, y + r + Math.sin(a) * r]);
      continue;
    }
    s -= arc / 2;
    if (s < side) {
      pts.push([x + w, y + r + s]);
      continue;
    }
    s -= side;
    if (s < arc) {
      const a = s / r;
      pts.push([cx + Math.cos(a) * r, y + h - r + Math.sin(a) * r]);
      continue;
    }
    s -= arc;
    if (s < side) {
      pts.push([x, y + h - r - s]);
      continue;
    }
    s -= side;
    const a = Math.PI + s / r;
    pts.push([cx + Math.cos(a) * r, y + r + Math.sin(a) * r]);
  }
  return pts;
}

export function cardShape(): Shape {
  return { d: pillPath(CARD.x, CARD.y, CARD.w, CARD.h), fill: PAPER.cream };
}

/** The dotted "stitched" border inset from the card edge. */
export function stitchShapes(): Shape[] {
  const inset = 13;
  const pts = pillWalk(CARD.x + inset, CARD.y + inset, CARD.w - 2 * inset, CARD.h - 2 * inset, 10.6);
  // one compound path keeps the DOM small
  const d = pts.map(([x, y]) => circlePath(x, y, 2.1)).join("");
  return [{ d, fill: PAPER.stitch }];
}

/** A stem: a tapered ink stroke along its centre line. */
export function stemShape(line: readonly Pt[], w0 = 2.9, w1 = 1.3): Shape {
  return strokeShape(line, w0, w1, PAPER.ink);
}

const RIBBON: Tone = ACCENT.ribbon;

/** A ribbon tied around the stems at `tie`, with a bow and two tails. */
export function ribbonShapes(tie: Pt, seed: number): Shape[] {
  const rng = makeRng(seed);
  const [x, y] = tie;
  const shapes: Shape[] = [];
  // tails hang down from the knot
  for (const side of [-1, 1] as const) {
    shapes.push(
      ...paintBlade(
        { length: 34, width: 4.4, a: 0.7, b: 1.2, bend: side * 0.12, wobble: 0.04, sharpTip: true, samples: 12 },
        rng,
        { tone: RIBBON, streaks: [{ side: 1, offset: 0.3, width: 0.3, from: 0.1, to: 0.9, tone: "light", opacity: 0.5 }] },
        compose(translate(x, y + 2), rotate(180 - side * (24 + rng.jitter(5)))),
      ),
    );
  }
  // band wrapped around the stems
  const band: Pt[] = [
    [-17, -6],
    [0, -7.5],
    [17, -6],
    [16.5, 5.5],
    [0, 7],
    [-16.5, 5.5],
  ];
  shapes.push(...paintOutline(applyAll(translate(x, y), band), [0, 2, 3, 5], RIBBON, undefined, { highlight: 0.4, highlightShift: [0, -0.35] }));
  shapes.push(strokeShape([[x - 16, y + 4.6], [x, y + 5.8], [x + 16, y + 4.6]], 1.4, 1.4, RIBBON.dark, undefined, 0.6));
  // bow loops
  for (const side of [-1, 1] as const) {
    const m = compose(translate(x, y), rotate(side * (66 + rng.jitter(6))));
    shapes.push(
      ...paintBlade(
        { length: 25, width: 8.6, a: 0.75, b: 0.55, wobble: 0.04, samples: 12 },
        rng,
        { tone: RIBBON, streaks: [{ side: -side as 1 | -1, offset: 0.4, width: 0.3, from: 0.15, to: 0.9, tone: "light", opacity: 0.5 }] },
        m,
      ),
    );
    shapes.push(
      ...paintBlade(
        { length: 15, width: 3.4, a: 0.8, b: 0.6, wobble: 0.03, samples: 10 },
        rng,
        { tone: { base: RIBBON.dark, light: RIBBON.base, dark: shade(RIBBON.dark, -0.2) }, rim: 0.05 },
        compose(m, translate(0, -7)),
      ),
    );
  }
  // knot
  shapes.push(dot([x, y + 0.5], 5.6, shade(RIBBON.dark, -0.05)), dot([x, y], 4.8, RIBBON.base), dot([x - 1.4, y - 1.6], 1.6, RIBBON.light, 0.8));
  return shapes;
}

/**
 * The wax seal on the knot. Its pattern comes from the whole message's hash, so it is
 * the bouquet's visible signature: change one letter and the seal changes.
 */
export function sealShapes(c: Pt, signature: number): Shape[] {
  const rng = makeRng(signature);
  const n = 22;
  const blob: Pt[] = [];
  const bumps = rng.int(2, 4);
  const bumpPhase = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 11 * (1 + 0.05 * Math.sin(bumps * a + bumpPhase) + rng.jitter(0.025));
    blob.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  const shapes: Shape[] = paintOutline(blob, [], ACCENT.seal, undefined, { highlight: 0.25, inset: 0.9 });
  shapes.push(dot(c, 7.6, ACCENT.seal.dark, 0.55), dot(c, 6.6, ACCENT.seal.base));
  const petals = 5 + (signature % 4);
  const spin = (signature >>> 3) % 360;
  for (let i = 0; i < petals; i++) {
    shapes.push(
      ...paintBlade(
        { length: 5.4, width: 1.9, a: 0.8, b: 0.7, samples: 8 },
        rng,
        { tone: ACCENT.seal, rim: -0.25 },
        compose(translate(c[0], c[1]), rotate(spin + (i * 360) / petals)),
      ),
    );
  }
  const ring = 7 + ((signature >>> 8) % 6);
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + ((signature >>> 12) % 100) / 16;
    shapes.push(dot([c[0] + Math.cos(a) * 9.1, c[1] + Math.sin(a) * 9.1], 0.75, ACCENT.seal.light, 0.9));
  }
  shapes.push(dot(c, 1.3, ACCENT.seal.dark));
  return shapes;
}
