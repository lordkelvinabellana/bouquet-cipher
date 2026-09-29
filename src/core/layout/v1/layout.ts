/**
 * Layout v1: where every stem and element goes.
 *
 * FROZEN once shipped (bouquets store alphabet_v, which pins this layout too).
 *
 * Space: origin at the ribbon tie, up is -y, units match the artwork.
 *
 * Balance: stems fan out evenly either side of upright, tier by tier (see `tierSwings`),
 * and the camera stands the whole bunch upright over the ribbon (scene.ts).
 *
 * Stability: an element's drawing and its place on its stem depend only on what comes
 * before it in reading order, so typing more never redraws anything already there. The
 * one thing that moves is a tier that's still filling: it turns about the tie by half a
 * step when a stem joins or leaves it, which keeps its fan even (the live view glides
 * it). The recipient's bouquet is identical to the one the sender watched grow.
 */
import type { Glyph } from "../../alphabet/v1";
import { drawGlyph } from "../../art";
import { PALETTES } from "../../art/palette";
import { apply, compose, rotate, scale, translate, type Mat, type Pt } from "../../art/geom";
import type { Art } from "../../art/types";
import { elementSeed, type Genome } from "../../genome/genome";
import { makeRng, mixSeed } from "../../rng";

// ——— slots ———

interface Ring {
  count: number;
  step: number;
  offset: number;
  stalk: number;
  size: number;
}

/**
 * Tiers of stem slots, filled in order: a tall centrepiece first, then a middle tier
 * in front of it, then a low tier near the ribbon, so even a short message fills the
 * bouquet from top to bottom instead of spreading sideways. Later tiers add height at
 * the back and fullness at the front; the last one repeats, lower each lap, for long
 * messages of short words. Within a tier, slots go from the centre outward, alternating
 * right and left, evenly spaced (`offset` is 0 or half a step), and every full tier is
 * symmetric. Leans stay within about 36°, so the bouquet is taller than it is wide and
 * sits inside the card's rounded bottom.
 */
const RINGS: readonly Ring[] = [
  { count: 3, step: 12, offset: 0, stalk: 128, size: 1.0 },
  { count: 4, step: 16, offset: 8, stalk: 90, size: 0.97 },
  { count: 5, step: 14, offset: 0, stalk: 54, size: 0.94 },
  { count: 6, step: 12, offset: 6, stalk: 150, size: 0.92 },
  { count: 7, step: 12, offset: 0, stalk: 36, size: 0.9 },
  { count: 15, step: 5, offset: 0, stalk: 110, size: 0.86 },
];

export interface Slot {
  ring: number;
  /** The fan this stem belongs to: a ring, or one lap of the last ring. */
  tier: number;
  /** Lean at the tie before its tier is balanced, degrees from vertical (+ is right). */
  angle: number;
  /** Half the tier's spacing: the most the tier ever turns to balance (degrees). */
  halfStep: number;
  /** Bare stalk length before the first letter. */
  stalk: number;
  /** Element scale for this ring (outer rings are a touch smaller, for depth). */
  size: number;
}

export function slotFor(k: number): Slot {
  let r = 0;
  let j = k;
  while (r < RINGS.length - 1 && j >= RINGS[r].count) {
    j -= RINGS[r].count;
    r++;
  }
  const ring = RINGS[r];
  const lap = Math.floor(j / ring.count);
  j %= ring.count;
  let angle: number;
  if (ring.offset === 0) {
    const idx = Math.ceil(j / 2);
    angle = j === 0 ? 0 : (j % 2 === 1 ? 1 : -1) * idx * ring.step;
  } else {
    const idx = Math.floor(j / 2);
    angle = (j % 2 === 0 ? 1 : -1) * (ring.offset + idx * ring.step);
  }
  // Stems get a little shorter toward the sides, giving the bouquet its dome.
  const stalk = Math.max(28, (ring.stalk - lap * 18) * (1 - 0.006 * Math.abs(angle)));
  return { ring: r, tier: r + lap, angle, halfStep: ring.step / 2, stalk, size: ring.size };
}

