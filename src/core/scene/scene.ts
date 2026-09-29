/**
 * Scene: the bouquet placed on the card, as an ordered draw list.
 *
 * One draw list feeds every renderer (live SVG, canvas PNG export, server preview
 * image), so what you see is exactly what gets saved and shared.
 */
import { apply, compose, rotate, scale as scaleM, translate, IDENTITY, type Mat, type Pt } from "../art/geom";
import { GREEN, PAPER } from "../art/palette";
import { CARD, cardShape, FRAME, ribbonShapes, sealShapes, stitchShapes } from "../art/scenery";
import { paintBlade, strokeShape } from "../art/paint";
import { SHARE_FRAME, tagMatrix, tagParts, tagStringShape, type TagOptions } from "../art/tag";
import type { Label, Shape } from "../art/types";
import { parseSealStyle } from "../art/seal";
import { wrapParts } from "../art/wrap";
import { gatherBouquet } from "../layout/v1/gather";
import type { BouquetLayout, PlacedElement, PlacedStem } from "../layout/v1/layout";
import { makeRng } from "../rng";

/** Where the ribbon ties the stems, on the 600×900 frame, near the bottom of the card. */
export const TIE: Pt = [300, 792];

/** Cut stem ends below the ribbon, in frame units (shortest and longest). */
const CUT_MIN = 36;
const CUT_MAX = 50;

/**
 * The bouquet may spill past the oval card (like the reference), so it can grow as big
 * as the picture allows. It only has to stay this far inside the picture's edges.
 */
export const FRAME_MARGIN = 12;

/** A cap so a three-word posy doesn't become a single giant flower. */
export const MAX_ZOOM = 1.8;

/** Element circles are approximate; pad them so leaf tips and petals stay inside too. */
const FIT_PAD = 1.12;

function inFrame(x: number, y: number, r: number): boolean {
  return x - r >= FRAME_MARGIN && x + r <= FRAME.w - FRAME_MARGIN && y - r >= FRAME_MARGIN;
}

/** Does every flower, leaf and stem stay inside the picture with this camera? */
export function fitsCamera(layout: BouquetLayout, cam: Camera): boolean {
  const m = cameraMatrix(cam);
  for (const e of layout.elements) {
    const [x, y] = apply(m, [e.hit.x, e.hit.y]);
    if (!inFrame(x, y, cam.zoom * e.hit.r * FIT_PAD)) return false;
  }
  for (const st of layout.stems) {
    for (const p of st.line) {
      const [x, y] = apply(m, p);
      if (!inFrame(x, y, 2)) return false;
    }
  }
  return true;
}

/**
 * The largest zoom (up to MAX_ZOOM) at which every flower, leaf and stem stays inside
 * the picture, anchored at the tie and turned by `angle`. The allowed area is convex and
 * contains the tie, so "fits" flips only once as zoom grows: a binary search finds it.
 */
export function fitZoom(layout: BouquetLayout, angle = 0): number {
  const fits = (zoom: number) => fitsCamera(layout, { zoom, x: TIE[0], y: TIE[1], angle });
  if (fits(MAX_ZOOM)) return MAX_ZOOM;
  let lo = 0.2;
  let hi = MAX_ZOOM;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  // round down, so the rounded zoom still fits
  return Math.floor(lo * 1000) / 1000;
}

/**
 * Where a bouquet is placed on the frame: how big, where its tie (the ribbon) lands, and
 * how far it's turned (degrees) so it stands upright.
 */
export interface Camera {
  zoom: number;
  x: number;
  y: number;
  angle: number;
}

export function cameraMatrix(c: Camera): Mat {
  return compose(translate(c.x, c.y), rotate(c.angle), scaleM(c.zoom));
}

/** The growing placement at a given zoom (kept for callers that only know a zoom). */
export function cameraFor(zoom: number): Mat {
  return cameraMatrix({ zoom, x: TIE[0], y: TIE[1], angle: 0 });
}

/** The most a bouquet is ever turned to stand upright. */
export const MAX_LEAN = 12;

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * How far to turn the bouquet about its tie (degrees) so the flowers' centre of mass sits
 * right above the ribbon, the way a well-made bunch stands up in the hand.
 */
export function balanceAngle(layout: BouquetLayout): number {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  for (const e of layout.elements) {
    const w = e.hit.r * e.hit.r;
    sw += w;
    sx += w * e.hit.x;
    sy += w * e.hit.y;
  }
  const lean = sw > 0 && sy < 0 ? (Math.atan2(sx / sw, -sy / sw) * 180) / Math.PI : 0;
  return round(Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -lean)), 2);
}

/** While writing: the bouquet grows up from a fixed tie near the bottom of the card, balanced over it. */
export function growingCamera(layout: BouquetLayout): Camera {
  const angle = balanceAngle(layout);
  return { zoom: fitZoom(layout, angle), x: TIE[0], y: TIE[1], angle };
}

