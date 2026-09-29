import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { compose, IDENTITY, scale, translate, type Pt } from "@/core/art/geom";
import { PAPER } from "@/core/art/palette";
import { sealShapes } from "@/core/art/scenery";
import { parseSealStyle } from "@/core/art/seal";
import { backdropGroups, sceneGroups } from "@/core/scene/scene";
import { toSvgString } from "@/core/scene/svgString";
import { canon } from "@/core/text/canon";

export interface PreviewInput {
  message: string;
  salt?: number;
  paper?: number | null;
  cipherKey?: string | null;
  seal?: number | null;
  sealStyle?: string | null;
}

/** The wrapped bouquet on its card as a standalone SVG (for chat link previews). */
export function bouquetPreviewSvg({ message, salt = 0, paper = 0, cipherKey = null, seal = null, sealStyle = null }: PreviewInput): string {
  const c = canon(message);
  const cipher = cipherOf(cipherKey);
  const layout = growBouquet(c, cipher, salt);
  const groups = sceneGroups(layout, {
    seal: c ? sealOf(seal, c, cipher, salt) : undefined,
    ribbonSeed: ribbonSeedOf(cipher, salt),
    paper: c ? paper : null,
    sealStyle,
  });
  return toSvgString(groups, { viewBox: "0 20 600 860", grain: true });
}

/** A card (a reply that's just words) as a picture: a sealed envelope on the card. */
export function cardPreviewSvg(seal: number, sealStyle: string | null = null): string {
  const [x0, y0, w, h] = [150, 340, 300, 200];
  const corner = (x: number, y: number): Pt => [x0 + x * w, y0 + y * h];
  const path = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
  const envelope = [
    { d: path([corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)]), fill: "#EAD9BD" },
    { d: path([corner(0, 1), corner(0.5, 0.48), corner(1, 1)]), fill: "#E2CDAB" },
    { d: path([corner(0, 0), corner(1, 0), corner(0.5, 0.58)]), fill: "#DCC4A0" },
  ];
  const at = corner(0.5, 0.56);
  const groups = [
    ...backdropGroups(true),
    { m: IDENTITY, shapes: envelope },
    { m: compose(translate(at[0], at[1]), scale(2.4)), shapes: sealShapes([0, 0], seal, 1, parseSealStyle(sealStyle)) },
    { m: IDENTITY, shapes: [{ d: path([corner(0.08, 1.06), corner(0.92, 1.06), corner(0.92, 1.075), corner(0.08, 1.075)]), fill: PAPER.stitch, opacity: 0.35 }] },
  ];
  return toSvgString(groups, { viewBox: "0 20 600 860", grain: true });
}
