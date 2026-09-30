/**
 * Grow / wilt animations. They write SVG attributes directly with Motion's animation
 * engine, so a keystroke never re-renders the whole bouquet per frame.
 *
 * Every element is drawn in its own local space with its attachment point at the origin,
 * so scaling and rotating the inner <g> makes it sprout from (and droop at) the stem.
 *
 * Browsers pause animation frames in background tabs; each animation also has a timed
 * fallback that jumps to its end state, so nothing is ever left invisible or half-wilted.
 */
import { DUR, EASE, POP, SETTLE } from "./motion";
import { animate } from "motion";
import { compose, rotate, translate, type Mat, type Pt } from "@/core/art/geom";

export type ElementKind = "bloom" | "leaf" | "mark" | "thorn" | "axis";

type Stop = () => void;

interface Controls {
  stop(): void;
  complete(): void;
}

/**
 * Run an animation, but guarantee its end state within `deadline` seconds.
 * Cancelling (unmount, or React's dev-mode effect re-run) never triggers `end`.
 */
function guarded(c: Controls & { finished?: Promise<unknown> }, deadline: number, end: () => void): Stop {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    end();
  };
  const timer = setTimeout(() => {
    if (settled) return;
    c.stop();
    finish();
  }, deadline * 1000);
  c.finished?.then(finish, () => {});
  return () => {
    settled = true;
    clearTimeout(timer);
    c.stop();
  };
}

function setT(node: SVGGElement, sx: number, sy: number, rot: number) {
  node.setAttribute("transform", `rotate(${rot.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`);
}

function fadeIn(node: Element, delay: number): Stop {
  node.setAttribute("opacity", "0");
  const c = animate(0, 1, { duration: DUR.press, delay, ease: EASE.out, onUpdate: (v) => node.setAttribute("opacity", v.toFixed(3)) });
  return guarded(c, delay + 0.6, () => node.removeAttribute("opacity"));
}

/** Where a whole stem sits: turned about the tie (degrees), then moved (see layout.ts). */
export interface Pose {
  swing: number;
  shift: Pt;
}

const poseMatrix = (p: Pose): Mat => compose(translate(p.shift[0], p.shift[1]), rotate(p.swing));
const unposeMatrix = (p: Pose): Mat => compose(rotate(-p.swing), translate(-p.shift[0], -p.shift[1]));

export const samePose = (a: Pose, b: Pose) =>
  Math.abs(a.swing - b.swing) < 0.005 && Math.abs(a.shift[0] - b.shift[0]) < 0.01 && Math.abs(a.shift[1] - b.shift[1]) < 0.01;

/**
 * A stem (or one of its elements) gliding to a new pose as one piece: its tier turning to
 * keep the fan even, or the bunch gathering for wrapping. The node's drawing is already
 * at `to`; this starts it back at `from` and springs it home. `onPose` reports where it
 * has got to, so a glide that's interrupted by another can carry on from there.
 */
export function glidePose(node: SVGGElement, from: Pose, to: Pose, reduced: boolean, onPose: (p: Pose) => void): Stop {
  const back = unposeMatrix(to);
  const set = (p: Pose) => {
    onPose(p);
    if (samePose(p, to)) return node.removeAttribute("transform");
    const m = compose(poseMatrix(p), back);
    node.setAttribute("transform", `matrix(${m.map((n) => n.toFixed(4)).join(" ")})`);
  };
  if (reduced || document.hidden) {
    set(to);
    return () => {};
  }
  set(from);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = animate(0, 1, {
    ...SETTLE,
    onUpdate: (t) => set({ swing: mix(from.swing, to.swing, t), shift: [mix(from.shift[0], to.shift[0], t), mix(from.shift[1], to.shift[1], t)] }),
  });
  return guarded(c, 1.6, () => set(to));
}

/** Sprout an element from its attachment point: leaves unfurl, blooms open height-first. */
export function growIn(node: SVGGElement, kind: ElementKind, delay: number, reduced: boolean): Stop {
  if (reduced || document.hidden) return fadeIn(node, reduced ? delay : 0);
  const unfurl = kind === "leaf" ? -26 : kind === "mark" ? -14 : 0;
  setT(node, 0.001, 0.001, unfurl);
  const c = animate(0, 1, {
    ...POP,
    delay,
    onUpdate: (v) => {
      const sy = Math.max(0.001, v);
      const sx = kind === "bloom" ? Math.max(0.001, v * 1.25 - 0.25) : sy;
      setT(node, sx, sy, unfurl * (1 - Math.min(1, v)));
    },
  });
  return guarded(c, delay + 1.6, () => node.removeAttribute("transform"));
}

