/**
 * Blooms: one per vowel (and Y). Each has a distinct silhouette so it can be read
 * by shape alone; colour is decorative.
 *
 *   E tulip (cup)   A anemone (broad fan, dark eye)   O rose (round spiral)
 *   I iris (tall)   U violet (upright spike)          Y yarrow (flat cluster)
 */
import type { Rng } from "../rng";
import { shade, toneStep, type Tone } from "./color";
import {
  apply,
  applyAll,
  closedPath,
  compose,
  ellipsePts,
  rotate,
  sampleCurve,
  scale,
  translate,
  type Mat,
  type Pt,
} from "./geom";
import { dot, paintBlade, paintDot, paintOutline, strokeShape, type StreakSpec } from "./paint";
import { ACCENT, GREEN } from "./palette";
import type { Art, ArtCtx, Shape } from "./types";

export const BLOOM_SIZE = 54;

function bloomSize(ctx: ArtCtx, k = 1): number {
  return BLOOM_SIZE * k * (ctx.upper ? 1.25 : 1) * ctx.rng.range(0.94, 1.06);
}

function petalStreaks(rng: Rng, side: 1 | -1): StreakSpec[] {
  const s: StreakSpec[] = [{ side, offset: 0.34, width: 0.34, from: 0.12, to: 0.9, tone: "light", opacity: 0.5 }];
  if (rng.next() < 0.7) s.push({ side: -side as 1 | -1, offset: 0.46, width: 0.13, from: 0.28, to: 0.82, tone: "dark", opacity: 0.32 });
  if (rng.next() < 0.5) s.push({ side, offset: 0.08, width: 0.07, from: 0.35, to: 0.78, tone: "light", opacity: 0.45 });
  return s;
}

/** E: a cup of overlapping petals, like the tulips in the reference. */
export function tulip(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx);
  const open = rng.range(0.85, 1.2);
  const shapes: Shape[] = [];
  const petal = (rot: number, px: number, len: number, w: number, step: "light" | "base" | "dark", side: 1 | -1) => {
    const m = compose(translate(px, -0.02 * S), rotate(rot));
    shapes.push(
      ...paintBlade(
        { length: len, width: w, a: 1.05, b: 0.72, asym: rng.jitter(0.1), bend: rng.jitter(0.05) + side * 0.03, wobble: 0.03 },
        rng,
        { tone: toneStep(tone, step), streaks: petalStreaks(rng, side) },
        m,
      ),
    );
  };
  if (upper) {
    petal(-31 * open, -0.06 * S, 0.84 * S, 0.24 * S, "dark", -1);
    petal(31 * open, 0.06 * S, 0.84 * S, 0.24 * S, "dark", 1);
  }
  petal(rng.jitter(3), 0, 1.0 * S, 0.26 * S, "dark", 1);
  petal(-17 * open, -0.05 * S, 0.93 * S, 0.27 * S, "base", -1);
  petal(17 * open, 0.05 * S, 0.93 * S, 0.27 * S, "base", 1);
  petal(-6 * open, -0.02 * S, 0.8 * S, 0.3 * S, "light", -1);
  petal(7 * open, 0.02 * S, 0.78 * S, 0.29 * S, "light", 1);
  return { shapes, hit: { x: 0, y: -0.52 * S, r: 0.47 * S }, focus: { x: 0, y: -0.52 * S }, reach: S };
}

/** Radial ring of petals around a centre, squashed for a three-quarter view. Back petals first. */
function petalRing(
  shapes: Shape[],
  rng: Rng,
  tone: Tone,
  face: Mat,
  count: number,
  len: number,
  w: number,
  phase: number,
  steps: ReadonlyArray<"light" | "base" | "dark">,
  shape: { a: number; b: number },
) {
  const petals = Array.from({ length: count }, (_, k) => ({
    ang: phase + (k * 360) / count + rng.jitter(7),
    step: steps[k % steps.length],
    len: len * rng.range(0.92, 1.06),
  }));
  petals.sort((p, q) => Math.cos((q.ang * Math.PI) / 180) - Math.cos((p.ang * Math.PI) / 180));
  for (const p of petals) {
    shapes.push(
      ...paintBlade(
        { length: p.len, width: w, a: shape.a, b: shape.b, asym: rng.jitter(0.12), bend: rng.jitter(0.08), wobble: 0.04, samples: 14 },
        rng,
        {
          tone: toneStep(tone, p.step),
          streaks: [{ side: rng.sign(), offset: 0.22, width: 0.34, from: 0.25, to: 0.92, tone: "light", opacity: 0.42 }],
        },
        compose(face, rotate(p.ang)),
      ),
    );
  }
}

