import type { Rng } from "../rng";
import type { Hex, Tone } from "./color";
import type { Pt } from "./geom";

/** One filled path. Everything the app draws is a list of these. */
export interface Shape {
  d: string;
  fill: Hex;
  opacity?: number;
  rule?: "evenodd";
}

/** A drawn element in its own local space (attachment point at the origin, growing up along -y). */
export interface Art {
  shapes: Shape[];
  /** Collision circle, used by the layout to keep elements from piling up. */
  hit: { x: number; y: number; r: number };
  /** Visual centre: where the reveal glow sits and the letter chip lifts off from. */
  focus: { x: number; y: number };
  /** How far the element extends from its attachment point. */
  reach: number;
  /**
   * A stalk from the attachment point up to the head, in local art space. It's drawn with
   * the stems (behind every flower), so it never seems to sprout from another flower.
   */
  stalk?: Pt[];
}

/** A line of text (the gift tag's names and code). Drawn by the SVG and canvas renderers. */
export interface Label {
  text: string;
  x: number;
  y: number;
  size: number;
  font: "hand" | "serif";
  color: Hex;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  letterSpacing?: number;
}

export interface ArtCtx {
  rng: Rng;
  upper: boolean;
  tone: Tone;
}
