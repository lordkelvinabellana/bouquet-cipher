/**
 * The bouquet key: a 128-bit secret, one per bouquet, that makes every bouquet unique
 * and readable only through the app.
 *
 * From the key come:
 *  - a shuffle for every position in the message (which flower stands for which vowel,
 *    which leaf for which consonant, there and only there; see alphabet/v2.ts);
 *  - the arrangement (the layout's salt) and the colour palette.
 *
 * Everything is derived with SipHash-2-4, a keyed hash built for exactly this: fast,
 * synchronous (so the composer can use it on every keystroke), and without the key its
 * outputs look random. The key is stored with the bouquet on the server, and its link and
 * QR tag point to it; it's never in the picture itself.
 */

const M64 = 0xffffffffffffffffn;
const rotl = (x: bigint, b: bigint) => ((x << b) | (x >> (64n - b))) & M64;

function u64le(bytes: Uint8Array, at: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(bytes[at + i]);
  return v;
}

/** SipHash-2-4 of `msg` under a 16-byte key, as a 64-bit BigInt. */
export function siphash24(key: Uint8Array, msg: Uint8Array): bigint {
  const k0 = u64le(key, 0);
  const k1 = u64le(key, 8);
  let v0 = k0 ^ 0x736f6d6570736575n;
  let v1 = k1 ^ 0x646f72616e646f6dn;
  let v2 = k0 ^ 0x6c7967656e657261n;
  let v3 = k1 ^ 0x7465646279746573n;
  const round = () => {
    v0 = (v0 + v1) & M64;
    v1 = rotl(v1, 13n);
    v1 ^= v0;
    v0 = rotl(v0, 32n);
    v2 = (v2 + v3) & M64;
    v3 = rotl(v3, 16n);
    v3 ^= v2;
    v0 = (v0 + v3) & M64;
    v3 = rotl(v3, 21n);
    v3 ^= v0;
    v2 = (v2 + v1) & M64;
    v1 = rotl(v1, 17n);
    v1 ^= v2;
    v2 = rotl(v2, 32n);
  };
  const len = msg.length;
  const end = len - (len % 8);
  for (let i = 0; i < end; i += 8) {
    const m = u64le(msg, i);
    v3 ^= m;
    round();
    round();
    v0 ^= m;
  }
  let b = BigInt(len & 0xff) << 56n;
  for (let i = 0; i < len % 8; i++) b |= BigInt(msg[end + i]) << BigInt(8 * i);
  v3 ^= b;
  round();
  round();
  v0 ^= b;
  v2 ^= 0xffn;
  round();
  round();
  round();
  round();
  return (v0 ^ v1 ^ v2 ^ v3) & M64;
}

// ——— keys as text ———

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const KEY_BYTES = 16;
const KEY_PATTERN = /^[A-Za-z0-9_-]{21}[AQgw]$/;

function toB64url(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let acc = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64[(acc >> bits) & 63];
    }
  }
  if (bits > 0) out += B64[(acc << (6 - bits)) & 63];
  return out;
}

function fromB64url(s: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of s) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** A fresh random key, as 22 url-safe characters. */
export function newCipherKey(): string {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  return toB64url(bytes);
}

/** Is this a well-formed key (exactly 16 bytes of url-safe base64)? */
export function isCipherKey(s: unknown): s is string {
  return typeof s === "string" && KEY_PATTERN.test(s);
}

// ——— what a key gives a bouquet ———

/** Domain tags keep each use of the key independent. */
const TAG = { shift: 0x46, salt: 0x53, palette: 0x50, seal: 0x57 } as const;

function derive(key: Uint8Array, tag: number, i = 0): number {
  return Number(siphash24(key, Uint8Array.of(tag, i & 0xff, (i >>> 8) & 0xff)) & 0xffffffffn);
}

export interface Cipher {
  key: string;
  /** The shuffle at position `i` of the message (a 32-bit number). */
  shift(i: number): number;
  /** Seed for the arrangement. */
  salt: number;
  /** Which colour palette the bouquet wears. */
  palette: number;
}

export function cipherFor(key: string, paletteCount: number): Cipher {
  if (!isCipherKey(key)) throw new Error("Not a bouquet key.");
  const bytes = fromB64url(key);
  const shifts = new Map<number, number>();
  return {
    key,
    shift(i) {
      let s = shifts.get(i);
      if (s === undefined) {
        s = derive(bytes, TAG.shift, i);
        shifts.set(i, s);
      }
      return s;
    },
    salt: derive(bytes, TAG.salt) & 0x7fffffff,
    palette: derive(bytes, TAG.palette) % paletteCount,
  };
}

/**
 * A sender's signature seal: a 32-bit pattern number derived from their private secret
 * (kept on their device). Every bouquet they send carries the same seal, but the seal
 * can't be turned back into the secret.
 */
export function sealFromSecret(secret: string): number {
  return derive(fromB64url(secret), TAG.seal);
}
