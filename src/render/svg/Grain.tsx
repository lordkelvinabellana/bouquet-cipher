import { cardShape, FRAME } from "@/core/art/scenery";

/** One static noise tile (rasterised once by the browser, never per frame). */
const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 0.33  0 0 0 0 0.26  0 0 0 0 0.18  0 0 0 0.62 -0.1'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export const NOISE_URL = `data:image/svg+xml,${NOISE_SVG.replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E")}`;

/** Paper grain over the card, drawn inside the SVG so it's clipped to the pill. */
export function Grain({ id, opacity = 0.42 }: { id: string; opacity?: number }) {
  return (
    <>
      <defs>
        <pattern id={`${id}-p`} width="200" height="200" patternUnits="userSpaceOnUse">
          <image href={NOISE_URL} width="200" height="200" />
        </pattern>
        <clipPath id={`${id}-c`}>
          <path d={cardShape().d} />
        </clipPath>
      </defs>
      <rect width={FRAME.w} height={FRAME.h} fill={`url(#${id}-p)`} clipPath={`url(#${id}-c)`} opacity={opacity} pointerEvents="none" />
    </>
  );
}
