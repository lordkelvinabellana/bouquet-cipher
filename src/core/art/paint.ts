/**
 * The "gouache" look, without filters:
 *  - a slightly darker underlay, then a slightly smaller copy in the true colour on top,
 *    which leaves a thin darker rim like pooled paint;
 *  - a few soft brush streaks that follow the shape's own profile, so they always sit inside it.
 */
import type { Rng } from "../rng";
import { shade, type Hex, type Tone } from "./color";
import {
  IDENTITY,
  applyAll,
  bladeCenterX,
  bladePts,
  bladeStreakPts,
  circlePath,
  closedPath,
  makeNoise,
  mul,
  taperPts,
  translate,
  type BladeOpts,
  type Mat,
  type Pt,
} from "./geom";
import type { Shape } from "./types";

export interface StreakSpec {
  side: 1 | -1;
  offset: number;
  width: number;
  from: number;
  to: number;
  tone: "light" | "dark";
  opacity: number;
  /** Override colour (e.g. the yellow beard on an iris fall). */
  color?: Hex;
}

export interface PaintSpec {
  tone: Tone;
  /** How much darker the underlay is (default 0.09). */
  rim?: number;
  streaks?: StreakSpec[];
  /** Draw a leaf midrib. */
  midrib?: boolean;
}

export function paintBlade(o: BladeOpts, rng: Rng, spec: PaintSpec, m: Mat = IDENTITY): Shape[] {
  const noise = makeNoise(rng.next);
  const outer = bladePts(o, noise);
  const inner = bladePts({ ...o, length: o.length * 0.94, width: o.width * 0.84 }, noise);
  const innerM = mul(m, translate(0, -o.length * 0.03));
  const shapes: Shape[] = [
    { d: closedPath(applyAll(m, outer.pts), outer.corners), fill: shade(spec.tone.base, -(spec.rim ?? 0.09)) },
    { d: closedPath(applyAll(innerM, inner.pts), inner.corners), fill: spec.tone.base },
  ];
  for (const s of spec.streaks ?? []) {
    const st = bladeStreakPts(o, noise, s);
    shapes.push({
      d: closedPath(applyAll(m, st.pts), st.corners),
      fill: s.color ?? (s.tone === "light" ? spec.tone.light : spec.tone.dark),
      opacity: s.opacity,
    });
  }
  if (spec.midrib) {
    const line: Pt[] = [];
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const t = 0.02 + (0.84 * k) / steps;
      line.push([bladeCenterX(o, t), -o.length * t]);
    }
    const w0 = Math.max(0.9, o.width * 0.13);
    const rib = taperPts(applyAll(m, line), w0, 0.3);
    shapes.push({ d: closedPath(rib.pts, rib.corners), fill: spec.tone.dark, opacity: 0.55 });
  }
  return shapes;
}

function centroid(pts: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** Paint an arbitrary outline (bells, hearts, heart leaves) with the same rim-and-highlight look. */
export function paintOutline(
  pts: readonly Pt[],
  corners: readonly number[],
  tone: Tone,
  m: Mat = IDENTITY,
  opts: { inset?: number; rim?: number; highlight?: number; highlightShift?: Pt } = {},
): Shape[] {
  const c = centroid(pts);
  const k = opts.inset ?? 0.88;
  const inner = pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k] as Pt);
  const shapes: Shape[] = [
    { d: closedPath(applyAll(m, pts), corners), fill: shade(tone.base, -(opts.rim ?? 0.09)) },
    { d: closedPath(applyAll(m, inner), corners), fill: tone.base },
  ];
  const hl = opts.highlight ?? 0.45;
  if (hl > 0) {
    const [sx, sy] = opts.highlightShift ?? [-0.18, -0.12];
    let maxR = 0;
    for (const p of pts) maxR = Math.max(maxR, Math.hypot(p[0] - c[0], p[1] - c[1]));
    const patch = pts.map(
      ([x, y]) => [c[0] + (x - c[0]) * 0.52 + sx * maxR, c[1] + (y - c[1]) * 0.52 + sy * maxR] as Pt,
    );
    shapes.push({ d: closedPath(applyAll(m, patch), corners), fill: tone.light, opacity: hl });
  }
  return shapes;
}

/** A tapered stroke (stems, stalks, tendrils) as a filled shape. */
export function strokeShape(line: readonly Pt[], w0: number, w1: number, fill: Hex, m: Mat = IDENTITY, opacity?: number): Shape {
  const t = taperPts(applyAll(m, line), w0, w1);
  const n = line.length;
  return { d: closedPath(t.pts, [0, n - 1, n, 2 * n - 1]), fill, opacity };
}

export function dot(p: Pt, r: number, fill: Hex, opacity?: number): Shape {
  return { d: circlePath(p[0], p[1], r), fill, opacity };
}

/** A small painted disc: darker rim plus body plus a highlight fleck. */
export function paintDot(p: Pt, r: number, tone: Tone, fleck = true): Shape[] {
  const shapes: Shape[] = [dot(p, r, shade(tone.base, -0.12)), dot([p[0], p[1] - r * 0.06], r * 0.84, tone.base)];
  if (fleck) shapes.push(dot([p[0] - r * 0.32, p[1] - r * 0.36], r * 0.28, tone.light, 0.85));
  return shapes;
}
