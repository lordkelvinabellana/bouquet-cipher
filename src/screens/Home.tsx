"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cipherOf, growBouquet } from "@/core/bouquet";
import { newCipherKey } from "@/core/cipher";
import { canon } from "@/core/text/canon";
import { LiveBouquet } from "@/render/svg/LiveBouquet";
import { AccountLink } from "@/components/AccountLink";
import styles from "./home.module.css";

const DEMO = ["I love you", "Happy birthday!", "Thinking of you", "You make me smile"];

/** The first demo bouquet's key is fixed, so the server's HTML and the browser agree. */
const FIRST_KEY = "bouquetCipherHomeDemoA";

/**
 * Types the demo messages one letter at a time, holds each, then lets it wilt away.
 * Every message gets a fresh key, so even "I love you" never grows the same way twice.
 */
function useDemo(): { typed: string; key: string } {
  const reduced = useReducedMotion() ?? false;
  const [which, setWhich] = useState(0);
  const [length, setLength] = useState(0);
  const [key, setKey] = useState(FIRST_KEY);
  const text = DEMO[which];
  useEffect(() => {
    if (reduced) return;
    const done = length >= text.length;
    const t = setTimeout(
      () => {
        if (!done) setLength((n) => n + 1);
        else {
          setLength(0);
          setWhich((w) => (w + 1) % DEMO.length);
          setKey(newCipherKey());
        }
      },
      done ? 2800 : text[length] === " " ? 220 : 130,
    );
    return () => clearTimeout(t);
  }, [length, text, reduced]);
  return { typed: reduced ? text : text.slice(0, length), key };
}

export function Home() {
  const { typed, key } = useDemo();
  const cipher = useMemo(() => cipherOf(key), [key]);
  const layout = useMemo(() => growBouquet(canon(typed, "live"), cipher), [typed, cipher]);

  return (
    <main className={styles.page}>
      <div className={styles.account}>
        <AccountLink />
      </div>
      <section className={styles.words}>
        <p className={styles.brand}>Bouquet Cipher</p>
        <h1 className={styles.headline}>Say it with flowers.</h1>
        <p className={styles.body}>
          Type a message and watch it grow into a hand-drawn bouquet. Every vowel becomes a flower, every consonant a leaf, every word a stem.
          Each bouquet has its own secret key, so no two grow alike, even when they say the same thing. Wrap it up and send it: the
          flowers keep your words until the person you send it to opens it here.
        </p>
        <div className={styles.buttons}>
          <Link href="/create" className={styles.primary}>
            Create a bouquet
          </Link>
          <Link href="/decode" className={styles.secondary}>
            Decode a bouquet
          </Link>
        </div>
        <ol className={styles.steps} aria-label="How it works">
          <li>
            <b>Write</b> your message
          </li>
          <li>
            <b>Wrap</b> the bouquet
          </li>
          <li>
            <b>Send</b> the picture or link
          </li>
        </ol>
        <p className={styles.small}>
          Free, and no account needed. Curious how it works? <Link href="/alphabet">Read the floral alphabet</Link>.
        </p>
      </section>

      <section className={styles.demo} aria-label="A bouquet growing as a message is typed">
        <LiveBouquet layout={layout} ribbonSeed={10} className={styles.card} label={`A bouquet spelling “${typed}”`} />
        <p className={styles.note} aria-hidden>
          {typed}
          <span className={styles.caret} />
        </p>
      </section>
    </main>
  );
}
