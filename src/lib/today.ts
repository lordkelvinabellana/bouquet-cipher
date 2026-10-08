"use client";
import { useEffect, useState } from "react";

/** See server/personal.ts `today()`. */
export interface Today {
  months: number | null;
  monthsary: boolean;
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

let pending: Promise<Today | null> | null = null;

/** Today in the private garden, fetched once per page load (null when there's no garden). */
export function useToday(enabled = true): Today | null {
  const [today, setToday] = useState<Today | null>(null);
  useEffect(() => {
    if (!enabled) return;
    pending ??= fetch("/api/today")
      .then((r) => (r.ok ? (r.json() as Promise<Today>) : null))
      .catch(() => null);
    let live = true;
    pending.then((t) => live && setToday(t));
    return () => {
      live = false;
    };
  }, [enabled]);
  return today;
}
