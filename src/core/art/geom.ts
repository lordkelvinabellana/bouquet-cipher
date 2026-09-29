/**
 * Geometry helpers for the procedural artwork.
 *
 * Convention: every element is drawn in its own local space with its attachment
 * point at the origin, growing "up" along -y (SVG y points down). The layout later
 * rotates, mirrors and moves it into place.
 */

export type Pt = readonly [number, number];

/** SVG-style affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = readonly [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** m ∘ n: apply n first, then m. */
export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** compose(A, B, C) = A ∘ B ∘ C (C is applied first). */
export function compose(...ms: Mat[]): Mat {
  return ms.reduce((acc, m) => mul(acc, m), IDENTITY);
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];

export const scale = (sx: number, sy: number = sx): Mat => [sx, 0, 0, sy, 0, 0];

/** Rotate by degrees. Positive is clockwise on screen (so +20° tilts an upward shape right). */
export function rotate(deg: number): Mat {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

export function apply(m: Mat, p: Pt): Pt {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

export function applyAll(m: Mat, pts: readonly Pt[]): Pt[] {
  return pts.map((p) => apply(m, p));
}

/** Round to one decimal for compact, engine-independent path strings. */
export function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? "0" : String(r);
}

/**
 * Smooth closed path through points (Catmull-Rom converted to cubic Béziers).
 * Points listed in `corners` get zero-length tangents, so they stay sharp.
 */
export function closedPath(pts: readonly Pt[], corners: readonly number[] = [], tension = 1): string {
  const n = pts.length;
  if (n < 3) return "";
  const sharp = new Set(corners);
  const tan = pts.map((_, i) => {
    if (sharp.has(i)) return [0, 0] as const;
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    return [((b[0] - a[0]) / 2) * tension, ((b[1] - a[1]) / 2) * tension] as const;
  });
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p = pts[i];
    const q = pts[j];
    d +=
      `C${fmt(p[0] + tan[i][0] / 3)} ${fmt(p[1] + tan[i][1] / 3)} ` +
      `${fmt(q[0] - tan[j][0] / 3)} ${fmt(q[1] - tan[j][1] / 3)} ${fmt(q[0])} ${fmt(q[1])}`;
  }
  return d + "Z";
}

/** Circle as a path (two arcs), so every renderer can treat it like any other shape. */
export function circlePath(cx: number, cy: number, r: number): string {
  return (
    `M${fmt(cx - r)} ${fmt(cy)}` +
    `a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0` +
    `a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`
  );
}

/** Ellipse outline as points, for shapes that need transforming. */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, count = 16): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Smooth 1-D noise in roughly [-1, 1], built from two seeded sine waves. */
export type Noise = (t: number) => number;

export function makeNoise(r: () => number): Noise {
  const f1 = 1.1 + r() * 0.8;
  const f2 = 2.3 + r() * 1.4;
  const p1 = r();
  const p2 = r();
  return (t) => 0.6 * Math.sin(2 * Math.PI * (f1 * t + p1)) + 0.4 * Math.sin(2 * Math.PI * (f2 * t + p2));
}

/**
 * Beta-style width profile: 0 at both ends, peaking at 1 where t = a / (a + b).
 * `a` controls the base (a > 1 pinches it), `b` the tip (b < 1 is blunt, b > 1 pointed).
 */
export function profile(t: number, a: number, b: number): number {
  if (t <= 0 || t >= 1) return 0;
  const ts = a / (a + b);
  return Math.pow(t / ts, a) * Math.pow((1 - t) / (1 - ts), b);
}

export interface BladeOpts {
  /** Length from base (origin) to tip, along -y. */
  length: number;
  /** Maximum half-width. */
  width: number;
  /** Profile exponents, see `profile`. */
  a: number;
  b: number;
  /** Right side is (1 + asym) wider, left side (1 - asym). */
  asym?: number;
  /** Quadratic sideways bend as a fraction of length (+ bends right). */
  bend?: number;
  /** S-curve amplitude as a fraction of length. */
  sCurve?: number;
  /** Fractional wobble of the edge. */
  wobble?: number;
  /** Lobed edge: number of lobes per side and how deep the gaps are (0..1). */
  lobes?: number;
  lobeDepth?: number;
  sharpTip?: boolean;
  /** Keep the base point sharp (default true, like a petal claw or leaf stalk). */
  sharpBase?: boolean;
  /** Samples per side. */
  samples?: number;
}

