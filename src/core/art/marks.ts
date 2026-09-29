/**
 * Small accents: punctuation, numbers, the mystery seed, and the dewdrops that mark
 * accented letters.
 *
 *   .  closed bud        …  trio of buds       ,  curled tendril
 *   !  starburst         ?  nodding snowdrop   ' ’ ‘ " “ ”  thorns
 *   - – —  knuckle rings on the stem           1–9  berries (dice pips)   0  seed pod
 */
import type { MarkKind } from "../alphabet/v1";
import type { Rng } from "../rng";
import { shade, toneStep, type Tone } from "./color";
import { apply, applyAll, closedPath, compose, ellipsePts, rotate, sampleCurve, translate, type Mat, type Pt } from "./geom";
import { dot, paintBlade, paintDot, paintOutline, strokeShape } from "./paint";
import { ACCENT, GREEN, PAPER } from "./palette";
import type { Art, ArtCtx, Shape } from "./types";

const K = (ctx: ArtCtx) => (ctx.upper ? 1.25 : 1) * ctx.rng.range(0.94, 1.06);

function oneBud(shapes: Shape[], rng: Rng, tone: Tone, m: Mat, len: number) {
  for (const side of [-1, 1] as const) {
    shapes.push(
      ...paintBlade(
        { length: len * 0.5, width: len * 0.15, a: 0.9, b: 1.3, wobble: 0.04, sharpTip: true, samples: 8 },
        rng,
        { tone: GREEN, rim: 0.1 },
        compose(m, translate(0, -len * 0.18), rotate(side * 30 + rng.jitter(6))),
      ),
    );
  }
  shapes.push(
    ...paintBlade(
      { length: len, width: len * 0.34, a: 1.25, b: 0.9, wobble: 0.03, asym: rng.jitter(0.1), samples: 12 },
      rng,
      { tone, streaks: [{ side: rng.sign(), offset: 0.35, width: 0.3, from: 0.2, to: 0.85, tone: "light", opacity: 0.5 }] },
      compose(m, translate(0, -len * 0.12)),
    ),
  );
}

function bud(ctx: ArtCtx, variant: number): Art {
  const { rng, tone } = ctx;
  const k = K(ctx);
  const shapes: Shape[] = [];
  if (variant === 1) {
    const tips: Pt[] = [
      [-7 * k, -12 * k],
      [0, -17 * k],
      [7 * k, -12 * k],
    ];
    for (const t of tips) {
      shapes.push(strokeShape([[0, 0], [t[0] * 0.3, t[1] * 0.6], t], 1.8, 1.0, PAPER.ink));
    }
    tips.forEach((t, i) => oneBud(shapes, rng, i === 1 ? tone : toneStep(tone, "dark"), compose(translate(t[0], t[1]), rotate(t[0] * 2.4)), 10 * k));
    return { shapes, hit: { x: 0, y: -18 * k, r: 12 * k }, focus: { x: 0, y: -20 * k }, reach: 28 * k };
  }
  shapes.push(strokeShape([[0, 0], [0, -5 * k]], 1.8, 1.4, PAPER.ink));
  oneBud(shapes, rng, tone, translate(0, -4 * k), 16 * k);
  return { shapes, hit: { x: 0, y: -13 * k, r: 8 * k }, focus: { x: 0, y: -14 * k }, reach: 21 * k };
}

function tendril(ctx: ArtCtx): Art {
  const { rng } = ctx;
  const k = K(ctx);
  const turn = rng.range(2.4, 2.9) * Math.PI;
  const c: Pt = [6 * k, -17 * k];
  const pts: Pt[] = [
    [0, 0],
    [0.5 * k, -6 * k],
    [2 * k, -11 * k],
  ];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = Math.PI + u * turn;
    const r = 5.2 * k * (1 - 0.82 * u);
    pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  const line = sampleCurve(pts.slice(0, 3), 3).concat(pts.slice(3));
  const shapes: Shape[] = [strokeShape(line, 2.0 * k, 0.5 * k, GREEN.dark)];
  return { shapes, hit: { x: 4 * k, y: -15 * k, r: 7 * k }, focus: { x: 5 * k, y: -16 * k }, reach: 23 * k };
}

