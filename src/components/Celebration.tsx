"use client";
/**
 * On a monthsary, the first time she arrives that day: a soft shower of petals, then a
 * note from you. Once a day per device (remembered in this browser only).
 */
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FLAGS } from "@/lib/flags";
import { useToday } from "@/lib/today";
import styles from "./celebration.module.css";

const PETALS = 34;
const seen = (day: string) => `bc-celebrated-${day}`;

export function Celebration() {
  const path = usePathname();
  const today = useToday(FLAGS.garden && path !== "/gate");
  const [show, setShow] = useState<"petals" | "note" | null>(null);

  useEffect(() => {
    if (!today?.monthsary) return;
    let already = false;
    try {
      already = localStorage.getItem(seen(today.day)) === "1";
      localStorage.setItem(seen(today.day), "1");
    } catch {
      // storage blocked: celebrate anyway
    }
    if (already) return;
    // (a one-off reaction to the day's first visit, not derived state)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(today.note ? "note" : "petals");
  }, [today]);

  const petals = useMemo(
    () =>
      Array.from({ length: PETALS }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${((i * 37) % 60) / 10}s`,
        duration: `${7 + ((i * 53) % 50) / 10}s`,
        size: `${10 + ((i * 29) % 12)}px`,
        sway: `${((i * 17) % 60) - 30}px`,
        hue: ["#F4B3C6", "#F7C6D4", "#EFA0B8", "#FBE1E8", "#F3C0A6"][i % 5],
      })),
    [],
  );

  if (!show || !today) return null;
  return (
    <>
      <div className={styles.petals} aria-hidden>
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
      {show === "note" && today.note ? (
        <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="note-title">
          <article className={styles.note}>
            <h2 id="note-title" className={styles.title}>
              {today.greeting?.title ?? "A note for you"}
            </h2>
            <p className={styles.text}>{today.note.text}</p>
            {today.note.from ? <p className={styles.from}>{today.note.from}</p> : null}
            <button type="button" className={styles.button} onClick={() => setShow("petals")} autoFocus>
              Come in
            </button>
          </article>
        </div>
      ) : null}
    </>
  );
}
