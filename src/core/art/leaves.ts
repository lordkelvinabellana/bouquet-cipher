/**
 * Leaves: one shape family per consonant column, tinted sage / dusty blue / coral
 * by letter frequency (see alphabet/v1.ts). Coral leaves always hang on a thin dark
 * sprig, a cue that doesn't depend on colour.
 */
import type { LeafShape } from "../alphabet/v1";
import type { Rng } from "../rng";
import { shade, toneStep, type Tone } from "./color";
import { closedPath, compose, makeNoise, rotate, sampleCurve, translate, type Pt } from "./geom";
import { paintBlade, strokeShape, type PaintSpec } from "./paint";
import { PAPER } from "./palette";
import type { Art, ArtCtx, Shape } from "./types";

export const LEAF_SIZE = 34;

export interface LeafCtx extends ArtCtx {
  /** Hang the leaf on a long thin dark sprig (coral tint). */
  sprig: boolean;
}

function leafPaint(tone: Tone, side: 1 | -1, midrib = true): PaintSpec {
  return {
    tone,
    midrib,
    streaks: [{ side, offset: 0.5, width: 0.42, from: 0.08, to: 0.92, tone: "light", opacity: 0.42 }],
  };
}

function stalk(shapes: Shape[], ctx: LeafCtx, L: number, plain: number, sprig: number): number {
  const p = ctx.sprig ? sprig * L : plain * L;
  if (p > 0.5) {
    const bend = ctx.rng.jitter(0.06 * L);
    shapes.push(
      strokeShape(
        sampleCurve(
          [
            [0, 0],
            [bend, -p * 0.55],
            [0, -p],
          ],
          4,
        ),
        ctx.sprig ? 0.075 * L : 0.085 * L,
        0.04 * L,
        ctx.sprig ? PAPER.ink : ctx.tone.dark,
      ),
    );
  }
  return p;
}

/** Capital letters get a small paired leaflet at the base. */
function stipule(shapes: Shape[], rng: Rng, tone: Tone, L: number, at: number) {
  shapes.push(
    ...paintBlade(
      { length: 0.42 * L, width: 0.11 * L, a: 0.95, b: 1.3, wobble: 0.04, sharpTip: true, samples: 10 },
      rng,
      leafPaint(toneStep(tone, "dark"), 1, false),
      compose(translate(0, -at), rotate(-52 + rng.jitter(6))),
    ),
  );
}

function leafSize(ctx: LeafCtx, k = 1): number {
  return LEAF_SIZE * k * (ctx.upper ? 1.25 : 1) * ctx.rng.range(0.92, 1.08);
}

function bladeLeaf(
  ctx: LeafCtx,
  k: number,
  stalkLen: [number, number],
  blade: { length: number; width: number; a: number; b: number; lobes?: number; lobeDepth?: number; sCurve?: number; samples?: number },
): Art {
  const { rng, tone, upper } = ctx;
  const L = leafSize(ctx, k);
  const shapes: Shape[] = [];
  const p = stalk(shapes, ctx, L, stalkLen[0], stalkLen[1]);
  if (upper) stipule(shapes, rng, tone, L, p * 0.5);
  const side = rng.sign();
  shapes.push(
    ...paintBlade(
      {
        length: blade.length * L,
        width: blade.width * L,
        a: blade.a,
        b: blade.b,
        lobes: blade.lobes,
        lobeDepth: blade.lobeDepth,
        sCurve: blade.sCurve,
        asym: rng.jitter(0.1),
        bend: rng.jitter(0.12),
        wobble: 0.04,
        sharpTip: true,
        samples: blade.samples,
      },
      rng,
      leafPaint(tone, side),
      translate(0, -p),
    ),
  );
  const mid = p + blade.length * L * 0.45;
  return { shapes, hit: { x: 0, y: -mid, r: Math.max(blade.width * L * 1.1, blade.length * L * 0.36) }, focus: { x: 0, y: -mid }, reach: p + blade.length * L };
}

function heartLeaf(ctx: LeafCtx): Art {
  const { rng, tone, upper } = ctx;
  const L = leafSize(ctx);
  const shapes: Shape[] = [];
  const p = stalk(shapes, ctx, L, 0.16, 0.3);
  if (upper) stipule(shapes, rng, tone, L, p * 0.5);
  const noise = makeNoise(rng.next);
  const right: Pt[] = [
    [0.1, 0.0],
    [0.24, -0.06],
    [0.33, -0.22],
    [0.32, -0.42],
    [0.24, -0.62],
    [0.12, -0.8],
  ];
  const w = (pt: Pt, s: 1 | -1): Pt => [s * pt[0] * L * (1 + 0.05 * noise(-pt[1] + (s > 0 ? 0 : 0.4))), pt[1] * L - p];
  const notch: Pt = [0, -0.08 * L - p];
  const tip: Pt = [rng.jitter(0.03 * L), -0.97 * L - p];
  const outline: Pt[] = [notch, ...right.map((q) => w(q, 1)), tip, ...right.map((q) => w(q, -1)).reverse()];
  const corners = [0, right.length + 1];
  const inner = outline.map(([x, y]) => [x * 0.86, (y + p + 0.45 * L) * 0.9 - 0.45 * L - p] as Pt);
  shapes.push({ d: closedPath(outline, corners), fill: shade(tone.base, -0.09) });
  shapes.push({ d: closedPath(inner, corners), fill: tone.base });
  // lighter half on one side of the midrib
  const side = rng.sign();
  const half: Pt[] = [
    [0, -0.12 * L - p],
    ...right.slice(1).map((q) => [side * q[0] * L * 0.72, q[1] * L * 0.95 - p] as Pt),
    [0, -0.88 * L - p],
  ];
  shapes.push({ d: closedPath(half, [0, half.length - 1]), fill: tone.light, opacity: 0.42 });
  const rib: Pt[] = [];
  for (let k = 0; k <= 6; k++) rib.push([tip[0] * (k / 6), -0.1 * L - p - 0.75 * L * (k / 6)]);
  shapes.push(strokeShape(rib, 0.07 * L, 0.02 * L, tone.dark, undefined, 0.55));
  const mid = p + 0.45 * L;
  return { shapes, hit: { x: 0, y: -mid, r: 0.36 * L }, focus: { x: 0, y: -mid }, reach: p + 0.97 * L };
}

