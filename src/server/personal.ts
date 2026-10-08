import "server-only";
import { dayIn, isMonthsary, monthsBetween, ordinal, parseDay, yearsAndMonths } from "@/core/together";

/**
 * Who the private garden is for, set with environment variables:
 *   FOR_NAME         her name ("April")
 *   NICKNAMES        her nicknames, separated by | ("Mah Lervle|Poruper|Poruper-sang")
 *   FROM_NAME        who it's from, to sign the note ("Kel")
 *   REPLY_EMAIL      where she can email the bouquet she makes for him, from the finale
 *   GATE_HINT        an optional hint shown under the secret word
 *   GATE_ANY_ANSWER  on: any answer opens the gate (a playful gate, see lib/gate.ts)
 *   TOGETHER_SINCE   the day you got together (YYYY-MM-DD), for "months together"
 *   MONTHSARY_WORD   what you call a monthsary ("Monthsarudle"; default "monthsary")
 *   MONTHSARY_LINE   the line under the monthsary greeting (optional)
 *   MONTHSARY_NOTE   a note shown the first time she arrives on a monthsary (optional)
 *   TIME_ZONE        whose calendar the days are counted in (default Asia/Manila)
 *   FINALE_TITLE     the finale's heading (after the last bouquet)
 *   FINALE_BOUQUET   what the finale's big bouquet spells (at most 80 characters)
 *   FINALE_NOTE      the finale's letter
 *   CELEBRATE_MONTH  a fixed Monthsarudle to celebrate (e.g. 50), instead of counting from today
 *   PREVIEW_TODAY    development only: pretend it's this day (YYYY-MM-DD)
 */
const list = (s: string | undefined) =>
  (s ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

export const PERSONAL = {
  name: process.env.FOR_NAME?.trim() || null,
  nicknames: list(process.env.NICKNAMES),
  from: process.env.FROM_NAME?.trim() || null,
  replyEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.REPLY_EMAIL?.trim() ?? "") ? process.env.REPLY_EMAIL!.trim() : null,
  hint: process.env.GATE_HINT?.trim() || null,
  word: process.env.MONTHSARY_WORD?.trim() || "monthsary",
  /** A fixed Monthsarudle, so every number on the site agrees whatever the date. */
  fixedMonth: /^\d{1,4}$/.test(process.env.CELEBRATE_MONTH?.trim() ?? "") ? Number(process.env.CELEBRATE_MONTH!.trim()) : null,
  line: process.env.MONTHSARY_LINE?.trim() || null,
  note: process.env.MONTHSARY_NOTE?.trim() || null,
  finale: {
    title: process.env.FINALE_TITLE?.trim() || "One last thing",
    bouquet: process.env.FINALE_BOUQUET?.trim() || "I love you",
    note: process.env.FINALE_NOTE?.trim() || null,
  },
  timeZone: process.env.TIME_ZONE?.trim() || "Asia/Manila",
  since: /^\d{4}-\d{2}-\d{2}$/.test(process.env.TOGETHER_SINCE?.trim() ?? "") ? process.env.TOGETHER_SINCE!.trim() : null,
};

/** A name that never breaks across lines: "Poruper-sang", "Mah Lervle". */
const keepTogether = (n: string) => n.replace(/ /g, "\u00a0").replace(/-/g, "-\u2060");

/** One of her nicknames (a different one each time), or her name. */
export function nickname(random = Math.random): string | null {
  const all = PERSONAL.nicknames.length ? PERSONAL.nicknames : PERSONAL.name ? [PERSONAL.name] : [];
  return all.length ? keepTogether(all[Math.floor(random() * all.length)]) : null;
}

/** Playful lines for the gate, each with a nickname in it. */
const GATE_LINES = [
  (n: string) => `Psst, ${n}. What's the secret word?`,
  (n: string) => `Hi ${n}! Say the magic word.`,
  (n: string) => `Knock knock, ${n}.`,
  (n: string) => `Only one person gets in here, ${n}.`,
  (n: string) => `Hello, ${n}. Password, please.`,
];