/** A: broad rounded petals with a dark eye and a ring of stamens. */
export function anemone(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx);
  const c: Pt = [0, -0.47 * S];
  const face = compose(translate(c[0], c[1]), rotate(rng.jitter(8)), scale(1, rng.range(0.78, 0.9)));
  const shapes: Shape[] = [];
  const phase = rng.range(0, 60);
  petalRing(shapes, rng, tone, face, 6, 0.5 * S, 0.24 * S, phase, ["base", "dark", "base", "light", "base", "dark"], { a: 0.8, b: 0.5 });
  if (upper) petalRing(shapes, rng, tone, face, 6, 0.34 * S, 0.18 * S, phase + 30, ["light"], { a: 0.8, b: 0.5 });
  const eye: Tone = { base: ACCENT.eye, light: shade(ACCENT.eye, 0.35), dark: ACCENT.eye };
  shapes.push(...paintOutline(applyAll(face, ellipsePts(0, 0, 0.13 * S, 0.13 * S, 14)), [], eye, undefined, { highlight: 0.3 }));
  const stamens = 10;
  for (let k = 0; k < stamens; k++) {
    const a = (k / stamens) * Math.PI * 2 + rng.jitter(0.2);
    shapes.push(dot(apply(face, [Math.cos(a) * 0.195 * S, Math.sin(a) * 0.195 * S]), 0.024 * S, ACCENT.eye));
  }
  return { shapes, hit: { x: c[0], y: c[1], r: 0.5 * S }, focus: { x: c[0], y: c[1] }, reach: S };
}

/** Crescent-shaped stroke on a circle, for the rose's spiral heart. */
function crescentPts(r: number, a0: number, span: number, thick: number): Pt[] {
  const n = 10;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const a = a0 + span * u;
    const th = (thick / 2) * Math.sin(Math.PI * u);
    outer.push([Math.cos(a) * (r + th), Math.sin(a) * (r + th)]);
    inner.push([Math.cos(a) * (r - th), Math.sin(a) * (r - th)]);
  }
  return [...outer, ...inner.slice(1, n).reverse()];
}

/** O: round, layered, with a spiral heart. */
export function rose(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx, 0.98);
  const c: Pt = [0, -0.46 * S];
  const face = compose(translate(c[0], c[1]), rotate(rng.jitter(10)), scale(1, rng.range(0.86, 0.96)));
  const shapes: Shape[] = [];
  // sepals peeking out below the head
  for (const side of [-1, 1] as const) {
    shapes.push(
      ...paintBlade(
        { length: 0.24 * S, width: 0.055 * S, a: 0.9, b: 1.4, wobble: 0.05, sharpTip: true },
        rng,
        { tone: GREEN },
        compose(translate(side * 0.05 * S, -0.2 * S), rotate(side * 138 + rng.jitter(8))),
      ),
    );
  }
  const phase = rng.range(0, 72);
  const round = { a: 0.62, b: 0.5 };
  if (upper) petalRing(shapes, rng, toneStep(tone, "dark"), face, 7, 0.5 * S, 0.27 * S, phase + 20, ["base"], round);
  petalRing(shapes, rng, tone, face, 5, 0.44 * S, 0.3 * S, phase, ["dark", "base"], round);
  petalRing(shapes, rng, tone, face, 5, 0.33 * S, 0.25 * S, phase + 36, ["base", "light"], round);
  petalRing(shapes, rng, tone, face, 4, 0.2 * S, 0.19 * S, phase + 18, ["light"], round);
  shapes.push(...paintOutline(applyAll(face, ellipsePts(0, 0, 0.11 * S, 0.11 * S, 12)), [], toneStep(tone, "light"), undefined, { highlight: 0 }));
  const spin = rng.range(0, Math.PI * 2);
  [
    [0.045, 3.4, 0.03],
    [0.085, 3.0, 0.035],
    [0.125, 2.4, 0.03],
  ].forEach(([r, span, th], i) => {
    const pts = crescentPts(r * S, spin + i * 2.1, span, th * S);
    shapes.push({ d: closedPath(applyAll(face, pts), [0, 10]), fill: tone.dark, opacity: 0.55 });
  });
  return { shapes, hit: { x: c[0], y: c[1], r: 0.46 * S }, focus: { x: c[0], y: c[1] }, reach: 0.95 * S };
}

