/**
 * Bouquet codes: what goes in the link, the QR code, and what people type by hand.
 *
 * Ten characters from Crockford's base32 alphabet (no I, L, O or U, so nothing looks
 * alike), about 50 bits of randomness: short enough to type, far too many to guess.
 * Shown as two groups of five: "K7M2Q-9XWPT".
 */

export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 10;

/** Any id the store may hold (new codes, and earlier development ids). */
export const ID_PATTERN = /^[0-9A-Za-z]{10}$/;

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function newCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 is a multiple of 32, so taking the low five bits is unbiased.
  return Array.from(bytes, (b) => CODE_ALPHABET[b & 31]).join("");
}

export function formatCode(code: string): string {
  return code.length === CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/** Normalise something typed: any case, spaces or dashes, and the look-alikes O→0, I/L→1. */
export function normaliseCode(typed: string): string | null {
  const s = typed
    .toUpperCase()
    .replace(/[\s\-_.·]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return CODE_PATTERN.test(s) ? s : null;
}

/**
 * Read a code from whatever someone has: a typed code, a pasted link, or the text of a
 * scanned QR code (a link). Returns the id to look up, or null.
 */
export function parseCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromLink = text.match(/\/b\/([0-9A-Za-z]{10})(?:[/?#]|$)/);
  if (fromLink) return fromLink[1];
  return normaliseCode(text);
}
