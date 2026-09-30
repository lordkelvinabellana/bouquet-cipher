"use client";
/** Pieces shared by the pages that open a bouquet or a card. */
import { useEffect } from "react";
import { graphemes } from "@/core/text/canon";
import styles from "./unwrap.module.css";

/** How long the wrapped bouquet and the sealed card are shown before they open themselves. */
export const LINGER = { arrive: 2600, envelope: 1400 };

/**
 * Call `advance` once the page has been on screen for `ms` while `active`. Time in a
 * background tab doesn't count, so a link opened for later waits until it's looked at.
 */
export function useAutoAdvance(active: boolean, ms: number, advance: () => void) {
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") timer = setTimeout(advance, ms);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [active, ms, advance]);
}

/**
 * The note as it's being written: each letter inks in, but words stay whole so lines
 * only break between words. Keys are positional, so earlier letters never re-animate.
 */
export function Inked({ text }: { text: string }) {
  let n = 0;
  return (
    <>
      {text.split(/(\s+)/).map((token, t) => {
        if (!token) return null;
        if (/^\s+$/.test(token)) return token.includes("\n") ? <br key={t} /> : <span key={t}> </span>;
        return (
          <span key={t} className={styles.word}>
            {Array.from(graphemes(token)).map((g) => (
              <span key={n} data-i={n++} className={styles.inked}>
                {g}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