function needleLeaf(ctx: LeafCtx): Art {
  const { rng, tone, upper } = ctx;
  const L = leafSize(ctx, 1.05);
  const shapes: Shape[] = [];
  const p = stalk(shapes, ctx, L, 0.02, 0.24);
  if (upper) stipule(shapes, rng, tone, L, p * 0.5 + 0.05 * L);
  const lean = rng.jitter(0.08 * L);
  const axis: Pt[] = sampleCurve(
    [
      [0, -p],
      [lean * 0.4, -p - 0.5 * L],
      [lean, -p - 0.95 * L],
    ],
    5,
  );
  shapes.push(strokeShape(axis, 0.07 * L, 0.03 * L, tone.dark));
  let side = rng.sign();
  const count = 7;
  for (let k = 0; k < count; k++) {
    const t = 0.1 + (0.8 * k) / count;
    const at: Pt = [lean * t * t, -p - 0.95 * L * t];
    const len = (0.42 - 0.025 * k) * L * rng.range(0.9, 1.08);
    shapes.push(
      ...paintBlade(
        { length: len, width: 0.034 * L, a: 0.6, b: 1.6, wobble: 0.03, sharpTip: true, samples: 8, bend: side * 0.05 },
        rng,
        { tone: toneStep(tone, k % 2 ? "light" : "base"), rim: 0.12 },
        compose(translate(at[0], at[1]), rotate(side * (36 + rng.jitter(6)))),
      ),
    );
    side = -side as 1 | -1;
  }
  shapes.push(
    ...paintBlade(
      { length: 0.3 * L, width: 0.034 * L, a: 0.6, b: 1.6, wobble: 0.03, sharpTip: true, samples: 8 },
      rng,
      { tone, rim: 0.12 },
      compose(translate(lean, -p - 0.95 * L), rotate(rng.jitter(8))),
    ),
  );
  const mid = p + 0.55 * L;
  return { shapes, hit: { x: 0, y: -mid, r: 0.34 * L }, focus: { x: 0, y: -mid }, reach: p + 1.2 * L };
}

function fernLeaf(ctx: LeafCtx): Art {
  const { rng, tone, upper } = ctx;
  const L = leafSize(ctx, 1.1);
  const shapes: Shape[] = [];
  const p = stalk(shapes, ctx, L, 0.02, 0.26);
  if (upper) stipule(shapes, rng, tone, L, p * 0.5 + 0.05 * L);
  const bend = rng.jitter(0.12 * L);
  const at = (t: number): Pt => [bend * t * t, -p - 1.05 * L * t];
  shapes.push(strokeShape(sampleCurve([at(0), at(0.5), at(1)], 5), 0.06 * L, 0.025 * L, tone.dark));
  for (let k = 0; k < 5; k++) {
    const t = 0.16 + 0.15 * k;
    const base = at(t);
    for (const side of [-1, 1] as const) {
      shapes.push(
        ...paintBlade(
          { length: (0.36 - 0.055 * k) * L * rng.range(0.9, 1.08), width: 0.075 * L, a: 0.9, b: 1.1, wobble: 0.04, sharpTip: true, samples: 9, bend: side * 0.08 },
          rng,
          { tone: toneStep(tone, side > 0 ? "base" : "light"), rim: 0.1 },
          compose(translate(base[0], base[1]), rotate(side * (58 - 4 * k) + rng.jitter(5))),
        ),
      );
    }
  }
  const top = at(1);
  shapes.push(
    ...paintBlade(
      { length: 0.2 * L, width: 0.07 * L, a: 0.9, b: 1.1, wobble: 0.04, sharpTip: true, samples: 9 },
      rng,
      { tone, rim: 0.1 },
      compose(translate(top[0], top[1] + 0.03 * L), rotate(rng.jitter(8))),
    ),
  );
  const mid = p + 0.5 * L;
  return { shapes, hit: { x: 0, y: -mid, r: 0.4 * L }, focus: { x: 0, y: -mid }, reach: p + 1.25 * L };
}

export function leaf(shape: LeafShape, ctx: LeafCtx): Art {
  switch (shape) {
    case "teardrop":
      return bladeLeaf(ctx, 1, [0.12, 0.32], { length: 0.9, width: 0.22, a: 0.95, b: 1.3 });
    case "round":
      return bladeLeaf(ctx, 1, [0.2, 0.34], { length: 0.62, width: 0.3, a: 0.55, b: 0.55 });
    case "heart":
      return heartLeaf(ctx);
    case "slender":
      return bladeLeaf(ctx, 1, [0.08, 0.3], { length: 1.25, width: 0.085, a: 1.0, b: 1.15, sCurve: 0.035 * ctx.rng.sign(), samples: 18 });
    case "needle":
      return needleLeaf(ctx);
    case "lobed":
      return bladeLeaf(ctx, 1.02, [0.1, 0.3], { length: 1.0, width: 0.3, a: 0.95, b: 1.1, lobes: 3, lobeDepth: 0.38, samples: 34 });
    case "fern":
      return fernLeaf(ctx);
  }
}

export const LEAF_SHAPES: readonly LeafShape[] = ["teardrop", "round", "heart", "slender", "needle", "lobed", "fern"];