function starburst(ctx: ArtCtx): Art {
  const { rng } = ctx;
  const k = K(ctx);
  const shapes: Shape[] = [];
  const count = 7;
  const heads: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const a = (-62 + (124 * i) / (count - 1) + rng.jitter(5)) * (Math.PI / 180);
    const len = (12 + rng.range(0, 6) + (i % 2 ? 3 : 0)) * k;
    const end: Pt = [Math.sin(a) * len, -Math.cos(a) * len - 4 * k];
    heads.push(end);
    shapes.push(strokeShape([[0, -3 * k], [end[0] * 0.5, end[1] * 0.55 - 1.5 * k], end], 1.1, 0.7, GREEN.dark));
  }
  shapes.push(strokeShape([[0, 0], [0, -4 * k]], 1.8, 1.3, PAPER.ink));
  for (const h of heads) {
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 + rng.jitter(0.3);
      shapes.push(dot([h[0] + Math.cos(a) * 1.7 * k, h[1] + Math.sin(a) * 1.7 * k], 1.75 * k, ACCENT.snow.base));
    }
    shapes.push(dot(h, 1.05 * k, ACCENT.pollen));
  }
  return { shapes, hit: { x: 0, y: -14 * k, r: 12 * k }, focus: { x: 0, y: -16 * k }, reach: 24 * k };
}

function snowdrop(ctx: ArtCtx): Art {
  const { rng } = ctx;
  const k = K(ctx);
  const shapes: Shape[] = [];
  const hook: Pt[] = [
    [0, 0],
    [0.5 * k, -12 * k],
    [3 * k, -20 * k],
    [8 * k, -23.5 * k],
    [12.5 * k, -21 * k],
  ];
  shapes.push(strokeShape(sampleCurve(hook, 5), 1.7 * k, 1.1 * k, GREEN.dark));
  const H = hook[hook.length - 1];
  const m = compose(translate(H[0], H[1] + 1 * k), rotate(180 + rng.jitter(8)));
  for (const r of [-24, 24]) {
    shapes.push(
      ...paintBlade(
        { length: 10 * k, width: 3.2 * k, a: 0.9, b: 0.7, wobble: 0.04, samples: 10 },
        rng,
        { tone: ACCENT.snow, rim: 0.12 },
        compose(m, translate(0, -1.2 * k), rotate(r)),
      ),
    );
  }
  shapes.push(
    ...paintBlade(
      { length: 11 * k, width: 3.5 * k, a: 0.9, b: 0.7, wobble: 0.04, samples: 10 },
      rng,
      { tone: ACCENT.snow, rim: 0.12, streaks: [{ side: 1, offset: 0, width: 0.2, from: 0.7, to: 0.95, tone: "light", opacity: 1, color: GREEN.base }] },
      compose(m, translate(0, -1.2 * k)),
    ),
  );
  shapes.push(...paintDot([H[0], H[1] + 1.2 * k], 2 * k, GREEN, false));
  const f = apply(m, [0, -7 * k]);
  return { shapes, hit: { x: 7 * k, y: -16 * k, r: 10 * k }, focus: { x: f[0], y: f[1] }, reach: 25 * k };
}

function thornPts(k: number, lean: number): Pt[] {
  return [
    [-2.6 * k, 0.6 * k],
    [2.6 * k, 0.6 * k],
    [1.4 * k + lean * 0.3, -3 * k],
    [0.9 * k + lean, -7.2 * k],
    [-0.4 * k + lean * 0.4, -3.4 * k],
  ];
}

function thorn(ctx: ArtCtx, variant: number): Art {
  const k = K(ctx);
  const shapes: Shape[] = [];
  const lean = variant === 1 ? 1.4 * k : variant === 2 ? -1.1 * k : variant === 4 ? -1.1 * k : variant === 5 ? 1.4 * k : 0.3 * k;
  const double = variant >= 3;
  const xs = double ? [-2.7 * k, 2.7 * k] : [0];
  const tone: Tone = { base: PAPER.ink, light: PAPER.inkLight, dark: shade(PAPER.ink, -0.2) };
  for (const x of xs) {
    shapes.push(...paintOutline(applyAll(translate(x, 0), thornPts(k, lean)), [0, 1, 3], tone, undefined, { highlight: 0.35 }));
  }
  return { shapes, hit: { x: 0, y: -3.5 * k, r: 4.5 * k }, focus: { x: 0, y: -4 * k }, reach: 7.5 * k };
}

function knuckle(ctx: ArtCtx, variant: number): Art {
  const k = K(ctx);
  const shapes: Shape[] = [];
  const rx = (variant === 1 ? 4.8 : 3.8) * k;
  const rings = variant === 2 ? [0, -4.6 * k] : [0];
  const tone: Tone = { base: PAPER.inkLight, light: shade(PAPER.inkLight, 0.35), dark: PAPER.ink };
  for (const y of rings) {
    shapes.push(...paintOutline(ellipsePts(0, y, rx, 1.9 * k, 14), [], tone, undefined, { highlight: 0.5, highlightShift: [0, -0.3] }));
  }
  return { shapes, hit: { x: 0, y: -1 * k, r: 4 * k }, focus: { x: 0, y: -1.5 * k }, reach: 5 * k };
}

