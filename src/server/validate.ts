/** Validation for incoming bouquets. Mirrors the composer's limits exactly. */
import { isCipherKey, newCipherKey } from "@/core/cipher";
import { ID_PATTERN, newCode } from "@/core/code";
import { PAPER_COUNT } from "@/core/art/wrap";
import { canon, graphemes } from "@/core/text/canon";
import { measure, MAX_GRAPHEMES, MAX_STEM_GRAPHEMES } from "@/core/text/limits";

export const MAX_NAME_GRAPHEMES = 40;
const MAX_RAW_LENGTH = 2000;

export type BouquetKind = "bouquet" | "card";

export interface NewBouquet {
  /** A bouquet of flowers, or a simple card (a reply that's just words). */
  kind: BouquetKind;
  message: string;
  salt: number;
  /** Wrapping paper, 0..PAPER_COUNT-1. */
  paper: number;
  /** The bouquet's secret key (see core/cipher.ts). */
  cipherKey: string;
  /** The sender's signature seal, if they have one. */
  seal: number | null;
  toName: string | null;
  fromName: string | null;
  /** The bouquet this answers, if it's a reply. */
  replyTo: string | null;
  /** The sender's seal style (set by the server from their account, never the request). */
  sealStyle?: string | null;
  /** A photo tucked in with the letter (a name from POST /api/photos). */
  photo?: string | null;
  /** A secret question it waits behind, and the answer (hashed by the server before saving). */
  lock?: { question: string; answer: string } | null;
  /** Planted in "Our garden" (asked for by the composer; the server decides). */
  garden?: boolean;
  /** Which month of the garden it's planted in (0 is the first month), if not the current one. */
  month?: number | null;
  /** Made by a local run, a test or a preview deployment, not the live site (set by the server). */
  test?: boolean;
  /** The lock's answer, salted and hashed (set by the server from `lock`). */
  lockHash?: string | null;
}

export const PHOTO_NAME = /^[a-z0-9]{24}\.jpg$/;
export const MAX_QUESTION = 120;
export const MAX_ANSWER = 60;

export type Validated = { ok: true; value: NewBouquet } | { ok: false; error: string };

export function cleanName(v: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string" || v.length > 400) return { ok: false, error: `${label} must be a short piece of text.` };
  const name = canon(v.replace(/[\r\n]+/g, " "));
  if (!name) return { ok: true, value: null };
  if (graphemes(name).length > MAX_NAME_GRAPHEMES) return { ok: false, error: `${label} can be at most ${MAX_NAME_GRAPHEMES} characters.` };
  return { ok: true, value: name };
}

export function validateNewBouquet(body: unknown): Validated {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Expected a JSON object." };
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string" || b.message.length > MAX_RAW_LENGTH) return { ok: false, error: "A message is required." };
  const kind = b.kind === undefined ? "bouquet" : b.kind;
  if (kind !== "bouquet" && kind !== "card") return { ok: false, error: "Invalid kind." };
  const message = canon(b.message);
  if (!message) return { ok: false, error: "The message is empty." };
  // (matches the database's own cap on code points; emoji and accents take several each)
  if ([...message].length > MAX_RAW_LENGTH) return { ok: false, error: "That message is too long." };
  const report = measure(message);
  if (report.tooLong) return { ok: false, error: `Messages can be at most ${MAX_GRAPHEMES} characters.` };
  // (a card isn't made of stems, so only a bouquet minds long words)
  if (report.stemTooLong && kind === "bouquet") return { ok: false, error: `Words can be at most ${MAX_STEM_GRAPHEMES} characters.` };
  const salt = b.salt === undefined ? 0 : b.salt;
  if (typeof salt !== "number" || !Number.isInteger(salt) || salt < 0 || salt > 0x7fffffff) return { ok: false, error: "Invalid arrangement." };
  const paper = b.paper === undefined ? 0 : b.paper;
  if (typeof paper !== "number" || !Number.isInteger(paper) || paper < 0 || paper >= PAPER_COUNT) return { ok: false, error: "Invalid wrapping paper." };
  // Every bouquet gets its own key; one is made here if the sender didn't bring one.
  if (b.key !== undefined && b.key !== null && !isCipherKey(b.key)) return { ok: false, error: "Invalid bouquet key." };
  const cipherKey = isCipherKey(b.key) ? b.key : newCipherKey();
  const seal = b.seal === undefined || b.seal === null ? null : b.seal;
  if (seal !== null && (typeof seal !== "number" || !Number.isInteger(seal) || seal < 0 || seal > 0xffffffff)) {
    return { ok: false, error: "Invalid seal." };
  }
  const to = cleanName(b.toName, "The recipient's name");
  if (!to.ok) return to;
  const from = cleanName(b.fromName, "Your name");
  if (!from.ok) return from;
  if (b.replyTo !== undefined && b.replyTo !== null && (typeof b.replyTo !== "string" || !ID_PATTERN.test(b.replyTo))) {
    return { ok: false, error: "Invalid reply." };
  }
  const replyTo = typeof b.replyTo === "string" ? b.replyTo : null;
  if (b.photo !== undefined && b.photo !== null && (typeof b.photo !== "string" || !PHOTO_NAME.test(b.photo))) return { ok: false, error: "Invalid photo." };
  const photo = typeof b.photo === "string" ? b.photo : null;
  let lock: NewBouquet["lock"] = null;
  if (b.lock !== undefined && b.lock !== null) {
    const l = b.lock as Record<string, unknown>;
    const question = typeof l.question === "string" ? canon(l.question.replace(/[\r\n]+/g, " ")) : "";
    const answer = typeof l.answer === "string" ? l.answer.trim() : "";
    if (!question || graphemes(question).length > MAX_QUESTION) return { ok: false, error: `The question needs to be 1 to ${MAX_QUESTION} characters.` };
    if (!answer || answer.length > MAX_ANSWER) return { ok: false, error: `The answer needs to be 1 to ${MAX_ANSWER} characters.` };
    lock = { question, answer };
  }
  const month = b.month === undefined || b.month === null ? null : b.month;
  if (month !== null && (typeof month !== "number" || !Number.isInteger(month) || month < 0 || month > 1200)) return { ok: false, error: "Invalid month." };
  return { ok: true, value: { kind, message, salt, paper, cipherKey, seal, toName: to.value, fromName: from.value, replyTo, photo, lock, month, garden: b.garden === true } };
}

export { ID_PATTERN };

/** A fresh bouquet code (see core/code.ts). */
export function newBouquetId(): string {
  return newCode();
}