/**
 * How far each tier turns about the tie (degrees) so its stems spread evenly either side
 * of upright: minus the mean of their slot angles. A tier fills centre-out, right before
 * left, so this is always 0 or half a step to the left, and a full tier never turns.
 * `total` counts every stem, plus the sprout of one about to grow.
 */
export function tierSwings(total: number): Map<number, number> {
  const sums = new Map<number, { sum: number; n: number }>();
  for (let k = 0; k < total; k++) {
    const { tier, angle } = slotFor(k);
    const t = sums.get(tier) ?? { sum: 0, n: 0 };
    t.sum += angle;
    t.n++;
    sums.set(tier, t);
  }
  return new Map([...sums].map(([tier, t]) => [tier, t.sum === 0 ? 0 : -t.sum / t.n]));
}

// ——— stem curves ———

/** A stem is a constant-curvature arc: direction ψ(s) = θ + κ·s (radians from vertical). */
export interface StemCurve {
  theta: number;
  kappa: number;
}

export function curveAt(c: StemCurve, s: number): { p: Pt; dir: number } {
  const dir = c.theta + c.kappa * s;
  if (Math.abs(c.kappa) < 1e-7) return { p: [s * Math.sin(c.theta), -s * Math.cos(c.theta)], dir };
  return {
    p: [(Math.cos(c.theta) - Math.cos(dir)) / c.kappa, -(Math.sin(dir) - Math.sin(c.theta)) / c.kappa],
    dir,
  };
}

function sampleStem(c: StemCurve, from: number, to: number, step = 7): Pt[] {
  const pts: Pt[] = [];
  const n = Math.max(2, Math.ceil((to - from) / step));
  for (let i = 0; i <= n; i++) pts.push(curveAt(c, from + ((to - from) * i) / n).p);
  return pts;
}

// ——— elements ———

type Kind = "bloom" | "leaf" | "mark" | "thorn" | "axis";

function kindOf(glyph: Glyph): Kind {
  switch (glyph.t) {
    case "bloom":
    case "heart":
      return "bloom";
    case "leaf":
      return "leaf";
    case "mark":
      return glyph.mark === "knuckle" ? "axis" : glyph.mark === "thorn" ? "thorn" : "mark";
    default:
      return "mark";
  }
}

/** How large each kind is drawn relative to its artwork: flowers lead, foliage supports. */
const SCALE: Readonly<Record<Kind, number>> = { bloom: 1.5, leaf: 1.25, mark: 1.2, thorn: 1.2, axis: 1.2 };
/** Spacing each kind asks for along the stem. */
const EXT: Readonly<Record<Kind, number>> = { bloom: 31, leaf: 18, mark: 13, thorn: 8, axis: 8 };
/** Default angle away from the stem, degrees. */
const SPREAD: Readonly<Record<Kind, number>> = { bloom: 28, leaf: 42, mark: 34, thorn: 72, axis: 0 };
const PEDICEL = 17;
/**
 * Collisions use a smaller circle than the element's full size, so neighbours can
 * nestle and overlap a little, as flowers do in a real bouquet.
 */
export const NESTLE = 0.66;
/** Outward bend of a stem per unit length, per 60° of lean (radians). */
const BEND = 0.001;

export interface PlacedElement {
  /** Stable identity for animation: survives appends. */
  key: string;
  stem: number;
  node: number;
  g: string;
  glyph: Glyph;
  /** Position of the grapheme in the canonical text. */
  index: number;
  kind: Kind;
  art: Art;
  /** Local art space → bouquet space. */
  m: Mat;
  /** `m` before its stem's swing: never changes while the element stays. */
  local: Mat;
  /**
   * How far its stem is turned about the tie (degrees): to keep its tier's fan even, and
   * when wrapped, to gather the bunch (gather.ts).
   */
  swing: number;
  /** How far its stem is then moved (only when gathered: pulled down into the bunch). */
  shift: Pt;
  /** Where the element meets its stem (the reveal glow and grow animation start here). */
  anchor: Pt;
  /** Collision circle and visual centre, in bouquet space. */
  hit: { x: number; y: number; r: number };
  focus: Pt;
}