/** Dice-pip layouts, in units of pip spacing. */
const PIPS: Readonly<Record<number, readonly Pt[]>> = {
  1: [[0, 0]],
  2: [[-1, 1], [1, -1]],
  3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  7: [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]],
  8: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
};

export function berries(ctx: ArtCtx, n: number): Art {
  const { rng } = ctx;
  const k = K(ctx);
  const shapes: Shape[] = [];
  const fork: Pt = [0, -9 * k];
  const c: Pt = [0, -18 * k];
  const gap = 6.4 * k;
  shapes.push(strokeShape([[0, 0], fork], 1.8, 1.3, PAPER.ink));
  const pips = PIPS[n] ?? PIPS[1];
  const spots = pips.map(([x, y]) => [c[0] + x * gap + rng.jitter(0.5 * k), c[1] + y * gap + rng.jitter(0.5 * k)] as Pt);
  for (const s of spots) shapes.push(strokeShape([fork, [(fork[0] + s[0]) / 2, (fork[1] + s[1]) / 2 - 1.5 * k], s], 0.9, 0.6, PAPER.ink, undefined, 0.8));
  spots.sort((a, b) => a[1] - b[1]);
  for (const s of spots) shapes.push(...paintDot(s, 3.1 * k * rng.range(0.92, 1.08), ACCENT.berry));
  return { shapes, hit: { x: 0, y: c[1], r: 11 * k }, focus: { x: 0, y: c[1] }, reach: 26 * k };
}

export function pod(ctx: ArtCtx): Art {
  const { rng } = ctx;
  const k = K(ctx);
  const shapes: Shape[] = [strokeShape([[0, 0], [0, -6 * k]], 1.8, 1.4, PAPER.ink)];
  shapes.push(
    ...paintBlade(
      { length: 14 * k, width: 6 * k, a: 0.85, b: 0.75, wobble: 0.03, samples: 12 },
      rng,
      {
        tone: ACCENT.pod,
        streaks: [
          { side: 1, offset: 0.45, width: 0.12, from: 0.1, to: 0.9, tone: "dark", opacity: 0.45 },
          { side: -1, offset: 0.45, width: 0.12, from: 0.1, to: 0.9, tone: "dark", opacity: 0.45 },
          { side: 1, offset: 0.0, width: 0.1, from: 0.15, to: 0.85, tone: "light", opacity: 0.6 },
        ],
      },
      translate(0, -5 * k),
    ),
  );
  // little crown on top
  const crown: Pt[] = [];
  const spikes = 5;
  for (let i = 0; i <= spikes * 2; i++) {
    const x = -4.2 * k + (8.4 * k * i) / (spikes * 2);
    crown.push([x, -19 * k - (i % 2 === 0 ? 2.6 * k : 0)]);
  }
  crown.push([4.2 * k, -18 * k], [-4.2 * k, -18 * k]);
  shapes.push({ d: closedPath(crown, crown.map((_, i) => i)), fill: ACCENT.pod.dark });
  return { shapes, hit: { x: 0, y: -12 * k, r: 8 * k }, focus: { x: 0, y: -12 * k }, reach: 21 * k };
}

export function mysterySeed(ctx: ArtCtx): Art {
  const { rng } = ctx;
  const k = K(ctx);
  const shapes: Shape[] = [strokeShape([[0, 0], [0, -4 * k]], 1.6, 1.2, PAPER.ink)];
  shapes.push(
    ...paintBlade(
      { length: 13 * k, width: 4.6 * k, a: 1.0, b: 0.9, wobble: 0.03, samples: 12, asym: rng.jitter(0.1) },
      rng,
      {
        tone: ACCENT.seed,
        streaks: [
          { side: 1, offset: 0.4, width: 0.12, from: 0.12, to: 0.9, tone: "light", opacity: 0.85 },
          { side: -1, offset: 0.4, width: 0.12, from: 0.12, to: 0.9, tone: "light", opacity: 0.85 },
        ],
      },
      compose(translate(0, -3.5 * k), rotate(rng.jitter(10))),
    ),
  );
  return { shapes, hit: { x: 0, y: -10 * k, r: 7 * k }, focus: { x: 0, y: -10 * k }, reach: 17 * k };
}

export function mark(kind: MarkKind, variant: number, ctx: ArtCtx): Art {
  switch (kind) {
    case "bud":
      return bud(ctx, variant);
    case "tendril":
      return tendril(ctx);
    case "starburst":
      return starburst(ctx);
    case "snowdrop":
      return snowdrop(ctx);
    case "thorn":
      return thorn(ctx, variant);
    case "knuckle":
      return knuckle(ctx, variant);
  }
}

