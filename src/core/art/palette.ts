import type { BloomSpecies, LeafTint } from "../alphabet/v1";
import type { Rng } from "../rng";
import type { Hex, Tone } from "./color";

/** Paper and ink, sampled from the style reference. */
export const PAPER = {
  slate: "#3E4F57",
  cream: "#FBEFD6",
  stitch: "#A57B52",
  ink: "#2E4A5E",
  inkLight: "#44627A",
} as const;

export type BloomColor = "pink" | "yellow" | "orange" | "blue" | "lavender" | "cream";

export const BLOOM_TONES: Readonly<Record<BloomColor, Tone>> = {
  pink: { base: "#F09AB6", light: "#F7BCD0", dark: "#DD7A9D" },
  yellow: { base: "#F3C75B", light: "#F8DC8E", dark: "#E0AA3E" },
  orange: { base: "#EF7F4E", light: "#F5A479", dark: "#D96534" },
  blue: { base: "#7D97BE", light: "#A3B8D7", dark: "#627DA6" },
  lavender: { base: "#A487C0", light: "#C1A9D6", dark: "#876AA6" },
  cream: { base: "#F6EBD5", light: "#FFF9EE", dark: "#E3D3B4" },
};

/** Which colours suit each species, in rough order of preference (repeats weight the pick). */
const SPECIES_COLORS: Readonly<Record<BloomSpecies, readonly BloomColor[]>> = {
  tulip: ["pink", "yellow", "pink", "lavender", "orange", "yellow"],
  anemone: ["orange", "blue", "pink", "lavender", "orange"],
  rose: ["pink", "orange", "yellow", "pink", "lavender"],
  iris: ["lavender", "blue", "lavender", "blue", "yellow"],
  bellflower: ["blue", "lavender", "blue", "pink"],
  yarrow: ["yellow", "pink", "orange", "yellow", "lavender"],
};

export function pickBloomTone(rng: Rng, species: BloomSpecies): Tone {
  return BLOOM_TONES[rng.pick(SPECIES_COLORS[species])];
}

/**
 * Leaf tints. Sage is kept darker and coral lighter so the two stay distinguishable
 * with red-green colour blindness (lightness gap of roughly 12-15 L*).
 */
export const LEAF_TONES: Readonly<Record<LeafTint, Tone>> = {
  sage: { base: "#86AE7F", light: "#A5C79B", dark: "#638E60" },
  blue: { base: "#9BBACB", light: "#BCD3E0", dark: "#7697AD" },
  coral: { base: "#F3A07E", light: "#F8BFA4", dark: "#DE7E5A" },
};

/** Greens for sepals, stalk bases and the like. */
export const GREEN: Tone = { base: "#7FA478", light: "#A1C096", dark: "#5C8559" };

// ——— palettes: the colours a bouquet wears ———

/** Extra flower colours for the keyed palettes. Flowers may go deep; they're never dull. */
const BLOOMS_EXTRA = {
  blush: { base: "#F4B8C4", light: "#F9D3DB", dark: "#E394A6" },
  rose: { base: "#E0708F", light: "#EE9BB0", dark: "#C4546F" },
  berry: { base: "#B8476A", light: "#D06E8C", dark: "#93334F" },
  plum: { base: "#8F5FA3", light: "#AE86C1", dark: "#724684" },
  lilac: { base: "#C4A9DC", light: "#DAC6EA", dark: "#A98BC4" },
  sky: { base: "#93B7E0", light: "#B7CFEC", dark: "#7299C8" },
  apricot: { base: "#F5A962", light: "#F9C68F", dark: "#E08C43" },
  coral: { base: "#F08678", light: "#F6AA9F", dark: "#D9685B" },
  peach: { base: "#F7BD95", light: "#FAD4B8", dark: "#E9A075" },
} satisfies Record<string, Tone>;

/**
 * Leaf colours for the keyed palettes: only fresh greens, blue-greens and light warm
 * accents. Never brown, grey or dark, which would read as withered.
 */
const LEAVES_EXTRA = {
  fern: { base: "#7FAD70", light: "#A0C793", dark: "#5F8F53" },
  mint: { base: "#8CC2A0", light: "#ADD6BC", dark: "#6BA383" },
  eucalyptus: { base: "#8FB3A3", light: "#B0CCBF", dark: "#6E9584" },
  spring: { base: "#93BF6E", light: "#B2D493", dark: "#74A152" },
  seaglass: { base: "#8DC3BB", light: "#B0D8D2", dark: "#6BA79E" },
  mist: { base: "#A6C0D6", light: "#C4D6E5", dark: "#85A2BC" },
  apricot: { base: "#F4B183", light: "#F8CBA8", dark: "#E0915F" },
  roseleaf: { base: "#EDA7A2", light: "#F4C4C0", dark: "#D98680" },
  peach: { base: "#F5B99A", light: "#F9D0BA", dark: "#E39A76" },
} satisfies Record<string, Tone>;