/** I: tall upright standards over drooping falls with a yellow beard. */
export function iris(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx, 1.04);
  const shapes: Shape[] = [];
  // green receptacle
  shapes.push(...paintBlade({ length: 0.32 * S, width: 0.065 * S, a: 1.1, b: 0.8, wobble: 0.03 }, rng, { tone: GREEN }));
  const std = (rot: number, len: number, w: number, step: "light" | "base" | "dark") =>
    shapes.push(
      ...paintBlade(
        { length: len, width: w, a: 1.35, b: 0.66, asym: rng.jitter(0.1), bend: rng.jitter(0.08), wobble: 0.035 },
        rng,
        { tone: toneStep(tone, step), streaks: petalStreaks(rng, rot < 0 ? -1 : 1) },
        compose(translate(0, -0.27 * S), rotate(rot)),
      ),
    );
  if (upper) {
    std(-40 + rng.jitter(4), 0.5 * S, 0.13 * S, "dark");
    std(40 + rng.jitter(4), 0.5 * S, 0.13 * S, "dark");
  }
  std(-21 + rng.jitter(4), 0.6 * S, 0.14 * S, "light");
  std(21 + rng.jitter(4), 0.6 * S, 0.14 * S, "light");
  std(rng.jitter(4), 0.72 * S, 0.15 * S, "base");
  for (const side of [-1, 1] as const) {
    shapes.push(
      ...paintBlade(
        { length: 0.46 * S, width: 0.17 * S, a: 1.1, b: 0.6, asym: rng.jitter(0.1), bend: side * -0.06, wobble: 0.04 },
        rng,
        {
          tone: toneStep(tone, "dark"),
          streaks: [
            { side: 1, offset: 0, width: 0.26, from: 0.06, to: 0.55, tone: "light", opacity: 0.95, color: ACCENT.pollen },
            { side: -side as 1 | -1, offset: 0.45, width: 0.2, from: 0.3, to: 0.9, tone: "light", opacity: 0.4 },
          ],
        },
        compose(translate(side * 0.02 * S, -0.33 * S), rotate(side * (118 + rng.jitter(6)))),
      ),
    );
  }
  return { shapes, hit: { x: 0, y: -0.52 * S, r: 0.42 * S }, focus: { x: 0, y: -0.55 * S }, reach: S };
}

/**
 * U: a Philippine violet, an upright spike of small lipped florets that pair off up a
 * green axis and shrink to tight buds at the tip. It stands straight up from its stem,
 * so nothing hangs or hooks. The axis is a stalk (see Art.stalk), drawn with the stems.
 */
export function violet(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx, 0.95);
  const shapes: Shape[] = [];
  const base = -0.2 * S;
  const top = -1.02 * S;
  const lean = rng.jitter(0.05 * S);
  // the axis bends a touch as it climbs
  const axisAt = (t: number): Pt => [lean * t * t, base + (top - base) * t];
  const axis: Pt[] = [[0, 0], [0, base * 0.5], axisAt(0), axisAt(0.5), axisAt(1)];

  const levels = upper ? 6 : 5;
  const florets: Array<{ p: Pt; a: number; len: number; t: number }> = [];
  for (let i = 0; i < levels; i++) {
    const t = i / levels;
    const len = 0.24 * S * (1 - 0.5 * t) * rng.range(0.9, 1.08);
    const spread = 62 - 24 * t + rng.jitter(6);
    // the pair is staggered, so the spike reads as alternating florets
    for (const side of [-1, 1] as const) {
      const at = axisAt(Math.min(1, t + (side === 1 ? 0.5 / levels : 0)));
      florets.push({ p: at, a: side * spread, len, t });
    }
  }
  // tips first, so the lower (bigger) florets overlap them
  florets.sort((x, y) => x.p[1] - y.p[1]);
  for (const f of florets) {
    const m = compose(translate(f.p[0], f.p[1]), rotate(f.a));
    const w = f.len * 0.5;
    // the floret: an upper hood and a lighter lower lip, flaring away from the axis
    const hood = ellipsePts(0, -f.len * 0.55, w * 0.62, f.len * 0.58, 12);
    shapes.push(...paintOutline(applyAll(m, hood), [], tone, undefined, { highlight: f.t < 0.5 ? 0.35 : 0, highlightShift: [-0.15, -0.2] }));
    const lip = apply(m, [w * 0.25, -f.len * 0.95]);
    shapes.push(dot(lip, w * 0.42, tone.light, 0.85));
    // a dark calyx where it joins the axis
    shapes.push(dot(apply(m, [0, -f.len * 0.08]), w * 0.34, tone.dark));
  }
  // closed buds at the very tip
  const tip = axisAt(1);
  const bud = 0.05 * S;
  shapes.push(...paintDot([tip[0] - bud * 0.5, tip[1] + bud * 0.4], bud * 0.9, toneStep(tone, "dark"), false));
  shapes.push(...paintDot([tip[0] + bud * 0.2, tip[1] - bud * 0.6], bud, toneStep(tone, "dark"), false));

  const c = axisAt(0.45);
  return {
    shapes,
    hit: { x: c[0], y: c[1], r: 0.44 * S },
    focus: { x: c[0], y: c[1] },
    reach: S,
    stalk: sampleCurve(axis, 6),
  };
}