/** Marks that sit on the stem's own axis instead of reaching out to one side. */
export function isAxisMark(kind: MarkKind): boolean {
  return kind === "knuckle";
}

// ——— dewdrops (accents on letters) ———

function drop(shapes: Shape[], at: Pt, size: number, tilt: number, rng: Rng) {
  const m = compose(translate(at[0], at[1]), rotate(tilt));
  shapes.push(
    ...paintBlade(
      { length: size, width: size * 0.42, a: 0.5, b: 1.4, wobble: 0.02, sharpTip: true, sharpBase: false, samples: 10 },
      rng,
      { tone: { base: ACCENT.dew, light: "#FFFFFF", dark: ACCENT.dewRim }, rim: 0.28 },
      m,
    ),
  );
  shapes.push(dot(apply(m, [-size * 0.12, -size * 0.3]), size * 0.1, "#FFFFFF", 0.95));
}

/**
 * Add dewdrops for accents. Each accent has its own arrangement, so é, è, ê and ë
 * stay distinguishable. Accents stack upward if a letter has several.
 */
export function dewdrops(accents: readonly number[], host: Art, rng: Rng): Shape[] {
  const shapes: Shape[] = [];
  const r = host.hit.r;
  accents.forEach((acc, i) => {
    const s = Math.max(5.5, r * 0.26);
    const base: Pt = [host.focus.x + r * 0.62, host.focus.y - r * 0.55 - i * s * 1.3];
    const g = s * 0.62;
    switch (acc) {
      case 0: // acute
        drop(shapes, base, s, 28, rng);
        break;
      case 1: // grave
        drop(shapes, base, s, -28, rng);
        break;
      case 2: // circumflex ^
        drop(shapes, [base[0] - g, base[1] + g * 0.5], s * 0.8, -35, rng);
        drop(shapes, [base[0] + g, base[1] + g * 0.5], s * 0.8, 35, rng);
        break;
      case 3: // diaeresis ¨
        drop(shapes, [base[0] - g, base[1]], s * 0.72, 0, rng);
        drop(shapes, [base[0] + g, base[1]], s * 0.72, 0, rng);
        break;
      case 4: // tilde ~ : a long drop lying on its side with a smaller one beside it
        drop(shapes, [base[0] - g * 0.4, base[1]], s * 1.1, 70, rng);
        drop(shapes, [base[0] + g * 1.1, base[1] - g * 0.3], s * 0.6, -70, rng);
        break;
      case 5: // ring ˚ : a hollow drop
        shapes.push({
          d: `M${base[0] - s * 0.45} ${base[1]}a${s * 0.45} ${s * 0.45} 0 1 0 ${s * 0.9} 0a${s * 0.45} ${s * 0.45} 0 1 0 ${-s * 0.9} 0Z` +
            `M${base[0] - s * 0.22} ${base[1]}a${s * 0.22} ${s * 0.22} 0 1 1 ${s * 0.44} 0a${s * 0.22} ${s * 0.22} 0 1 1 ${-s * 0.44} 0Z`,
          fill: ACCENT.dewRim,
          rule: "evenodd",
        });
        break;
      case 6: // cedilla ¸ : a drop hanging below the element
        drop(shapes, [host.focus.x + r * 0.2, host.focus.y + r * 0.95], s, 180, rng);
        break;
      case 7: // caron ˇ
        drop(shapes, [base[0] - g, base[1] - g * 0.5], s * 0.8, 35, rng);
        drop(shapes, [base[0] + g, base[1] - g * 0.5], s * 0.8, -35, rng);
        break;
      case 8: // macron ¯ : a flat drop
        drop(shapes, base, s * 1.2, 90, rng);
        break;
      case 9: // breve ˘ : a crescent of three tiny drops
        [-1, 0, 1].forEach((j) => drop(shapes, [base[0] + j * g * 0.8, base[1] + Math.abs(j) * -g * 0.5], s * 0.5, j * 40, rng));
        break;
      case 10: // dot above ˙
        shapes.push(...paintDot(base, s * 0.32, { base: ACCENT.dew, light: "#FFFFFF", dark: ACCENT.dewRim }));
        break;
      case 11: // double acute ˝
        drop(shapes, [base[0] - g * 0.8, base[1]], s * 0.85, 28, rng);
        drop(shapes, [base[0] + g * 0.8, base[1]], s * 0.85, 28, rng);
        break;
      case 12: // ogonek ˛ : a drop below, tilted
        drop(shapes, [host.focus.x - r * 0.2, host.focus.y + r * 0.95], s, 150, rng);
        break;
    }
  });
  return shapes;
}
