/**
 * Gathering: how the stems are bunched before they're wrapped, the way a florist gathers
 * a bouquet in one hand. Two moves, both deterministic:
 *
 *  1. Turn. Stems are taken centre first (smallest lean, then reading order). Each turns
 *     about the tie toward upright, as far as it can: at most to GATHER of its lean, and
 *     never past the stem before it on its side (so stems don't cross).
 *  2. Sink. Then, tallest first, each stem is pulled down through the hand along its own
 *     line (up to SINK), so heads standing alone above the rest settle into the bunch.
 *
 * Either move stops where a flower head would press closer to another than TUCK allows
 * (heads that were already that close may stay so, but get no closer), where anything
 * would poke out of the open bouquet's outline (so the bunch never grows), or where it
 * would drop into the paper's neck. Leaves and buds don't hold a stem back otherwise:
 * like foliage in a real bunch, they tuck in between.
 *
 * Stems only move rigidly, so nothing is redrawn and the live view glides them into the
 * bunch. The result depends only on the layout, so the sender's view, the recipient's
 * page, the share picture and the link preview all show the same bunch. It takes the
 * open layout.
 */
import { apply, compose, rotate, translate, type Mat, type Pt } from "../../art/geom";
import { boundsOf, type BouquetLayout, type PlacedElement, type PlacedStem } from "./layout";

/** The tightest a stem is turned in, as a fraction of its lean. */
const GATHER = 0.4;
/**
 * How close two flower heads may press in a bunch, as a fraction of their collision radii
 * summed (the open layout keeps them at about 0.66).
 */
export const TUCK = 0.55;
/** The furthest a stem is pulled down (bouquet units: about half a flower). */
export const SINK = 36;
/** Heads stay this far above the tie, and everything else this far, clear of the paper's neck. */
export const FLOOR = { head: 70, other: 40 };
/** How finely each move is searched. */
const STEPS = 12;
/** Room kept between neighbouring stems on the same side (degrees), so they never cross. */
export const MIN_GAP = 1.5;

/** How one stem is gathered: turned about the tie (degrees), then pulled down its own line. */
export interface Gather {
  turn: number;
  sink: number;
}

const leanOf = (st: PlacedStem) => (st.curve.theta * 180) / Math.PI + st.swing;

/** The move down a stem's own line (after its turn), for a stem that leaned `lean` degrees. */
function sinkShift(lean: number, g: Gather): Pt {
  const a = ((lean + g.turn) * Math.PI) / 180;
  return [-g.sink * Math.sin(a), g.sink * Math.cos(a)];
}

/** The rigid motion of a gather. */
function motion(lean: number, g: Gather): Mat {
  const [x, y] = sinkShift(lean, g);
  return compose(translate(x, y), rotate(g.turn));
}

interface Head {
  stem: number;
  /** Where it is now, and where it was in the open bouquet. */
  at: Pt;
  open: Pt;
  r: number;
}

/** Can these heads sit where they are without pressing on any other stem's heads? */
function clear(stem: number, moved: readonly Head[], others: readonly Head[]): boolean {
  for (const h of moved) {
    for (const q of others) {
      if (q.stem === stem) continue;
      const limit = Math.min(Math.hypot(h.open[0] - q.open[0], h.open[1] - q.open[1]), (h.r + q.r) * TUCK);
      if (Math.hypot(h.at[0] - q.at[0], h.at[1] - q.at[1]) < limit - 1e-6) return false;
    }
  }
  return true;
}

