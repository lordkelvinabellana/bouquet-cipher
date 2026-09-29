/** Serialise a draw list to a standalone SVG document (used for server-side preview images). */
import { fmt } from "../art/geom";
import { cardShape, FRAME } from "../art/scenery";
import type { DrawGroup } from "./scene";

/** Paper grain clipped to the card, as filters (fine for a one-off raster, never for live animation). */
function grainSvg(): string {
  return (
    `<defs><filter id="grain" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 0.33 0 0 0 0 0.26 0 0 0 0 0.18 0 0 0 0.62 -0.1"/></filter>` +
    `<clipPath id="card"><path d="${cardShape().d}"/></clipPath></defs>` +
    `<rect width="${FRAME.w}" height="${FRAME.h}" filter="url(#grain)" clip-path="url(#card)" opacity="0.42"/>`
  );
}

function attr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function toSvgString(
  groups: readonly DrawGroup[],
  opts: { width?: number; height?: number; viewBox?: string; grain?: boolean } = {},
): string {
  const body = groups
    .map((g) => {
      const [a, b, c, d, e, f] = g.m;
      const paths = g.shapes
        .map(
          (s) =>
            `<path d="${attr(s.d)}" fill="${s.fill}"${s.opacity !== undefined ? ` fill-opacity="${fmt(s.opacity)}"` : ""}${
              s.rule ? ` fill-rule="${s.rule}"` : ""
            }/>`,
        )
        .join("");
      const identity = a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0;
      return identity ? paths : `<g transform="matrix(${[a, b, c, d, e, f].map((n) => Math.round(n * 10000) / 10000).join(" ")})">${paths}</g>`;
    })
    .join("");
  const vb = opts.viewBox ?? `0 0 ${FRAME.w} ${FRAME.h}`;
  const size = opts.width ? ` width="${opts.width}" height="${opts.height ?? opts.width}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size}>${body}${opts.grain ? grainSvg() : ""}</svg>`;
}
