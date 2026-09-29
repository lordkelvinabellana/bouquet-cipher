"use client";
/**
 * A card: a reply that's just words. The envelope, sealed with the sender's seal, opens
 * by itself and the note is written out; then you can answer it.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { sealShapes } from "@/core/art/scenery";
import { graphemes } from "@/core/text/canon";
import { Paths } from "@/render/svg/Paths";
import { AccountLink } from "@/components/AccountLink";
import { Inked, LINGER, useAutoAdvance } from "./letter";
import { ReplyActions, type Viewer } from "./Reply";
import { useSeen } from "./Unwrap";
import styles from "./unwrap.module.css";

type Phase = "envelope" | "opening" | "reading" | "read";

export interface CardViewProps {
  code: string;
  message: string;
  seal: number;
  toName: string | null;
  fromName: string | null;
  viewer: Viewer;
  replyable: boolean;
}

export function CardView({ code, message, seal, toName, fromName, viewer, replyable }: CardViewProps) {
  const reduced = useReducedMotion() ?? false;
  const letters = useMemo(() => graphemes(message), [message]);
  const shapes = useMemo(() => sealShapes([0, 0], seal), [seal]);
  const [phase, setPhase] = useState<Phase>("envelope");
  const [shown, setShown] = useState(0);
  useSeen(code, viewer);

  const open = useCallback(() => setPhase((p) => (p === "envelope" ? "opening" : p)), []);
  useAutoAdvance(phase === "envelope", reduced ? LINGER.envelope / 2 : LINGER.envelope, open);

  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("reading"), reduced ? 0 : 1500);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  // written out a letter at a time, a little quicker than a bouquet is read
  useEffect(() => {
    if (phase !== "reading") return;
    if (shown >= letters.length) {
      const t = setTimeout(() => setPhase("read"), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((n) => n + 1), reduced ? 5 : letters[shown] === " " ? 90 : 55);
    return () => clearTimeout(t);
  }, [phase, shown, letters, reduced]);

  const heading = fromName ? `${fromName} sent you a card` : "Someone sent you a card";
  const written = phase === "read" ? message : letters.slice(0, shown).join("");

  return (
    <main className={styles.page} data-phase={phase === "read" ? "read" : "reading"}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <AccountLink />
      </header>
      <div className={styles.cardOnly}>
        <section className={styles.intro} aria-live="polite">
          <h1 className={styles.heading}>{heading}</h1>
          <p className={styles.sub}>{phase === "read" ? "A few words, sealed with their seal." : "A little card, just for you…"}</p>
        </section>
        <div className={styles.letterArea}>
          {phase === "envelope" || phase === "opening" ? (
            <button type="button" className={styles.envelope} data-open={phase === "opening" ? "" : undefined} onClick={open} aria-label="Open the envelope">
              <span className={styles.envBack} aria-hidden />
              <span className={styles.envLetter} aria-hidden>
                <span className={styles.envLines} />
              </span>
              <span className={styles.envFront} aria-hidden />
              <span className={styles.envFlap} aria-hidden />
              <span className={styles.envSeal} aria-hidden>
                <svg viewBox="-14 -14 28 28">
                  <Paths shapes={shapes} />
                </svg>
              </span>
            </button>
          ) : (
            <article className={styles.letter} aria-label="The message">
              {toName ? <p className={styles.dear}>Dear {toName},</p> : null}
              <p className={styles.note}>
                <Inked text={written} />
                {phase === "reading" ? <span className={styles.caret} aria-hidden /> : null}
              </p>
              {phase === "read" && fromName ? <p className={styles.signed}>— {fromName}</p> : null}
            </article>
          )}
        </div>
        <div className={styles.actions}>
          {phase === "envelope" ? (
            <button type="button" className={styles.primary} onClick={open}>
              Open the envelope
            </button>
          ) : null}
          {phase === "reading" ? (
            <button type="button" className={styles.ghost} onClick={() => setPhase("read")}>
              Show it all
            </button>
          ) : null}
          {phase === "read" ? <ReplyActions code={code} fromName={fromName} viewer={viewer} replyable={replyable} /> : null}
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {phase === "read" ? `The card says: ${message}` : ""}
      </p>
    </main>
  );
}
