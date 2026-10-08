"use client";
/**
 * The last page of the garden: a big bouquet growing letter by letter (it spells your
 * closing words), your photos settling in around it, and a last letter. Petals throughout.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cipherOf, growBouquet, ribbonSeedOf } from "@/core/bouquet";
import { graphemes } from "@/core/text/canon";
import { Petals } from "@/components/Petals";
import { LiveBouquet } from "@/render/svg/LiveBouquet";
import styles from "./finale.module.css";

/** A fixed key, so the finale's bouquet is always the same arrangement. */
const KEY = "OneLastThingForApril0A";
/** Seconds between letters as the bouquet grows. */
const STEP = 0.075;

export function Finale({
  title,
  bouquet,
  note,
  from,
  her,
  photos,
}: {
  title: string;
  bouquet: string;
  note: string | null;
  from: string | null;
  /** What she's called on the bouquet she makes back. */
  her: string | null;
  photos: string[];
}) {
  const cipher = useMemo(() => cipherOf(KEY), []);
  const layout = useMemo(() => growBouquet(bouquet, cipher), [bouquet, cipher]);
  const total = useMemo(() => Array.from(graphemes(bouquet)).length, [bouquet]);
  const [shown, setShown] = useState(0);

  // the bouquet grows, one letter after another
  useEffect(() => {
    if (shown >= total) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 700 : STEP * 1000);
    return () => clearTimeout(t);
  }, [shown, total]);

  const grown = shown >= total;
  const half = Math.ceil(photos.length / 2);

  return (
    <main className={styles.page}>
      <Petals behind />
      <section className={styles.stage} aria-labelledby="finale-title">
        <h1 id="finale-title" className={styles.title}>
          {title}
        </h1>

        <div className={styles.scene}>
          <div className={`${styles.photos} ${styles.left}`}>
            {photos.slice(0, half).map((src, i) => (
              <figure key={src} className={styles.photo} style={{ animationDelay: `${0.6 + i * 0.3}s`, rotate: `${[-7, 4, -3][i % 3]}deg` }}>
                {/* private photos, served behind the gate; not worth next/image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </figure>
            ))}
          </div>
          <LiveBouquet
            layout={layout}
            seal={7}
            ribbonSeed={ribbonSeedOf(cipher)}
            hideFrom={shown}
            className={styles.bouquet}
            label={grown ? `A bouquet that reads: ${bouquet}` : "A bouquet growing"}
          />
          <div className={`${styles.photos} ${styles.right}`}>
            {photos.slice(half).map((src, i) => (
              <figure key={src} className={styles.photo} style={{ animationDelay: `${0.75 + i * 0.3}s`, rotate: `${[6, -4, 3][i % 3]}deg` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
              </figure>
            ))}
          </div>
        </div>

        <p className={styles.spells} data-on={grown ? "" : undefined} aria-hidden={!grown}>
          {bouquet}
        </p>

        {note ? (
          <article className={styles.note} data-on={grown ? "" : undefined}>
            <p className={styles.noteText}>{note}</p>
            {from ? <p className={styles.from}>{from}</p> : null}
          </article>
        ) : null}

        <nav className={styles.actions} data-on={grown ? "" : undefined} aria-label="From here">
          {from ? (
            <Link
              href={`/create?back&to=${encodeURIComponent(from)}${her ? `&from=${encodeURIComponent(her)}` : ""}`}
              className={styles.primary}
            >
              Make one for {from}
            </Link>
          ) : null}
          <Link href="/garden" className={from ? styles.ghost : styles.primary}>
            Back to our garden
          </Link>
          <Link href="/for-april" className={styles.ghost}>
            From the beginning
          </Link>
        </nav>
      </section>
    </main>
  );
}
