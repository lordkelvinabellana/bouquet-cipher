/**
 * Blooms: one per vowel (and Y). Each has a distinct silhouette so it can be read
 * by shape alone; colour is decorative.
 *
 *   E tulip (cup)   A anemone (broad fan, dark eye)   O rose (round spiral)
 *   I iris (tall)   U bellflower (hanging bell)       Y yarrow (flat cluster)
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

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Bell outline hanging down from (0,0) along +y, with a five-pointed scalloped rim. */
function bellPts(len: number, wTop: number, wGrow: number, flare: number): { pts: Pt[]; corners: number[] } {
  const n = 9;
  const right: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    right.push([wTop + wGrow * Math.pow(t, 1.3) + flare * smoothstep(0.65, 1, t), len * t]);
  }
  const W = right[n][0];
  // Two outer corners plus three inner points make five tips; notches sit between them.
  const gaps = 4;
  const rim: Pt[] = [];
  for (let k = 1; k < gaps * 2; k++) {
    const u = k / (gaps * 2);
    rim.push([W - 2 * W * u, k % 2 === 1 ? len * 0.9 : len * 1.02]);
  }
  const left = right.map(([x, y]) => [-x, y] as Pt).reverse();
  const pts = [...right, ...rim, ...left];
  const corners = [n, n + rim.length + 1];
  rim.forEach((_, i) => {
    if ((i + 1) % 2 === 0) corners.push(n + 1 + i);
  });
  return { pts, corners };
}

/**
 * U: a bell nodding from a short hooked neck, hanging beside its stem rather than above
 * the bunch. Hooks toward +x (the layout mirrors it on the left). The neck is a stalk
 * (see Art.stalk), drawn with the stems.
 */
export function bellflower(ctx: ArtCtx): Art {
  const { rng, tone, upper } = ctx;
  const S = bloomSize(ctx, 0.95);
  const shapes: Shape[] = [];
  const neck: Pt[] = [
    [0, 0],
    [0.02 * S, -0.18 * S],
    [0.1 * S, -0.34 * S],
    [0.24 * S, -0.41 * S],
    [0.36 * S, -0.36 * S],
  ];
  const H = neck[neck.length - 1];
  const m = compose(translate(H[0], H[1]), rotate(-14 + rng.jitter(8)));
  // tiny green calyx where the bell meets the neck
  shapes.push(...paintOutline(applyAll(m, ellipsePts(0, 0.02 * S, 0.085 * S, 0.055 * S, 10)), [], GREEN, undefined, { highlight: 0 }));
  const len = 0.62 * S;
  const body = bellPts(len, 0.085 * S, 0.17 * S, 0.075 * S);
  const mouth = ellipsePts(0, len * 0.9, (0.085 + 0.17 + 0.075) * S * 0.78, 0.05 * S, 14);
  shapes.push(...paintOutline(applyAll(m, mouth), [], toneStep(tone, "dark"), undefined, { highlight: 0, rim: 0.05 }));
  shapes.push(...paintOutline(applyAll(m, body.pts), body.corners, tone, undefined, { highlightShift: [-0.2, -0.05] }));
  if (upper) {
    const inner = bellPts(len * 0.84, 0.06 * S, 0.13 * S, 0.055 * S);
    shapes.push(
      ...paintOutline(applyAll(m, inner.pts), inner.corners, toneStep(tone, "light"), undefined, { highlight: 0.3 }),
    );
  }
  // a pale streak down one side of the bell
  const streak: Pt[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    streak.push([(0.085 + 0.17 * Math.pow(t, 1.3)) * S * 0.5, len * 0.85 * t + 0.05 * S]);
  }
  shapes.push(strokeShape(applyAll(m, streak), 0.05 * S, 0.02 * S, tone.light, undefined, 0.5));
  const f = apply(m, [0, len * 0.5]);
  return {
    shapes,
    hit: { x: (f[0] + H[0] * 0.3) / 1.3, y: f[1] - 0.05 * S, r: 0.42 * S },
    focus: { x: f[0], y: f[1] },
    reach: S * 0.7,
    stalk: sampleCurve(neck, 5),
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
