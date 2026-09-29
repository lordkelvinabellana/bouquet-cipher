/**
 * A seal's style, chosen by the account that sends it: the colour of the wax and the
 * emblem pressed into it (a preset, or one or two initials). Everything is drawn as
 * shapes, so the live view, the saved picture and the link preview all match.
 *
 * Stored as a short string, e.g. "gold/heart" or "navy/i:KA".
 */
import type { Tone } from "./color";
import { closedPath, type Pt } from "./geom";
import { dot, strokeShape } from "./paint";
import type { Shape } from "./types";

export const WAXES = {
  red: { name: "Red", tone: { base: "#A73E36", light: "#CC6456", dark: "#842C27" } },
  rose: { name: "Rose", tone: { base: "#C45B74", light: "#DD8499", dark: "#9E4059" } },
  gold: { name: "Gold", tone: { base: "#C29A3A", light: "#DDBE67", dark: "#9A7626" } },
  forest: { name: "Forest", tone: { base: "#4F7A4B", light: "#739F6C", dark: "#3A5C37" } },
  navy: { name: "Navy", tone: { base: "#2F4C6B", light: "#4F6E8F", dark: "#213750" } },
  plum: { name: "Plum", tone: { base: "#7A4A78", light: "#9C6C99", dark: "#5B3459" } },
} as const satisfies Record<string, { name: string; tone: Tone }>;
export type Wax = keyof typeof WAXES;

export const EMBLEMS = {
  rosette: "Rosette",
  heart: "Heart",
  star: "Star",
  moon: "Moon",
  leaf: "Leaf",
  flower: "Flower",
} as const;
export type Emblem = keyof typeof EMBLEMS;

export interface SealStyle {
  wax: Wax;
  /** A preset emblem, or initials (one or two capital letters). */
  mark: Emblem | { initials: string };
}

const STYLE = new RegExp(`^(${Object.keys(WAXES).join("|")})/(${Object.keys(EMBLEMS).join("|")}|i:[A-Z]{1,2})$`);

export function parseSealStyle(s: string | null | undefined): SealStyle | null {
  const m = s ? STYLE.exec(s) : null;
  if (!m) return null;
  const mark = m[2].startsWith("i:") ? { initials: m[2].slice(2) } : (m[2] as Emblem);
  return { wax: m[1] as Wax, mark };
}

export function sealStyleString(style: SealStyle): string {
  return `${style.wax}/${typeof style.mark === "string" ? style.mark : `i:${style.mark.initials}`}`;
}

/** Initials as typed: letters only, capitals, at most two. */
export function cleanInitials(s: string): string {
  return s.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
}

// ——— emblems, drawn about (0,0) within a radius of about 6 ———

const around = (n: number, r: (a: number, i: number) => number, spin = -Math.PI / 2): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = spin + (i / n) * Math.PI * 2;
    const rr = r(a, i);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });

function emblemOutline(e: Exclude<Emblem, "rosette" | "flower">): Pt[] {
  switch (e) {
    case "heart":
      return Array.from({ length: 36 }, (_, i) => {
        const t = (i / 36) * Math.PI * 2;
        return [0.36 * 16 * Math.sin(t) ** 3, -0.36 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 0.6];
      });
    case "star":
      return around(10, (_, i) => (i % 2 === 0 ? 6.2 : 2.6));
    case "moon": {
      // a crescent opening to the right: the outer circle's left side, then back along
      // a second circle through the same two tips
      const R = 5.8;
      const tip = (70 * Math.PI) / 180;
      const [tx, ty] = [R * Math.cos(tip), R * Math.sin(tip)];
      const cx = 2.6;
      const r = Math.hypot(tx - cx, ty);
      const a0 = Math.atan2(ty, tx - cx);
      const outer = Array.from({ length: 19 }, (_, i) => {
        const a = tip + ((2 * Math.PI - 2 * tip) * i) / 18;
        return [R * Math.cos(a), R * Math.sin(a)] as Pt;
      });
      const inner = Array.from({ length: 17 }, (_, i) => {
        const a = 2 * Math.PI - a0 - ((2 * Math.PI - 2 * a0) * i) / 16;
        return [cx + r * Math.cos(a), r * Math.sin(a)] as Pt;
      }).slice(1, -1);
      return [...outer, ...inner];
    }
    case "leaf": {
      // pointed at both ends, leaning a little
      const side = (sign: 1 | -1) =>
        Array.from({ length: 13 }, (_, i) => {
          const y = -6 + i;
          return [sign * 3.2 * (1 - (y / 6) ** 2), y] as Pt;
        });
      const right = side(1);
      const left = side(-1).reverse().slice(1, -1);
      const lean = (22 * Math.PI) / 180;
      return [...right, ...left].map(([x, y]) => [x * Math.cos(lean) - y * Math.sin(lean), x * Math.sin(lean) + y * Math.cos(lean)] as Pt);
    }
  }
}