export interface PlacedStem {
  ordinal: number;
  /** The stem's shape before its swing (so it never changes while the stem stays). */
  curve: StemCurve;
  /** How far the stem is turned about the tie (degrees); see PlacedElement.swing. */
  swing: number;
  /** How far the stem is then moved; see PlacedElement.shift. */
  shift: Pt;
  /** Centre line from the tie to just past the last node. */
  line: Pt[];
  /** The cut end below the tie. */
  cut: Pt[];
  /** Side stalks carrying blooms. */
  pedicels: Pt[][];
  slot: Slot;
  /** Length along the stem up to its last node. */
  length: number;
  end: "space" | "newline" | "eof";
}

export interface BouquetLayout {
  stems: PlacedStem[];
  elements: PlacedElement[];
  /** Extent above the tie (bouquet space), cut ends excluded. */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Live typing after a space: where the next stem will sprout. */
  sprout?: { line: Pt[]; tip: Pt; dir: number };
}

interface Circle {
  x: number;
  y: number;
  r: number;
  bloom: boolean;
  tier: number;
}

function pairPenalty(c: Circle, q: Circle): number {
  const d = Math.hypot(c.x - q.x, c.y - q.y);
  const o = (c.r + q.r) * NESTLE - d;
  return o > 0 ? o * o * (c.bloom && q.bloom ? 1.7 : 1) : 0;
}

/**
 * How badly a circle (placed before any swing) would crowd what's already there. Its
 * tier may still end up turned by `alt` (radians; see tierSwings), so against earlier,
 * full tiers it's checked both ways and the worse counts. The choice then holds however
 * the message goes on, so it never has to change as more is typed.
 */
function overlapPenalty(c: Circle, placed: readonly Circle[], alt: number): number {
  const turned: Circle = { ...c, x: c.x * Math.cos(alt) - c.y * Math.sin(alt), y: c.x * Math.sin(alt) + c.y * Math.cos(alt) };
  let p = 0;
  for (const q of placed) p += q.tier === c.tier ? pairPenalty(c, q) : Math.max(pairPenalty(c, q), pairPenalty(turned, q));
  // keep things above the ribbon
  if (c.y > -34) p += (c.y + 34) ** 2 * 0.6;
  return p;
}

/** Round so tiny floating-point differences between engines can't flip a decision. */
const q64 = (n: number) => Math.round(n * 64) / 64;

interface Candidate {
  flip: boolean;
  dA: number;
  dPed: number;
  sc: number;
  cost: number;
}

const CANDIDATES: readonly Candidate[] = [
  { flip: false, dA: 0, dPed: 0, sc: 1, cost: 0 },
  { flip: true, dA: 0, dPed: 0, sc: 1, cost: 40 },
  { flip: false, dA: 14, dPed: 0, sc: 1, cost: 26 },
  { flip: false, dA: -14, dPed: 0, sc: 1, cost: 30 },
  { flip: false, dA: 0, dPed: 8, sc: 1, cost: 22 },
  { flip: true, dA: 14, dPed: 0, sc: 1, cost: 60 },
  { flip: false, dA: 0, dPed: 0, sc: 0.86, cost: 45 },
];

