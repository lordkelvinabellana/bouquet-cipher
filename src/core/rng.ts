/**
 * Deterministic hashing and pseudo-random numbers.
 *
 * Everything here uses 32-bit integer math (Math.imul, shifts), so every JS engine,
 * browser or server, produces identical sequences for the same seed. That is what
 * gives each bouquet its stable "signature".
 */

/** 32-bit FNV-1a hash of a string's UTF-16 code units. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine several integers into one well-mixed 32-bit seed (murmur3-style). */
export function mixSeed(...parts: number[]): number {
  let h = 0x9e3779b9 | 0;
  for (const p of parts) {
    let k = p | 0;
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  range(min: number, max: number): number;
  /** Integer in [min, maxInclusive]. */
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  sign(): 1 | -1;
  /** Symmetric jitter in [-amount, amount]. */
  jitter(amount: number): number;
  /**
   * An independent child stream. It depends only on the original seed and `salt`,
   * never on how many numbers were drawn, so adding a draw elsewhere can't shift it.
   */
  fork(salt: number): Rng;
}

/** mulberry32 generator wrapped in a small helper API. */
export function makeRng(seed: number): Rng {
  const origin = seed >>> 0;
  let state = origin;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    jitter: (amount) => (next() * 2 - 1) * amount,
    fork: (salt) => makeRng(mixSeed(origin, salt)),
  };
}
