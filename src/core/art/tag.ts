/**
 * The gift tag that hangs from the ribbon in the shareable picture: the names, the
 * bouquet's code, and a QR code that opens the decode page. It lives in the taller
 * "share" frame, below the card, so it never covers a flower.
 */
import { formatCode } from "../code";
import { qrShape } from "../qr";
import { shade, type Tone } from "./color";
import { closedPath, compose, rotate, sampleCurve, translate, apply, type Mat, type Pt } from "./geom";
import { dot, paintOutline, strokeShape } from "./paint";
import { ACCENT, PAPER } from "./palette";
import type { Label, Shape } from "./types";

/** The shareable picture: the 600×900 card frame plus room for the tag below. */
export const SHARE_FRAME = { w: 600, h: 1100 } as const;

export interface TagOptions {
  /** Link the QR code opens (omit to leave the QR off, e.g. before the link exists). */
  url?: string;
  code?: string;
  toName?: string | null;
  fromName?: string | null;
}

const TAG_CENTER: Pt = [318, 980];
const TAG_TILT = -3;
const W = 360;
const H = 190;

const TAG_PAPER: Tone = { base: "#FFF7E6", light: "#FFFDF6", dark: "#E6D3B0" };

export function tagMatrix(): Mat {
  return compose(translate(TAG_CENTER[0], TAG_CENTER[1]), rotate(TAG_TILT));
}

/** Where the string meets the tag, in frame coordinates. */
export function tagHole(): Pt {
  return apply(tagMatrix(), [-W / 2 + 26, 0]);
}

function fitSize(text: string, max: number, room: number, perChar: number): number {
  return Math.max(12, Math.min(max, room / Math.max(1, text.length * perChar)));
}

/** The tag itself, in tag-local coordinates (centre at the origin). */
export function tagParts(opts: TagOptions): { shapes: Shape[]; labels: Label[] } {
  const x0 = -W / 2;
  const x1 = W / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  const outline: Pt[] = [
    [x0 + 30, y0],
    [x1 - 10, y0],
    [x1, y0 + 10],
    [x1, y1 - 10],
    [x1 - 10, y1],
    [x0 + 30, y1],
    [x0, y1 - 34],
    [x0, y0 + 34],
  ];
  const shapes: Shape[] = [
    // soft shadow on the slate
    { d: closedPath(outline.map(([x, y]) => [x + 3, y + 5] as Pt), outline.map((_, i) => i)), fill: "#1E2A31", opacity: 0.35 },
    ...paintOutline(outline, outline.map((_, i) => i), TAG_PAPER, undefined, { inset: 0.965, rim: 0.06, highlight: 0 }),
  ];
  // eyelet
  const hole: Pt = [x0 + 26, 0];
  shapes.push(dot(hole, 12, shade(ACCENT.ribbon.base, -0.05)), dot(hole, 9.5, ACCENT.ribbon.light), dot(hole, 6, PAPER.slate));

  const labels: Label[] = [];
  // text sits between the eyelet and the QR code (about 136 units of room)
  const textX = opts.url ? -70 : 14;
  const room = opts.url ? 132 : 280;
  const to = opts.toName ? `For ${opts.toName}` : "For you";
  labels.push({ text: to, x: textX, y: -32, size: fitSize(to, 32, room, 0.5), font: "hand", color: "#3A3833", anchor: "middle" });
  if (opts.fromName) {
    const from = `from ${opts.fromName}`;
    labels.push({ text: from, x: textX, y: 0, size: fitSize(from, 24, room, 0.5), font: "hand", color: "#5B564C", anchor: "middle" });
  }
  if (opts.url) {
    labels.push({ text: "scan to read", x: textX, y: 36, size: 13, font: "serif", color: "#6B6251", anchor: "middle" });
    if (opts.code) labels.push({ text: formatCode(opts.code), x: textX, y: 60, size: 14, font: "serif", color: "#3A3833", anchor: "middle", weight: 600, letterSpacing: 1 });
    const size = 150;
    const qx = x1 - 20 - size;
    const qy = -size / 2;
    shapes.push({ d: `M${qx - 8} ${qy - 8}h${size + 16}v${size + 16}h${-size - 16}Z`, fill: "#FFFFFF" });
    shapes.push(qrShape(opts.url, qx, qy, size, "#26333D").shape);
  } else if (opts.code) {
    labels.push({ text: formatCode(opts.code), x: textX, y: 46, size: 15, font: "serif", color: "#3A3833", anchor: "middle", weight: 600, letterSpacing: 1.5 });
  }
  return { shapes, labels };
}

/** The string from the ribbon knot down to the tag's eyelet, in frame coordinates. */
export function tagStringShape(knot: Pt): Shape {
  const hole = tagHole();
  const line = sampleCurve(
    [
      knot,
      [knot[0] - 26, knot[1] + 70],
      [hole[0] + 30, hole[1] - 70],
      hole,
    ],
    8,
  );
  return strokeShape(line, 2.4, 2.1, ACCENT.ribbon.dark);
}