function placeElement(
  art: Art,
  kind: Kind,
  node: Pt,
  dir: number,
  side: 1 | -1,
  size: number,
  c: Candidate,
  tier: number,
): { m: Mat; anchor: Pt; pedicel?: Pt[]; circle: Circle; focus: Pt } {
  const s = side * (c.flip ? -1 : 1);
  const deg = (dir * 180) / Math.PI;
  const k = size * SCALE[kind] * c.sc;
  let m: Mat;
  let anchor: Pt = node;
  let pedicel: Pt[] | undefined;
  if (kind === "axis") {
    m = compose(translate(node[0], node[1]), rotate(deg), scale(k));
  } else if (kind === "bloom") {
    const pedDir = deg + s * (SPREAD.bloom + c.dA);
    const len = (PEDICEL + c.dPed) * size;
    const r = (pedDir * Math.PI) / 180;
    const tip: Pt = [node[0] + Math.sin(r) * len, node[1] - Math.cos(r) * len];
    const mid: Pt = [node[0] + Math.sin(r) * len * 0.5 + Math.cos(r) * s * 1.5, node[1] - Math.cos(r) * len * 0.5 + Math.sin(r) * s * 1.5];
    pedicel = [node, mid, tip];
    anchor = tip;
    // heads turn partway back toward upright
    const head = pedDir * 0.62;
    m = compose(translate(tip[0], tip[1]), rotate(head), scale(s * k, k));
  } else {
    const off = kind === "thorn" ? 1.1 : 0;
    const r = dir + (s * Math.PI) / 2;
    const at: Pt = [node[0] + Math.sin(r) * off, node[1] - Math.cos(r) * off];
    anchor = at;
    m = compose(translate(at[0], at[1]), rotate(deg + s * (SPREAD[kind] + c.dA)), scale(s * k, k));
  }
  const h = apply(m, [art.hit.x, art.hit.y]);
  const f = apply(m, [art.focus.x, art.focus.y]);
  return { m, anchor, pedicel, circle: { x: h[0], y: h[1], r: art.hit.r * k, bloom: kind === "bloom", tier }, focus: f };
}

// ——— the layout ———

/**
 * Lay out a bouquet. `salt` varies the arrangement and `palette` the colours; neither
 * changes what the bouquet says.
 */
