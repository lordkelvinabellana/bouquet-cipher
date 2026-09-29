"use client";
/**
 * The recipient's journey. Opening the link is all it takes: every step plays on its
 * own, and the buttons are there to skip ahead.
 *   arrive     the wrapped bouquet and "Kel sent you a bouquet"
 *   unwrapping the paper swings away and the bunch relaxes open
 *   envelope   a little card sealed with the bouquet's own wax seal
 *   opening    the flap lifts and the letter slides out
 *   reading    each flower lights up in turn and its letter is written on the card
 *   read       the whole message, signed, with ways to reply
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { FRAME, sealShapes } from "@/core/art/scenery";
import { SHARE_FRAME } from "@/core/art/tag";
import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { readingSequence, stepPause } from "@/core/reveal/sequence";
import { cameraMatrix, presentedCamera, sceneGroups } from "@/core/scene/scene";
import { apply } from "@/core/art/geom";
import { exportPng, shareOrDownload } from "@/render/canvas/exportPng";
import { LiveBouquet } from "@/render/svg/LiveBouquet";
import { AccountLink } from "@/components/AccountLink";
import { Paths } from "@/render/svg/Paths";
import { Inked, LINGER, useAutoAdvance } from "./letter";
import { ReplyActions, type Viewer } from "./Reply";
import styles from "./unwrap.module.css";

type Phase = "arrive" | "unwrapping" | "envelope" | "opening" | "reading" | "read";

export interface UnwrapProps {
  code: string;
  message: string;
  salt: number;
  paper: number;
  /** The bouquet's key (null for bouquets made before keys). */
  cipherKey: string | null;
  /** The sender's signature seal, if any. */
  senderSeal: number | null;
  toName: string | null;
  fromName: string | null;
  /** Who's looking, and whether its sender can be answered in their inbox. */
  viewer: Viewer;
  replyable: boolean;
}

/** Reading pace, a touch quicker than the composer's reveal so longer notes don't drag. */
const PACE = 0.8;

/** A signed-in visitor opened it: keep it in their Received gallery, or mark it read. */
export function useSeen(code: string, viewer: Viewer) {
  useEffect(() => {
    if (viewer.signedIn && !viewer.own) fetch(`/api/bouquets/${code}/seen`, { method: "POST" }).catch(() => {});
  }, [code, viewer.signedIn, viewer.own]);
}