/** How each stem is gathered (by ordinal). */
export function gatherMoves(layout: BouquetLayout): Map<number, Gather> {
  const own = new Map<number, PlacedElement[]>();
  for (const e of layout.elements) own.set(e.stem, [...(own.get(e.stem) ?? []), e]);
  const lean = new Map(layout.stems.map((st) => [st.ordinal, leanOf(st)]));
  const moves = new Map<number, Gather>(layout.stems.map((st) => [st.ordinal, { turn: 0, sink: 0 }]));
  // the open bouquet's outline, measured as boundsOf does
  const box = layout.bbox;
  const inside = (stem: number, m: Mat) =>
    (own.get(stem) ?? []).every((e) => {
      const [x, y] = apply(m, [e.hit.x, e.hit.y]);
      const r = e.hit.r * 1.1;
      return x - r >= box.minX - 1e-6 && x + r <= box.maxX + 1e-6 && y - r >= box.minY - 1e-6;
    }) &&
    layout.stems[stem].line.every((p) => {
      const [x, y] = apply(m, p);
      return x - 3 >= box.minX - 1e-6 && x + 3 <= box.maxX + 1e-6 && y - 3 >= box.minY - 1e-6;
    });
  const place = (stem: number, g: Gather): Head[] => {
    const m = motion(lean.get(stem)!, g);
    return (own.get(stem) ?? [])
      .filter((e) => e.kind === "bloom")
      .map((e) => ({ stem, at: apply(m, [e.hit.x, e.hit.y]), open: [e.hit.x, e.hit.y], r: e.hit.r }));
  };

  // 1. Turn, centre first; each stem is checked against the ones already gathered.
  const order = [...layout.stems].sort((a, b) => Math.abs(leanOf(a)) - Math.abs(leanOf(b)) || a.ordinal - b.ordinal);
  const reach = { left: 0, right: 0 };
  let heads: Head[] = [];
  for (const st of order) {
    const a = lean.get(st.ordinal)!;
    const side = a < 0 ? "left" : "right";
    const sign = a < 0 ? -1 : 1;
    const floor = reach[side] + MIN_GAP;
    let turn = 0;
    if (Math.abs(a) > floor) {
      for (let i = STEPS; i >= 1; i--) {
        const target = sign * Math.max(floor, Math.abs(a) * (1 - (1 - GATHER) * (i / STEPS)));
        const g = { turn: target - a, sink: 0 };
        if (inside(st.ordinal, motion(a, g)) && clear(st.ordinal, place(st.ordinal, g), heads)) {
          turn = target - a;
          break;
        }
      }
    }
    moves.set(st.ordinal, { turn, sink: 0 });
    reach[side] = Math.max(reach[side], Math.abs(a + turn));
    heads.push(...place(st.ordinal, { turn, sink: 0 }));
  }

  // 2. Sink, tallest first; now every stem is in place, so each is checked against all.
  const top = (stem: number) => Math.min(0, ...(own.get(stem) ?? []).map((e) => e.hit.y - e.hit.r));
  const tallest = [...layout.stems].sort((a, b) => top(a.ordinal) - top(b.ordinal) || a.ordinal - b.ordinal);
  for (const st of tallest) {
    const { turn } = moves.get(st.ordinal)!;
    for (let i = STEPS; i >= 1; i--) {
      const g = { turn, sink: (SINK * i) / STEPS };
      const m = motion(lean.get(st.ordinal)!, g);
      const tooLow = (own.get(st.ordinal) ?? []).some(
        (e) => apply(m, [e.hit.x, e.hit.y])[1] > -(e.kind === "bloom" ? FLOOR.head : FLOOR.other),
      );
      if (tooLow || !inside(st.ordinal, m)) continue;
      const moved = place(st.ordinal, g);
      if (clear(st.ordinal, moved, heads)) {
        moves.set(st.ordinal, g);
        heads = [...heads.filter((h) => h.stem !== st.ordinal), ...moved];
        break;
      }
    }
  }
  return moves;
}

/** The bouquet bunched up for wrapping (see above). */
export function gatherBouquet(layout: BouquetLayout): BouquetLayout {
  const moves = gatherMoves(layout);
  // A stem's pose becomes: sink ∘ turn ∘ (its own shift and swing).
  const posed = (stem: number, swing: number, shift: Pt) => {
    const g = moves.get(stem)!;
    const [dx, dy] = sinkShift(leanOf(layout.stems[stem]), g);
    const [sx, sy] = apply(rotate(g.turn), shift);
    return { swing: swing + g.turn, shift: [sx + dx, sy + dy] as Pt };
  };
  const motionOf = (stem: number) => motion(leanOf(layout.stems[stem]), moves.get(stem)!);
  const still = (stem: number) => {
    const g = moves.get(stem)!;
    return !g.turn && !g.sink;
  };
  const stems = layout.stems.map((st): PlacedStem => {
    if (still(st.ordinal)) return st;
    const m = motionOf(st.ordinal);
    return {
      ...st,
      ...posed(st.ordinal, st.swing, st.shift),
      line: st.line.map((p) => apply(m, p)),
      cut: st.cut.map((p) => apply(m, p)),
      pedicels: st.pedicels.map((line) => line.map((p) => apply(m, p))),
    };
  });
  const elements = layout.elements.map((e): PlacedElement => {
    if (still(e.stem)) return e;
    const m = motionOf(e.stem);
    const [x, y] = apply(m, [e.hit.x, e.hit.y]);
    return {
      ...e,
      ...posed(e.stem, e.swing, e.shift),
      m: compose(m, e.m),
      anchor: apply(m, e.anchor),
      hit: { x, y, r: e.hit.r },
      focus: apply(m, e.focus),
    };
  });
  return { ...layout, stems, elements, bbox: boundsOf(stems, elements, layout.sprout) };
}
