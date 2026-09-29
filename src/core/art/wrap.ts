/**
 * Florist paper around the bouquet: a tall back sheet that frames the flowers and two
 * front sheets folded across the stems. Drawn in bouquet space (origin at the tie) and
 * sized from the layout itself, so it fits every bouquet.
 *
 * The front sheets go in front of the stems but *behind* the flowers and leaves, so the
 * wrap never hides a letter of the message.
 */
import type { BouquetLayout } from "../layout/v1/layout";
import { makeRng } from "../rng";
import { shade, type Tone } from "./color";
import { closedPath, type Pt } from "./geom";
import type { Shape } from "./types";

export const PAPERS: ReadonlyArray<{ name: string; tone: Tone }> = [
  { name: "Kraft", tone: { base: "#D6B48A", light: "#E7CEAA", dark: "#B9966B" } },
  { name: "Blush", tone: { base: "#EFC4BE", light: "#F7DCD8", dark: "#D9A39C" } },
  { name: "Sage", tone: { base: "#B6CCAB", light: "#CFE0C6", dark: "#95AE8A" } },
  { name: "Midnight", tone: { base: "#3A5063", light: "#50687C", dark: "#2A3B4A" } },
];

export const PAPER_COUNT = PAPERS.length;

export interface WrapParts {
  back: Shape[];
  frontLeft: Shape[];
  frontRight: Shape[];
}

/** Half-width of the ribbon band at the tie, in frame units (see scene RIBBON_SCALE). */
const NECK_FRAME = 20;
/** How far the paper skirt reaches below the ribbon, in frame units. */
const SKIRT_FRAME = 38;

function extent(layout: BouquetLayout) {
  let top = -80;
  let left = -40;
  let right = 40;
  for (const e of layout.elements) {
    top = Math.min(top, e.hit.y - e.hit.r);
    left = Math.min(left, e.hit.x - e.hit.r);
    right = Math.max(right, e.hit.x + e.hit.r);
  }
  return { H: -top, L: -left, R: right };
}

function sheet(pts: Pt[], corners: number[], fill: string, opacity?: number): Shape {
  return { d: closedPath(pts, corners), fill, opacity };
}

export function wrapParts(layout: BouquetLayout, paper: number, zoom: number, seed: number): WrapParts {
  const tone = PAPERS[paper]?.tone ?? PAPERS[0].tone;
  const rng = makeRng(seed);
  const { H, L, R } = extent(layout);
  const neck = NECK_FRAME / zoom;
  const D = SKIRT_FRAME / zoom;
  const j = (v: number) => v * rng.range(0.96, 1.04);

  // Back sheet: flares from the ribbon up behind the flowers, its tips peeking out.
  const tl: Pt = [-j(0.9) * L, -j(0.72) * H];
  const tr: Pt = [j(0.9) * R, -j(0.7) * H];
  const backPts: Pt[] = [
    [-neck * 1.35, D],
    [-neck, 0],
    [-0.4 * L, -0.3 * H],
    tl,
    [-0.42 * L, -0.6 * H],
    [0.42 * R, -0.6 * H],
    tr,
    [0.4 * R, -0.3 * H],
    [neck, 0],
    [neck * 1.35, D],
  ];
  const backCorners = [0, 3, 6, 9];
  const back: Shape[] = [
    sheet(backPts, backCorners, shade(tone.dark, -0.04)),
    // the lit inside of the cone, and a soft centre fold
    sheet(
      [
        [-neck * 0.6, 0],
        [-0.3 * L, -0.28 * H],
        [tl[0] * 0.86, tl[1] * 0.92],
        [-0.34 * L, -0.56 * H],
        [0, -0.5 * H],
        [-neck * 0.1, -0.1 * H],
      ],
      [0, 2],
      tone.dark,
      0.9,
    ),
    sheet(
      [
        [0, -0.02 * H],
        [-0.06 * L, -0.3 * H],
        [0, -0.55 * H],
        [0.06 * R, -0.3 * H],
      ],
      [0, 2],
      shade(tone.dark, -0.12),
      0.35,
    ),
  ];

  // Two front sheets folded across the stems, up to where the heads begin, so the
  // flowers sit in the cone's mouth; the right one overlaps the left.
  const leftPts: Pt[] = [
    [-neck * 1.45, D + 2 / zoom],
    [-neck * 1.05, 0],
    [-0.55 * L, -j(0.4) * H],
    [0.12 * R, -j(0.24) * H],
    [neck * 0.55, -0.04 * H],
    [neck * 0.95, D + 2 / zoom],
  ];
  const rightPts: Pt[] = [
    [neck * 1.45, D + 2 / zoom],
    [neck * 1.05, 0],
    [0.58 * R, -j(0.43) * H],
    [-0.14 * L, -j(0.2) * H],
    [-neck * 0.55, -0.04 * H],
    [-neck * 0.95, D + 2 / zoom],
  ];
  const frontCorners = [0, 2, 3, 5];
  const foldLeft: Pt[] = [leftPts[2], leftPts[3], [leftPts[3][0] - 0.04 * L, leftPts[3][1] + 0.05 * H], [leftPts[2][0] + 0.05 * L, leftPts[2][1] + 0.04 * H]];
  const foldRight: Pt[] = [rightPts[2], rightPts[3], [rightPts[3][0] + 0.04 * R, rightPts[3][1] + 0.05 * H], [rightPts[2][0] - 0.05 * R, rightPts[2][1] + 0.04 * H]];
  const frontLeft: Shape[] = [
    sheet(leftPts, frontCorners, shade(tone.base, -0.05)),
    sheet(foldLeft, [0, 1], tone.light, 0.85),
  ];
  const frontRight: Shape[] = [
    // a soft shadow where it overlaps the left sheet
    sheet(
      rightPts.map(([x, y]) => [x - 3 / zoom, y + 2 / zoom] as Pt),
      frontCorners,
      shade(tone.dark, -0.2),
      0.25,
    ),
    sheet(rightPts, frontCorners, tone.base),
    sheet(foldRight, [0, 1], tone.light, 0.85),
  ];
  return { back, frontLeft, frontRight };
}