/** Droop outward, shrink and fade (Backspace). Calls `done` when finished. */
export function wiltOut(node: SVGGElement, reduced: boolean, done: () => void): Stop {
  const c = animate(0, 1, {
    duration: reduced ? DUR.press : DUR.base,
    ease: EASE.in,
    onUpdate: (v) => {
      if (!reduced) setT(node, 1 - 0.35 * v, 1 - 0.35 * v, 38 * v);
      node.setAttribute("opacity", (1 - v).toFixed(3));
    },
  });
  return guarded(c, 0.9, done);
}

/** A new stem shoots up from the tie (bouquet-space origin). */
export function growStem(node: SVGGElement, reduced: boolean): Stop {
  if (reduced || document.hidden) return fadeIn(node, 0);
  node.setAttribute("transform", "scale(0.001)");
  const c = animate(0, 1, {
    ...POP,
    onUpdate: (v) => node.setAttribute("transform", `scale(${Math.max(0.001, v).toFixed(4)})`),
  });
  return guarded(c, 1.6, () => node.removeAttribute("transform"));
}

/** A removed stem shrinks back into the tie. */
export function retractStem(node: SVGGElement, reduced: boolean, done: () => void): Stop {
  const c = animate(1, 0, {
    duration: reduced ? DUR.press : DUR.base,
    ease: EASE.in,
    onUpdate: (v) => {
      if (!reduced) node.setAttribute("transform", `scale(${Math.max(0.001, v).toFixed(4)})`);
      node.setAttribute("opacity", Math.min(1, v * 1.5).toFixed(3));
    },
  });
  return guarded(c, 0.8, done);
}

export type WrapPart = "back" | "left" | "right";

/** Paper folds in around the bouquet: the back sheet rises from the tie, the front sheets swing across. */
export function wrapIn(node: SVGGElement, part: WrapPart, reduced: boolean): Stop {
  if (reduced || document.hidden) return fadeIn(node, 0);
  const delay = part === "back" ? 0 : part === "left" ? 0.28 : 0.42;
  const set = (v: number) => {
    const t = Math.max(0.001, v);
    if (part === "back") node.setAttribute("transform", `scale(${(0.35 + 0.65 * t).toFixed(4)} ${t.toFixed(4)})`);
    else node.setAttribute("transform", `rotate(${((part === "left" ? -64 : 64) * (1 - t)).toFixed(2)})`);
    node.setAttribute("opacity", Math.min(1, t * 2.2).toFixed(3));
  };
  set(0);
  const c = animate(0, 1, { ...POP, delay, onUpdate: set });
  return guarded(c, delay + 1.8, () => {
    node.removeAttribute("transform");
    node.removeAttribute("opacity");
  });
}

/** Paper swings open and falls away (unwrapping). Calls `done` at the end. */
export function wrapOut(node: SVGGElement, part: WrapPart, reduced: boolean, done: () => void): Stop {
  const delay = reduced ? 0 : part === "right" ? 0 : part === "left" ? 0.12 : 0.3;
  const c = animate(0, 1, {
    duration: reduced ? DUR.press : DUR.slow,
    delay,
    ease: EASE.in,
    onUpdate: (v) => {
      if (!reduced) {
        if (part === "back") node.setAttribute("transform", `translate(0 ${(v * 60).toFixed(2)}) scale(${(1 - 0.25 * v).toFixed(4)})`);
        else node.setAttribute("transform", `rotate(${((part === "left" ? -78 : 78) * v).toFixed(2)}) translate(0 ${(v * 30).toFixed(2)})`);
      }
      node.setAttribute("opacity", (1 - v).toFixed(3));
    },
  });
  return guarded(c, delay + 1.2, done);
}

/** The gift tag drops in on its string and settles with a little swing. */
export function tagDrop(node: SVGGElement, pivot: readonly [number, number], reduced: boolean): Stop {
  if (reduced || document.hidden) return fadeIn(node, 0);
  const [px, py] = pivot;
  const set = (v: number) => {
    const swing = 14 * Math.exp(-3.2 * v) * Math.cos(9 * v);
    node.setAttribute("transform", `translate(0 ${(-60 * (1 - Math.min(1, v * 1.6))).toFixed(2)}) rotate(${swing.toFixed(2)} ${px} ${py})`);
    node.setAttribute("opacity", Math.min(1, v * 3).toFixed(3));
  };
  set(0);
  const c = animate(0, 1, { duration: 1.3, ease: "linear", delay: 0.15, onUpdate: set });
  return guarded(c, 2, () => {
    node.removeAttribute("transform");
    node.removeAttribute("opacity");
  });
}

export { animate };
