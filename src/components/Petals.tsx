"use client";
/** A soft shower of petals, once (nothing at all with reduced motion). */
import { useMemo } from "react";
import styles from "./celebration.module.css";

/** `behind`: under the page's content (so words stay readable) rather than over it. */
export function Petals({ count = 34, behind = false }: { count?: number; behind?: boolean }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${((i * 37) % 60) / 10}s`,
        duration: `${7 + ((i * 53) % 50) / 10}s`,
        size: `${10 + ((i * 29) % 12)}px`,
        sway: `${((i * 17) % 60) - 30}px`,
        hue: ["#F4B3C6", "#F7C6D4", "#EFA0B8", "#FBE1E8", "#F3C0A6"][i % 5],
      })),
    [count],
  );
  return (
    <div className={styles.petals} data-behind={behind ? "" : undefined} aria-hidden>
      {petals.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.hue,
              animationDelay: p.delay,
              animationDuration: p.duration,
              "--sway": p.sway,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