export function Unwrap({ code, message, salt, paper, cipherKey, senderSeal, toName, fromName, viewer, replyable }: UnwrapProps) {
  const reduced = useReducedMotion() ?? false;
  const cipher = useMemo(() => cipherOf(cipherKey), [cipherKey]);
  const layout = useMemo(() => growBouquet(message, cipher, salt), [message, cipher, salt]);
  const signature = useMemo(() => sealOf(senderSeal, message, cipher, salt), [senderSeal, message, cipher, salt]);
  const ribbonSeed = ribbonSeedOf(cipher, salt);
  const steps = useMemo(() => readingSequence(layout, cipher), [layout, cipher]);
  const camera = useMemo(() => presentedCamera(layout), [layout]);
  const seal = useMemo(() => sealShapes([0, 0], signature), [signature]);

  const [phase, setPhase] = useState<Phase>("arrive");
  useSeen(code, viewer);
  const [read, setRead] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);

  // The flap lifts, the letter slides out, then the writing starts.
  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("reading"), reduced ? 0 : 1500);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  // Each flower glows in turn and its letter joins the note.
  useEffect(() => {
    if (phase !== "reading" || paused) return;
    if (read >= steps.length) {
      const t = setTimeout(() => setPhase("read"), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRead((r) => r + 1), (reduced ? 0.05 : stepPause(steps[read]) * PACE) * 1000);
    return () => clearTimeout(t);
  }, [phase, paused, read, steps, reduced]);

  const unwrap = useCallback(() => setPhase((p) => (p === "arrive" ? "unwrapping" : p)), []);
  const onUnwrapped = useCallback(() => setPhase((p) => (p === "unwrapping" ? "envelope" : p)), []);
  const openEnvelope = useCallback(() => setPhase((p) => (p === "envelope" ? "opening" : p)), []);
  useAutoAdvance(phase === "arrive", reduced ? LINGER.arrive / 2 : LINGER.arrive, unwrap);
  useAutoAdvance(phase === "envelope", reduced ? LINGER.envelope / 2 : LINGER.envelope, openEnvelope);
  const readAgain = () => {
    setRead(0);
    setPaused(false);
    setPhase("reading");
  };

  const current = phase === "reading" && read > 0 ? steps[read - 1] : undefined;
  const glowKey = current?.kind === "element" ? current.key : null;
  const written = phase === "read" ? steps.map((s) => s.char).join("") : steps.slice(0, read).map((s) => s.char).join("");
  const chipAt = current?.kind === "element" ? apply(cameraMatrix(camera), [current.focus[0], current.focus[1] - current.r]) : null;
  const chip =
    current?.kind === "element" && chipAt
      ? { left: (chipAt[0] / FRAME.w) * 100, top: (chipAt[1] / FRAME.h) * 100, char: current.char }
      : null;

  const savePicture = async () => {
    setSaving(true);
    try {
      const url = `${window.location.origin}/b/${code}`;
      const blob = await exportPng(sceneGroups(layout, { seal: signature, ribbonSeed, paper, tag: { url, code, toName, fromName } }), {
        height: SHARE_FRAME.h,
      });
      await shareOrDownload(blob, "bouquet.png", undefined, false);
    } finally {
      setSaving(false);
    }
  };

  const wrapped = phase === "arrive" || phase === "unwrapping";
  const letterVisible = !wrapped;
  const heading = fromName ? `${fromName} sent you a bouquet` : "Someone sent you a bouquet";

  return (
    <main className={styles.page} data-phase={phase}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <span className={styles.links}>
          <Link href="/alphabet" className={styles.link}>
            How does this work?
          </Link>
          <AccountLink />
        </span>
      </header>

      <div className={styles.workspace}>
        <div className={styles.cardBox}>
          <LiveBouquet
            layout={layout}
            seal={signature}
            ribbonSeed={ribbonSeed}
            grow={false}
            glow={glowKey}
            wrap={phase === "arrive" ? { paper, state: "wrapped" } : phase === "unwrapping" ? { paper, state: "unwrapping" } : null}
            onUnwrapped={onUnwrapped}
            present
            className={styles.card}
            label={phase === "read" ? `A bouquet that reads: ${message}` : "A bouquet with a hidden message"}
          />
          {chip ? (
            <span key={read} className={styles.chip} style={{ left: `${chip.left}%`, top: `${chip.top}%` }} aria-hidden>
              {chip.char}
            </span>
          ) : null}
        </div>
        <div className={styles.side}>
          <section className={styles.intro} aria-live="polite">
            <h1 className={styles.heading}>{heading}</h1>
            <p className={styles.sub}>
              {wrapped ? (
                <>
                  {toName ? `For ${toName}. ` : ""}There’s a message hidden in these flowers. Let’s see what they say…
                </>
              ) : phase === "envelope" ? (
                "A little card was tucked inside…"
              ) : phase === "read" ? (
                "Every flower was a letter. Now you know what they say."
              ) : (
                "Reading the flowers…"
              )}
            </p>
          </section>
          {letterVisible ? (
            <div className={styles.letterArea}>
              {phase === "envelope" || phase === "opening" ? (
                <button
                  type="button"
                  className={styles.envelope}
                  data-open={phase === "opening" ? "" : undefined}
                  onClick={openEnvelope}
                  aria-label="Open the envelope"
                >
                  <span className={styles.envBack} aria-hidden />
                  <span className={styles.envLetter} aria-hidden>
                    <span className={styles.envLines} />
                  </span>
                  <span className={styles.envFront} aria-hidden />
                  <span className={styles.envFlap} aria-hidden />
                  <span className={styles.envSeal} aria-hidden>
                    <svg viewBox="-14 -14 28 28">
                      <Paths shapes={seal} />
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
                  {phase === "read" && fromName ? <p className={styles.signed}>{fromName}</p> : null}
                </article>
              )}
            </div>
          ) : null}
          <div className={styles.actions}>
            {phase === "arrive" ? (
              <button type="button" className={styles.primary} onClick={unwrap}>
                Unwrap it
              </button>
            ) : null}
            {phase === "envelope" ? (
              <button type="button" className={styles.primary} onClick={openEnvelope}>
                Open the envelope
              </button>
            ) : null}
            {phase === "reading" ? (
              <>
                <button type="button" className={styles.ghost} onClick={() => setPaused((p) => !p)}>
                  {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" className={styles.ghost} onClick={() => setPhase("read")}>
                  Show it all
                </button>
              </>
            ) : null}
            {phase === "read" ? (
              <>
                <button type="button" className={styles.ghost} onClick={readAgain}>
                  Read again
                </button>
                <button type="button" className={styles.ghost} onClick={savePicture} disabled={saving}>
                  {saving ? "Saving…" : "Save picture"}
                </button>
                <ReplyActions code={code} fromName={fromName} viewer={viewer} replyable={replyable} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {phase === "read" ? `The flowers say: ${message}` : ""}
      </p>
    </main>
  );
}