export function gateCopy(random = Math.random) {
  const n = nickname(random);
  return {
    heading: n ? GATE_LINES[Math.floor(random() * GATE_LINES.length)](n) : "A private garden",
    text: n ? "This garden only opens for you." : "The flowers here are only for one person. Say the secret word to come in.",
    label: "The secret word",
    hint: PERSONAL.hint,
    welcome: n ? `You got it, ${n} ❤` : "You got it ❤",
  };
}

export interface Today {
  /** Whole months together (null without TOGETHER_SINCE). */
  months: number | null;
  monthsary: boolean;
  /** "2026-10-09": which day it is, so the petals and the note show once a day. */
  day: string;
  nickname: string | null;
  /** When you got together (YYYY-MM-DD), and what you call a monthsary. */
  since: string | null;
  word: string;
  /** Who the bouquets are from (FROM_NAME), to sign them by default. */
  from: string | null;
  /** Where a bouquet made for him can be emailed (REPLY_EMAIL). */
  replyEmail: string | null;
  greeting: { title: string; line: string } | null;
  note: { from: string | null; text: string } | null;
}

/** What today is for the two of you (behind the gate: the note is private). */
export function today(at = new Date()): Today {
  // development only: PREVIEW_TODAY=2026-10-09 shows what that day looks like
  const preview = process.env.NODE_ENV !== "production" ? parseDay(process.env.PREVIEW_TODAY?.trim() ?? "") : null;
  const day = preview ?? dayIn(PERSONAL.timeZone, at);
  const since = PERSONAL.since ? parseDay(PERSONAL.since) : null;
  const months = PERSONAL.fixedMonth ?? (since ? monthsBetween(since, day) : null);
  const monthsary = !!since && isMonthsary(since, day);
  const n = nickname();
  return {
    months,
    monthsary,
    day: `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`,
    nickname: n,
    since: PERSONAL.since,
    word: PERSONAL.word,
    from: PERSONAL.from,
    replyEmail: PERSONAL.replyEmail,
    greeting:
      monthsary && months
        ? {
            title: `Happy ${ordinal(months)} ${PERSONAL.word}${n ? `, ${n}` : ""}`,
            line: PERSONAL.line ?? `${yearsAndMonths(months)} of us, and I'd choose you in every single one of them.`,
          }
        : null,
    note: monthsary && PERSONAL.note ? { from: PERSONAL.from, text: PERSONAL.note } : null,
  };
}

/** A month of the garden by name: "Our first month", "Our 12th Monthsarudle", every twelfth an anniversary. */
export function monthTitle(month: number): string {
  if (month === 0) return "Our first month";
  if (month % 12 === 0) return `Our ${ordinal(month / 12)} anniversary`;
  return `Our ${ordinal(month)} ${PERSONAL.word}`;
}

/** Which month of the garden a bouquet belongs to (null without a start date). */
export function monthOf(b: { month: number | null; createdAt: string }): number | null {
  const since = PERSONAL.since ? parseDay(PERSONAL.since) : null;
  if (!since) return null;
  return b.month ?? Math.max(0, monthsBetween(since, dayIn(PERSONAL.timeZone, new Date(b.createdAt))));
}

/** The special link's address: "/for-april" (from FOR_NAME, or FOR_SLUG). */
export function specialPath(): string | null {
  const slug = (process.env.FOR_SLUG?.trim() || PERSONAL.name || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `/for-${slug}` : null;
}

/** The greeting for the latest Monthsarudle (whatever day it is), with its line and note. */
export function latestGreeting(): { months: number; title: string; line: string; note: { from: string | null; text: string } | null } | null {
  const t = today();
  if (t.months === null || t.months < 1) return null;
  return {
    months: t.months,
    title: `Happy ${ordinal(t.months)} ${PERSONAL.word}${t.nickname ? `, ${t.nickname}` : ""}`,
    line: PERSONAL.line ?? `${yearsAndMonths(t.months)} of us, and I'd choose you in every single one of them.`,
    note: PERSONAL.note ? { from: PERSONAL.from, text: PERSONAL.note } : null,
  };
}
