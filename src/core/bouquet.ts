/**
 * One place that turns a bouquet's text and key into its layout, so the composer, the
 * recipient's page and the preview image always grow exactly the same bouquet.
 */
import { PALETTES } from "./art/palette";
import { cipherFor, type Cipher } from "./cipher";
import { buildGenome, signatureOf } from "./genome/genome";
import { layoutBouquet, type BouquetLayout } from "./layout/v1/layout";

/** The cipher for a stored key (null for bouquets made before keys existed). */
export function cipherOf(key: string | null | undefined): Cipher | null {
  return key ? cipherFor(key, PALETTES.length) : null;
}

/** The arrangement's seed: from the key, or an older bouquet's stored salt. */
export function saltOf(cipher: Cipher | null, legacySalt = 0): number {
  return cipher ? cipher.salt : legacySalt;
}

/**
 * Grow a bouquet. A keyed bouquet takes its shuffle, arrangement and colours from its
 * key; an older one uses the open alphabet, its stored salt and the original palette.
 */
export function growBouquet(text: string, cipher: Cipher | null, legacySalt = 0): BouquetLayout {
  return layoutBouquet(buildGenome(text, cipher), saltOf(cipher, legacySalt), cipher ? cipher.palette : 0);
}

/** Seed for how the ribbon's loops and tails fall. */
export function ribbonSeedOf(cipher: Cipher | null, legacySalt = 0): number {
  return cipher ? (cipher.salt % 100000) + 7 : legacySalt + 7;
}

/** The wax seal to show: the sender's signature if there is one, else one drawn from the message. */
export function sealOf(senderSeal: number | null | undefined, text: string, cipher: Cipher | null, legacySalt = 0): number {
  return senderSeal ?? signatureOf(text, saltOf(cipher, legacySalt));
}

/** A fixed key for the stand-in bouquet (see `budsBouquet`). */
const BUDS_KEY = "ClosedBudsForTheGateAA";
/** What the stand-in's flowers say, if anyone reads them: never anyone's real message. */
const BUDS = "a garden grown for you ❤";

/**
 * A stand-in bouquet, the same for everyone: shown where a real bouquet is still kept
 * away (the private garden's gate, a bouquet waiting for its answer), so nothing about
 * the real message shows.
 */
export function budsBouquet(): { layout: BouquetLayout; cipher: Cipher | null; seal: number; ribbonSeed: number } {
  const cipher = cipherOf(BUDS_KEY);
  return { layout: growBouquet(BUDS, cipher), cipher, seal: 7, ribbonSeed: ribbonSeedOf(cipher) };
}