/** A stroke alphabet on a 4×6 grid, for initials that look engraved in any renderer. */
const LETTERS: Record<string, Pt[][]> = {
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 4], [3, 4]]],
  B: [[[0, 6], [0, 0], [3, 0], [4, 1], [3, 3], [0, 3]], [[3, 3], [4, 4.5], [3, 6], [0, 6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.5], [2.5, 3.5]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.5]], [[1.3, 2.6], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[2.5, 4.5], [4, 6]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 3], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
};

function initialsStrokes(initials: string): Pt[][] {
  const letters = [...initials].filter((c) => LETTERS[c]);
  const gap = 1.6;
  const width = letters.length * 4 + (letters.length - 1) * gap;
  const s = Math.min(7 / 6, 10.4 / width);
  const x0 = (-width * s) / 2;
  return letters.flatMap((c, i) =>
    LETTERS[c].map((line) => line.map(([x, y]) => [x0 + (x + i * (4 + gap)) * s, (y - 3) * s] as Pt)),
  );
}

/**
 * The emblem pressed into a seal centred on `c`, scaled by `k`: a darker impression with
 * a lighter edge, as if it had been stamped. Returns null for the rosette, which the seal
 * draws itself (it's the classic, per-signature pattern).
 */
export function emblemShapes(style: SealStyle, c: Pt, k: number): Shape[] | null {
  const tone = WAXES[style.wax].tone;
  const at = (p: Pt, dx = 0, dy = 0): Pt => [c[0] + (p[0] + dx) * k, c[1] + (p[1] + dy) * k];
  if (typeof style.mark !== "string") {
    // each stroke as straight segments with round joints, so sharp corners stay solid
    const segments = initialsStrokes(style.mark.initials).flatMap((l) => l.slice(1).map((q, i) => [l[i], q] as Pt[]));
    const joints = segments.flatMap((sg) => sg);
    const w = 1.05 * k;
    const layer = (dx: number, dy: number, fill: string, opacity?: number): Shape[] => [
      ...segments.map((sg) => strokeShape(sg.map((q) => at(q, dx, dy)), w, w, fill, undefined, opacity)),
      ...joints.map((q) => dot(at(q, dx, dy), w / 2, fill, opacity)),
    ];
    return [...layer(0.25, 0.3, tone.light, 0.8), ...layer(0, 0, tone.dark)];
  }
  if (style.mark === "rosette") return null;
  if (style.mark === "flower") {
    const petals = around(6, () => 3.3);
    return [
      ...petals.map((p) => dot(at(p, 0.25, 0.3), 2.1 * k, tone.light, 0.7)),
      ...petals.map((p) => dot(at(p), 2.1 * k, tone.dark)),
      dot(at([0, 0]), 1.6 * k, tone.light),
    ];
  }
  const outline = emblemOutline(style.mark);
  const sharp =
    style.mark === "star" ? outline.map((_, i) => i) : style.mark === "moon" ? [0, 18] : style.mark === "leaf" ? [0, 12] : [];
  const shapes: Shape[] = [
    { d: closedPath(outline.map((p) => at(p, 0.3, 0.35)), sharp), fill: tone.light, opacity: 0.75 },
    { d: closedPath(outline.map((p) => at(p)), sharp), fill: tone.dark },
  ];
  if (style.mark === "leaf") {
    // the vein, catching the light
    const [top, bottom] = [outline[0], outline[12]];
    shapes.push(strokeShape([top, [0, 0], bottom].map((q) => at([q[0] * 0.8, q[1] * 0.8])), 0.45 * k, 0.3 * k, tone.light, undefined, 0.8));
  }
  return shapes;
}