export function layoutBouquet(genome: Genome, salt = 0, palette = 0): BouquetLayout {
  const colours = PALETTES[palette] ?? PALETTES[0];
  const stems: PlacedStem[] = [];
  const elements: PlacedElement[] = [];
  const placed: Circle[] = [];
  const swings = tierSwings(genome.stems.length + (genome.pending ? 1 : 0));

  for (const gStem of genome.stems) {
    const k = gStem.ordinal;
    const slot = slotFor(k);
    const swing = swings.get(slot.tier) ?? 0;
    const turn = rotate(swing);
    const alt = (-slot.halfStep * Math.PI) / 180;
    const rng = makeRng(mixSeed(salt, 0x5157, k));
    // Everything is placed as if the tier weren't turned, then turned as one piece.
    const theta = slot.angle + rng.jitter(1);
    const baseStalk = slot.stalk * rng.range(0.95, 1.05);
    const bendJitter = rng.jitter(0.00045);
    const curve: StemCurve = { theta: (theta * Math.PI) / 180, kappa: (theta / 60) * BEND + bendJitter };

    // Choose this stem's stalk length against what's already there, using a generic probe
    // (never this stem's own letters, so the choice can't change while typing). The lean
    // stays on its slot, so the fan stays even.
    let best = { stalk: baseStalk, score: Infinity };
    for (const dStalk of [0, 16, -16]) {
      const stalk = baseStalk + dStalk;
      let score = dStalk * dStalk * 0.12;
      for (const ds of [10, 44, 78]) {
        const { p } = curveAt(curve, stalk + ds);
        score += overlapPenalty({ x: p[0], y: p[1], r: 32 * slot.size, bloom: false, tier: slot.tier }, placed, alt);
      }
      if (q64(score) < q64(best.score)) best = { stalk, score };
    }

    // Leaves start on the outer side; the centre stem starts on the left.
    const firstSide: 1 | -1 = slot.angle > 0 ? 1 : -1;
    const pedicels: Pt[][] = [];
    let s = best.stalk;
    let prevKind: Kind | null = null;

    gStem.elements.forEach((el, node) => {
      const kind = kindOf(el.glyph);
      // Long words tighten up toward the tip. This depends only on the node's own
      // position (never the word's final length), so typing never shifts earlier nodes.
      const squeeze = node < 8 ? 1 : Math.max(0.62, Math.sqrt(8 / node));
      if (prevKind) s += ((EXT[prevKind] + EXT[kind]) / 2) * squeeze;
      prevKind = kind;
      const { p, dir } = curveAt(curve, s);
      const side: 1 | -1 = node % 2 === 0 ? firstSide : (-firstSide as 1 | -1);
      const art = drawGlyph(el.glyph, elementSeed(salt, k, node, el.g), colours);
      const size = slot.size * (node < 10 ? 1 : Math.max(0.82, 1 - 0.02 * (node - 9)));

      let choice: ReturnType<typeof placeElement> | null = null;
      let bestScore = Infinity;
      for (const c of CANDIDATES) {
        if (kind === "axis" && (c.flip || c.dA || c.dPed)) continue;
        if (kind !== "bloom" && c.dPed) continue;
        const trial = placeElement(art, kind, p, dir, side, size, c, slot.tier);
        const score = q64(overlapPenalty(trial.circle, placed, alt) + c.cost);
        if (score < bestScore) {
          bestScore = score;
          choice = trial;
        }
        if (score === 0) break;
      }
      const chosen = choice!;
      const m = compose(turn, chosen.m);
      placed.push(chosen.circle);
      if (chosen.pedicel) pedicels.push(chosen.pedicel.map((q) => apply(turn, q)));
      // a flower's own stalk is drawn with the stems, behind every head
      if (art.stalk) pedicels.push(art.stalk.map((q) => apply(m, q)));
      const [hx, hy] = apply(turn, [chosen.circle.x, chosen.circle.y]);
      elements.push({
        key: `${k}.${node}`,
        stem: k,
        node,
        g: el.g,
        glyph: el.glyph,
        index: el.index,
        kind,
        art,
        m,
        local: chosen.m,
        swing,
        shift: [0, 0],
        anchor: apply(turn, chosen.anchor),
        hit: { x: hx, y: hy, r: chosen.circle.r },
        focus: apply(turn, chosen.focus),
      });
    });

    const length = s;
    const cutLen = 62 + rng.range(0, 34);
    const cutTheta = curve.theta * 0.72;
    stems.push({
      ordinal: k,
      curve,
      swing,
      shift: [0, 0],
      line: sampleStem(curve, 0, length + 6).map((q) => apply(turn, q)),
      cut: [
        [0, 0],
        apply(turn, [-Math.sin(cutTheta) * cutLen, Math.cos(cutTheta) * cutLen]),
      ],
      pedicels,
      slot,
      length,
      end: gStem.end,
    });
  }

  let sprout: BouquetLayout["sprout"];
  if (genome.pending) {
    const k = genome.stems.length;
    const slot = slotFor(k);
    const swing = swings.get(slot.tier) ?? 0;
    const turn = rotate(swing);
    const rng = makeRng(mixSeed(salt, 0x5157, k));
    const theta = slot.angle + rng.jitter(1);
    const curve: StemCurve = { theta: (theta * Math.PI) / 180, kappa: (theta / 60) * BEND };
    const len = slot.stalk * 0.45;
    const end = curveAt(curve, len);
    sprout = { line: sampleStem(curve, 0, len).map((q) => apply(turn, q)), tip: apply(turn, end.p), dir: end.dir + (swing * Math.PI) / 180 };
  }

  return { stems, elements, bbox: boundsOf(stems, elements, sprout), sprout };
}

/** The extent of a bouquet above the tie (cut ends excluded). */
export function boundsOf(
  stems: readonly PlacedStem[],
  elements: readonly PlacedElement[],
  sprout?: BouquetLayout["sprout"],
): BouquetLayout["bbox"] {
  const bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const grow = (x: number, y: number, r = 0) => {
    bbox.minX = Math.min(bbox.minX, x - r);
    bbox.maxX = Math.max(bbox.maxX, x + r);
    bbox.minY = Math.min(bbox.minY, y - r);
    bbox.maxY = Math.max(bbox.maxY, y + r);
  };
  for (const e of elements) grow(e.hit.x, e.hit.y, e.hit.r * 1.1);
  for (const st of stems) for (const p of st.line) grow(p[0], p[1], 3);
  if (sprout) for (const p of sprout.line) grow(p[0], p[1], 6);
  return bbox;
}