/** The middle of the oval card. */
export const CARD_CENTER: Pt = [CARD.x + CARD.w / 2, CARD.y + CARD.h / 2];

/** Room the ribbon, paper skirt and cut stems take below the tie, in frame units. */
const BELOW_TIE = 56;

/**
 * Wrapped: the whole bouquet (flowers, paper and ribbon) as big as the picture allows,
 * centred on the middle of the oval card, both across and up and down.
 */
export function presentedCamera(layout: BouquetLayout): Camera {
  // 1. Stand it upright: turn so the flowers' centre of mass sits right above the ribbon.
  const angle = balanceAngle(layout);
  const turn = rotate(angle);

  // 2. Measure everything as it will stand.
  let minX = -30;
  let maxX = 30;
  let minY = -60;
  const grow = (p: Pt, r: number) => {
    const [x, y] = apply(turn, p);
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
  };
  for (const e of layout.elements) grow([e.hit.x, e.hit.y], e.hit.r * FIT_PAD);
  for (const st of layout.stems) for (const p of st.line) grow(p, 2);

  // 3. As big as fits, centred on the oval.
  const up = -minY;
  const zoom = Math.min(MAX_ZOOM, (FRAME.w - 2 * FRAME_MARGIN) / (maxX - minX), (FRAME.h - 2 * FRAME_MARGIN - BELOW_TIE) / up);
  const height = zoom * up + BELOW_TIE;
  return {
    zoom: round(zoom, 3),
    x: round(CARD_CENTER[0] - (zoom * (minX + maxX)) / 2, 2),
    y: round(CARD_CENTER[1] - height / 2 + zoom * up, 2),
    angle: round(angle, 2),
  };
}

export interface DrawGroup {
  key?: string;
  m: Mat;
  shapes: readonly Shape[];
  labels?: readonly Label[];
}

const stemWidth = (zoom: number) => 1 / Math.sqrt(Math.max(0.6, zoom));

/**
 * The cut end below the ribbon, sized in frame units so it looks the same at any zoom.
 * Each stem keeps its own length (from the layout) for a natural, uneven cut.
 */
function cutLine(st: PlacedStem, zoom: number): Pt[] {
  const [, end] = st.cut;
  const len = Math.hypot(end[0], end[1]) || 1;
  const t = Math.min(1, Math.max(0, (len - 62) / 34));
  const k = (CUT_MIN + (CUT_MAX - CUT_MIN) * t) / zoom / len;
  return [
    [0, 0],
    [end[0] * k, end[1] * k],
  ];
}

/** One stem: its cut end, its line and its bloom stalks, in bouquet space. */
export function stemShapesFor(st: PlacedStem, zoom: number): Shape[] {
  const w = stemWidth(zoom);
  return [
    strokeShape(cutLine(st, zoom), 3.1 * w, 2.7 * w, PAPER.ink),
    strokeShape(st.line, 3.1 * w, 1.25 * w, PAPER.ink),
    ...st.pedicels.map((p) => strokeShape(p, 1.7 * w, 1.15 * w, PAPER.ink)),
  ];
}

/** The sprout that shows where the next stem will grow, while typing after a space. */
export function sproutShapes(sprout: NonNullable<BouquetLayout["sprout"]>, zoom: number): Shape[] {
  const w = stemWidth(zoom);
  const deg = (sprout.dir * 180) / Math.PI;
  const leaf = paintBlade(
    { length: 11, width: 3.6, a: 0.9, b: 1.2, sharpTip: true, samples: 8 },
    makeRng(3),
    { tone: GREEN, rim: 0.1 },
    compose(translate(sprout.tip[0], sprout.tip[1]), rotate(deg + 18)),
  );
  return [strokeShape(sprout.line, 2.6 * w, 1.3 * w, PAPER.ink, undefined, 0.6), ...leaf];
}

/** Stems, pedicels and cut ends, in bouquet space. Widths shrink a little as the view zooms in. */
export function stemShapes(layout: BouquetLayout, zoom: number): Shape[] {
  const shapes = layout.stems.flatMap((st) => stemShapesFor(st, zoom));
  if (layout.sprout) shapes.push(...sproutShapes(layout.sprout, zoom));
  return shapes;
}

/** Leaves and marks first, then blooms on top, each in reading order. */
export function drawOrder(elements: readonly PlacedElement[]): PlacedElement[] {
  return [...elements.filter((e) => e.kind !== "bloom"), ...elements.filter((e) => e.kind === "bloom")];
}