/** Y: a flat-topped cluster of tiny florets on radiating stalks. */
export function yarrow(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx, 0.95);
  const shapes: Shape[] = [];
  const cy = -0.6 * S;
  const rows: Array<{ n: number; y: number; span: number }> = [
    { n: 5, y: 0.02, span: 0.34 },
    { n: 4, y: -0.06, span: 0.26 },
    { n: 3, y: -0.12, span: 0.16 },
  ];
  if (upper) rows.push({ n: 2, y: -0.17, span: 0.07 }, { n: 6, y: 0.07, span: 0.42 });
  // stalks to the bottom row
  const bottom = rows[0];
  for (let k = 0; k < bottom.n; k++) {
    const x = (-bottom.span + (2 * bottom.span * k) / (bottom.n - 1)) * S;
    shapes.push(
      strokeShape(
        [
          [0, -0.02 * S],
          [x * 0.45, cy * 0.6],
          [x, cy + 0.05 * S],
        ],
        0.035 * S,
        0.02 * S,
        GREEN.dark,
      ),
    );
  }
  const florets: Array<{ p: Pt; r: number; light: boolean }> = [];
  rows.forEach((row, ri) => {
    for (let k = 0; k < row.n; k++) {
      const x = row.n === 1 ? 0 : (-row.span + (2 * row.span * k) / (row.n - 1)) * S;
      florets.push({
        p: [x + rng.jitter(0.02 * S), cy + row.y * S + rng.jitter(0.015 * S)],
        r: 0.07 * S * rng.range(0.88, 1.1),
        light: (k + ri) % 2 === 1,
      });
    }
  });
  // draw from the back (top) forward
  florets.sort((a, b) => a.p[1] - b.p[1]);
  for (const f of florets) {
    shapes.push(...paintDot(f.p, f.r, f.light ? toneStep(tone, "light") : tone, false));
    shapes.push(dot([f.p[0] + f.r * 0.1, f.p[1] - f.r * 0.05], f.r * 0.26, tone.dark, 0.75));
  }
  return { shapes, hit: { x: 0, y: cy - 0.04 * S, r: 0.42 * S }, focus: { x: 0, y: cy - 0.04 * S }, reach: 0.72 * S };
}

/** ❤ and friends: a heart-shaped bloom with a little yellow spadix. */
export function heartBloom(ctx: ArtCtx): Art {
  const { rng, tone } = ctx;
  const S = bloomSize(ctx, 0.9);
  const k = 0.027 * S;
  const n = 40;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x * k * (1 + rng.jitter(0.015)), y * k - 0.5 * S]);
  }
  const m = rotate(rng.jitter(10));
  const shapes = paintOutline(applyAll(m, pts), [0, n / 2], tone, undefined, { highlightShift: [-0.2, -0.16] });
  shapes.push(
    ...paintBlade(
      { length: 0.3 * S, width: 0.035 * S, a: 0.9, b: 0.9, bend: 0.2, wobble: 0.02 },
      rng,
      { tone: { base: ACCENT.pollen, light: shade(ACCENT.pollen, 0.3), dark: shade(ACCENT.pollen, -0.2) }, rim: 0.12 },
      compose(m, translate(0.02 * S, -0.52 * S), rotate(22)),
    ),
  );
  return { shapes, hit: { x: 0, y: -0.5 * S, r: 0.45 * S }, focus: { x: 0, y: -0.5 * S }, reach: 0.95 * S };
}