export interface Palette {
  id: number;
  name: string;
  /** A flower colour for this species (the rng keeps it deterministic per element). */
  bloom(rng: Rng, species: BloomSpecies): Tone;
  /** A bud colour (punctuation marks). */
  bud(rng: Rng): Tone;
  /** Leaf colours by tier: the main green, the cool second, the warm accent. */
  leaves: Readonly<Record<LeafTint, Tone>>;
}

const SPECIES_INDEX: Readonly<Record<BloomSpecies, number>> = { tulip: 0, anemone: 1, rose: 2, iris: 3, bellflower: 4, yarrow: 5 };

/** A palette from five flower colours: each species leans on three of them, so a bouquet mixes well. */
function family(id: number, name: string, blooms: readonly Tone[], leaves: Record<LeafTint, Tone>): Palette {
  const n = blooms.length;
  return {
    id,
    name,
    bloom(rng, species) {
      const k = SPECIES_INDEX[species];
      return blooms[rng.pick([k % n, (k + 1) % n, (k + 3) % n])];
    },
    bud: (rng) => blooms[rng.int(0, n - 1)],
    leaves,
  };
}

const B = { ...BLOOM_TONES, ...BLOOMS_EXTRA };
const L = { ...LEAF_TONES, ...LEAVES_EXTRA };

/**
 * Palette 0 is the original look (bouquets made before keys wear it). The others are
 * picked by each bouquet's key. Stems are always ink, whatever the palette.
 */
export const PALETTES: readonly Palette[] = [
  {
    id: 0,
    name: "Garden",
    bloom: pickBloomTone,
    bud: (rng) => BLOOM_TONES[rng.pick(["pink", "orange", "lavender", "pink"] as const)],
    leaves: LEAF_TONES,
  },
  family(1, "Sunset", [B.coral, B.apricot, B.yellow, B.rose, B.peach], { sage: L.fern, blue: L.seaglass, coral: L.apricot }),
  family(2, "Twilight", [B.plum, B.lavender, B.lilac, B.sky, B.blush], { sage: L.eucalyptus, blue: L.mist, coral: L.roseleaf }),
  family(3, "Berry", [B.berry, B.rose, B.pink, B.plum, B.blush], { sage: L.mint, blue: L.seaglass, coral: L.peach }),
  family(4, "Meadow", [B.yellow, B.sky, B.blue, B.peach, B.pink], { sage: L.spring, blue: L.eucalyptus, coral: L.coral }),
  family(5, "Blush", [B.blush, B.pink, B.peach, B.lilac, B.coral], { sage: L.sage, blue: L.mist, coral: L.roseleaf }),
];

/** Every leaf colour any palette can use (checked by tests: nothing withered). */
export const ALL_LEAF_TONES: readonly Tone[] = PALETTES.flatMap((p) => Object.values(p.leaves));

export const ACCENT = {
  berry: { base: "#C4503F", light: "#E07C66", dark: "#9C3A30" } as Tone,
  pod: { base: "#BBA66C", light: "#D5C38F", dark: "#8E7A45" } as Tone,
  seed: { base: "#4E433A", light: "#DCCFB6", dark: "#342C25" } as Tone,
  snow: { base: "#FAF6EC", light: "#FFFFFF", dark: "#DDD5C3" } as Tone,
  ribbon: { base: "#D98B7E", light: "#EAAA9E", dark: "#B96C61" } as Tone,
  seal: { base: "#A73E36", light: "#CC6456", dark: "#842C27" } as Tone,
  dew: "#E4F1F6" as Hex,
  dewRim: "#98C1D3" as Hex,
  pollen: "#F2C14E" as Hex,
  eye: "#33404D" as Hex,
} as const;

/** Colours for the heart bloom, one per entry in HEARTS (alphabet v1 order). */
export const HEART_TONES: readonly Tone[] = [
  ...Array.from({ length: 5 }, () => ({ base: "#D9544D", light: "#EA7D72", dark: "#B23D38" })), // ❤️ ❤ ♥️ ♥ ♡
  ...Array.from({ length: 7 }, () => ({ base: "#EC7FA0", light: "#F5A6BF", dark: "#CF5F83" })), // 💕 … 💝
  { base: "#F2A0BD", light: "#F8C3D5", dark: "#DB7E9F" }, // 🩷
  { base: "#EF8A4E", light: "#F6AC7C", dark: "#D46C33" }, // 🧡
  { base: "#F3C75B", light: "#F8DC8E", dark: "#E0AA3E" }, // 💛
  { base: "#7FAE72", light: "#A3C997", dark: "#5E8C55" }, // 💚
  { base: "#6E8FC2", light: "#97B0D8", dark: "#5474A8" }, // 💙
  { base: "#94C4D8", light: "#B9DAE7", dark: "#6FA6BE" }, // 🩵
  { base: "#9D7CC0", light: "#BCA2D7", dark: "#7F5FA3" }, // 💜
  { base: "#9C7257", light: "#BB9278", dark: "#7B563F" }, // 🤎
  { base: "#3A4450", light: "#5A6572", dark: "#252C35" }, // 🖤
  { base: "#A7ADB2", light: "#C6CBCF", dark: "#878D93" }, // 🩶
  { base: "#F7F1E6", light: "#FFFFFF", dark: "#E0D6C4" }, // 🤍
];