export interface SceneOptions {
  zoom?: number;
  /** Seed for the ribbon's wobble. */
  ribbonSeed?: number;
  /** Signature for the wax seal; omit to leave the seal off (e.g. while composing). */
  seal?: number;
  /** The sender's chosen wax colour and emblem ("gold/heart"), if any. */
  sealStyle?: string | null;
  /** Wrap the bouquet in this paper (see art/wrap.ts); omit for an unwrapped bouquet. */
  paper?: number | null;
  /** Add the gift tag below the card: the picture becomes the taller share frame. */
  tag?: TagOptions | null;
  /** Centre the bouquet in the oval (defaults to on whenever it's wrapped). */
  present?: boolean;
}

/** The slate background (optional: the live view lets the page's own background show) and the card. */
export function backdropGroups(withSlate = true, height: number = FRAME.h): DrawGroup[] {
  const groups: DrawGroup[] = [{ m: IDENTITY, shapes: [cardShape(), ...stitchShapes()] }];
  if (withSlate) groups.unshift({ m: IDENTITY, shapes: [{ d: `M0 0H${FRAME.w}V${height}H0Z`, fill: PAPER.slate }] });
  return groups;
}

/** The ribbon (and its seal) are drawn a size up, to hold the bigger flowers. */
export const RIBBON_SCALE = 1.25;

/** The wax seal on the knot, relative to its base size. */
export const SEAL_SCALE = 1.6;

const GROWING: Camera = { zoom: 1, x: TIE[0], y: TIE[1], angle: 0 };

/**
 * The ribbon's artwork is drawn around TIE; this moves it to wherever the camera puts the
 * tie, at a fixed size (it doesn't grow and shrink with the flowers).
 */
function ribbonMatrix(cam: Camera): Mat {
  return compose(translate(cam.x, cam.y), scaleM(RIBBON_SCALE), translate(-TIE[0], -TIE[1]));
}

/** Where the ribbon's knot is, in frame coordinates (the gift tag's string starts here). */
export function knotOf(cam: Camera): Pt {
  return [cam.x, cam.y + RIBBON_SCALE];
}

export const KNOT: Pt = knotOf(GROWING);

export function ribbonGroups(opts: SceneOptions, cam: Camera = GROWING): DrawGroup[] {
  const m = ribbonMatrix(cam);
  const groups: DrawGroup[] = [{ key: "ribbon", m, shapes: ribbonShapes(TIE, opts.ribbonSeed ?? 7) }];
  // drawn large enough to read as a seal, not a knot
  if (opts.seal !== undefined) groups.push({ key: "seal", m, shapes: sealShapes([TIE[0], TIE[1] + 1], opts.seal, SEAL_SCALE, parseSealStyle(opts.sealStyle)) });
  return groups;
}

/** The wrapping paper's layers, in bouquet space (use the camera matrix). */
export function wrapGroups(layout: BouquetLayout, paper: number, zoom: number, seed: number) {
  const w = wrapParts(layout, paper, zoom, seed);
  return { back: w.back, frontLeft: w.frontLeft, frontRight: w.frontRight };
}

/** The gift tag and its string, in frame coordinates of the share frame. */
export function tagGroups(tag: TagOptions, knot: Pt = KNOT): DrawGroup[] {
  const { shapes, labels } = tagParts(tag);
  return [
    { key: "tag", m: tagMatrix(), shapes, labels },
    { key: "tag-string", m: IDENTITY, shapes: [tagStringShape(knot)] },
  ];
}

export function frameHeight(opts: SceneOptions): number {
  return opts.tag ? SHARE_FRAME.h : FRAME.h;
}

/**
 * The complete picture as a flat list of groups in frame space. Takes the open layout;
 * a wrapped bouquet is gathered into its bunch first.
 */
export function sceneGroups(open: BouquetLayout, opts: SceneOptions = {}): DrawGroup[] {
  const layout = opts.paper != null ? gatherBouquet(open) : open;
  const present = opts.present ?? opts.paper != null;
  const growing = present ? null : growingCamera(layout);
  const camera = growing ? { ...growing, zoom: opts.zoom ?? growing.zoom } : presentedCamera(layout);
  const zoom = camera.zoom;
  const cam = cameraMatrix(camera);
  const wrap = opts.paper != null ? wrapGroups(layout, opts.paper, zoom, (opts.ribbonSeed ?? 7) + 101) : null;
  return [
    ...backdropGroups(true, frameHeight(opts)),
    ...(wrap ? [{ key: "wrap-back", m: cam, shapes: wrap.back }] : []),
    { key: "stems", m: cam, shapes: stemShapes(layout, zoom) },
    ...(wrap
      ? [
          { key: "wrap-front-left", m: cam, shapes: wrap.frontLeft },
          { key: "wrap-front-right", m: cam, shapes: wrap.frontRight },
        ]
      : []),
    ...drawOrder(layout.elements).map((e) => ({ key: e.key, m: compose(cam, e.m), shapes: e.art.shapes })),
    ...ribbonGroups(opts, camera),
    ...(opts.tag ? tagGroups(opts.tag, knotOf(camera)) : []),
  ];
}

export { FRAME, SHARE_FRAME };
