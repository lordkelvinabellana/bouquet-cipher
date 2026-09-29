import type { BloomSpecies, Glyph } from "../alphabet/v1";
import { makeRng, type Rng } from "../rng";
import { anemone, violet, heartBloom, iris, rose, tulip, yarrow } from "./blooms";
import { leaf } from "./leaves";
import { berries, dewdrops, mark, mysterySeed, pod } from "./marks";
import { strokeShape } from "./paint";
import { ACCENT, HEART_TONES, PALETTES, PAPER, type Palette } from "./palette";
import type { Art, ArtCtx, Shape } from "./types";

const BLOOMS: Readonly<Record<BloomSpecies, (ctx: ArtCtx) => Art>> = {
  tulip,
  anemone,
  rose,
  iris,
  violet,
  yarrow,
};

/**
 * A glyph drawn on its own (the alphabet legend, specimen sheets): its stalk, if it has
 * one, then the glyph. In a bouquet the stalk is drawn with the stems instead.
 */
export function standaloneShapes(art: Art): readonly Shape[] {
  return art.stalk ? [strokeShape(art.stalk, 2, 1.1, PAPER.ink), ...art.shapes] : art.shapes;
}

function withDew(art: Art, accents: readonly number[], rng: Rng): Art {
  if (accents.length === 0) return art;
  return { ...art, shapes: [...art.shapes, ...dewdrops(accents, art, rng)] };
}

const cache = new Map<string, Art>();
const CACHE_LIMIT = 3000;

/**
 * Draw one glyph. `seed` controls only the decorative variation (wobble, colour, size
 * jitter) and `palette` the colours it's painted in; what the glyph *means* comes
 * entirely from the glyph itself. Pure, so results are cached: re-laying out on every
 * keystroke stays cheap.
 */
export function drawGlyph(glyph: Glyph, seed: number, palette: Palette = PALETTES[0]): Art {
  const key = `${palette.id}|${seed}|${JSON.stringify(glyph)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const art = drawGlyphUncached(glyph, seed, palette);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, art);
  return art;
}

function drawGlyphUncached(glyph: Glyph, seed: number, palette: Palette): Art {
  const rng = makeRng(seed);
  const shapeRng = rng.fork(1);
  const colorRng = rng.fork(2);
  const dewRng = rng.fork(3);
  switch (glyph.t) {
    case "bloom":
      return withDew(
        BLOOMS[glyph.species]({ rng: shapeRng, upper: glyph.upper, tone: palette.bloom(colorRng, glyph.species) }),
        glyph.accents,
        dewRng,
      );
    case "leaf":
      return withDew(
        leaf(glyph.shape, { rng: shapeRng, upper: glyph.upper, tone: palette.leaves[glyph.tint], sprig: glyph.tint === "coral" }),
        glyph.accents,
        dewRng,
      );
    case "mark":
      return mark(glyph.mark, glyph.variant, {
        rng: shapeRng,
        upper: false,
        tone: palette.bud(colorRng),
      });
    case "berries":
      return berries({ rng: shapeRng, upper: false, tone: ACCENT.berry }, glyph.n);
    case "pod":
      return pod({ rng: shapeRng, upper: false, tone: ACCENT.pod });
    case "heart":
      return heartBloom({ rng: shapeRng, upper: false, tone: HEART_TONES[glyph.variant] ?? HEART_TONES[0] });
    case "seed":
      return mysterySeed({ rng: shapeRng, upper: false, tone: ACCENT.seed });
  }
}

export type { Art, Shape } from "./types";