export function bladeCenterX(o: BladeOpts, t: number): number {
  return (o.bend ?? 0) * o.length * t * t + (o.sCurve ?? 0) * o.length * Math.sin(2 * Math.PI * t);
}

/** Half-width of a blade at t on one side (+1 right, -1 left). */
export function bladeHalfWidth(o: BladeOpts, noise: Noise, t: number, side: 1 | -1): number {
  let w = o.width * profile(t, o.a, o.b);
  if (o.lobes) {
    w *= 1 - (o.lobeDepth ?? 0.3) * (0.5 + 0.5 * Math.cos(2 * Math.PI * o.lobes * t));
  }
  const wob = 1 + (o.wobble ?? 0) * noise(t + (side > 0 ? 0 : 0.37));
  return w * wob * (1 + side * (o.asym ?? 0));
}

/** Outline points of a blade (petal or leaf). Returns points plus which ones are sharp. */
export function bladePts(o: BladeOpts, noise: Noise): { pts: Pt[]; corners: number[] } {
  const n = o.samples ?? 16;
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let k = 1; k < n; k++) {
    const t = (1 - Math.cos((Math.PI * k) / n)) / 2;
    const y = -o.length * t;
    const cx = bladeCenterX(o, t);
    right.push([cx + bladeHalfWidth(o, noise, t, 1), y]);
    left.push([cx - bladeHalfWidth(o, noise, t, -1), y]);
  }
  const base: Pt = [0, 0];
  const tip: Pt = [bladeCenterX(o, 1), -o.length];
  const pts = [base, ...right, tip, ...left.reverse()];
  const corners: number[] = [];
  if (o.sharpBase !== false) corners.push(0);
  if (o.sharpTip) corners.push(n);
  return { pts, corners };
}

/**
 * A thin shape that follows a blade's own profile, lying safely inside it.
 * `offset` places its centre at that fraction of the half-width; `width` is its own
 * half-width as a fraction; `from`/`to` bound it along the blade.
 */
export function bladeStreakPts(
  o: BladeOpts,
  noise: Noise,
  s: { side: 1 | -1; offset: number; width: number; from: number; to: number },
): { pts: Pt[]; corners: number[] } {
  const n = 12;
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const t = s.from + (s.to - s.from) * u;
    const w = bladeHalfWidth(o, noise, t, s.side);
    const cx = bladeCenterX(o, t) + s.side * w * s.offset;
    const hw = w * s.width * Math.pow(Math.sin(Math.PI * u), 0.7);
    const y = -o.length * t;
    right.push([cx + hw, y]);
    left.push([cx - hw, y]);
  }
  const pts = [...right, ...left.slice(1, n).reverse()];
  return { pts, corners: [0, n] };
}

/**
 * A tapered ribbon along a centre line: the filled outline of a stroke whose width
 * goes from w0 at the start to w1 at the end. Used for stems, stalks and tendrils.
 */
export function taperPts(line: readonly Pt[], w0: number, w1: number): { pts: Pt[]; corners: number[] } {
  const n = line.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, n - 1))) / 2;
    left.push([line[i][0] + dy * w, line[i][1] - dx * w]);
    right.push([line[i][0] - dy * w, line[i][1] + dx * w]);
  }
  return { pts: [...left, ...right.reverse()], corners: [] };
}

/** Points along a quadratic-ish curve through control points (Catmull-Rom sampled). */
export function sampleCurve(ctrl: readonly Pt[], perSegment = 6): Pt[] {
  if (ctrl.length < 2) return [...ctrl];
  const out: Pt[] = [];
  const n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(ctrl[n - 1]);
  return out;
}
