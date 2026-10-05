"use client";
/**
 * The special link's first page: petals, the Monthsarudle greeting, a few photos of you
 * two settling in one by one, your note, and the way into the garden. Everything arrives
 * in a gentle order; tapping anywhere brings the rest in at once.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Petals } from "@/components/Petals";
import styles from "./greeting.module.css";

/** The order things arrive in, in seconds. */
const BEATS = { title: 0.4, line: 1.2, photos: 1.8, note: 3.2, enter: 4 };

export function Greeting({
  title,
  line,
  note,
  photos,
}: {
  title: string;
  line: string;
  note: { from: string | null; text: string } | null;
  /** Each frame's photo, or null for a stand-in. */
  photos: (string | null)[];
}) {
  const [hurry, setHurry] = useState(false);
  const beat = (s: number) => ({ animationDelay: hurry ? "0s" : `${s}s` }) as React.CSSProperties;

  // let a tap or a key bring everything in at once
  useEffect(() => {
    const go = () => setHurry(true);
    window.addEventListener("keydown", go, { once: true });
    return () => window.removeEventListener("keydown", go);
  }, []);

  return (
    <main className={styles.page} onClick={() => setHurry(true)} data-hurry={hurry ? "" : undefined}>
      <Petals behind />
      <section className={styles.stage} aria-labelledby="greeting-title">
        <h1 id="greeting-title" className={`${styles.title} ${styles.in}`} style={beat(BEATS.title)}>
          {title}
        </h1>
        <p className={`${styles.line} ${styles.in}`} style={beat(BEATS.line)}>
          {line}
        </p>

        <div className={styles.photos}>
          {photos.map((src, i) => (
            <figure key={i} className={`${styles.photo} ${styles.drop}`} data-i={i} style={beat(BEATS.photos + i * 0.35)}>
              {!src ? (
                <span className={styles.placeholder}>
                  <span aria-hidden className={styles.heart}>❤</span>a photo of us
                </span>
              ) : (
                // private photos, served behind the gate; not worth next/image
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" />
              )}
            </figure>
          ))}
        </div>

        {note ? (
          <article className={`${styles.note} ${styles.in}`} style={beat(BEATS.note)}>
            <p className={styles.noteText}>{note.text}</p>
            {note.from ? <p className={styles.from}>{note.from}</p> : null}
          </article>
        ) : null}

        <Link href="/garden" className={`${styles.enter} ${styles.in}`} style={beat(note ? BEATS.enter : BEATS.note)}>
          Enter our garden
        </Link>
      </section>
    </main>
  );
}
