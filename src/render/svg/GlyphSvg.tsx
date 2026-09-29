import { glyphFor, glyphName } from "@/core/alphabet/v1";
import { drawGlyph, standaloneShapes } from "@/core/art";
import { PAPER } from "@/core/art/palette";
import { Paths } from "./Paths";

/**
 * One glyph on a little stem stub, for legends and specimen sheets.
 * With `fit`, the view is framed around the glyph so small ones stay legible.
 */
export function GlyphSvg({ ch, seed = 1, className, label, fit = true }: { ch: string; seed?: number; className?: string; label?: string; fit?: boolean }) {
  const glyph = glyphFor(ch);
  const art = drawGlyph(glyph, seed);
  const stub = 16;
  let viewBox = "-60 -108 120 128";
  if (fit) {
    const h = Math.max(art.reach, art.hit.r * 2, 30) + 28;
    const w = (h * 120) / 128;
    const cx = art.hit.x * 0.5;
    viewBox = `${cx - w / 2} ${-h + stub + 4} ${w} ${h}`;
  }
  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={label ?? `${ch}: ${glyphName(glyph)}`}>
      <path d={`M-1.5 ${stub + 6} L1.5 ${stub + 6} L0.9 0 L-0.9 0 Z`} fill={PAPER.ink} />
      <Paths shapes={standaloneShapes(art)} />
    </svg>
  );
}
