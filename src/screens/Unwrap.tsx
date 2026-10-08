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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loadMusic, musicState, mutedBefore, serverMusicState, startMusic, subscribeMusic } from "@/lib/music";
import { markOpened } from "@/lib/opened";
import { useReducedMotion } from "motion/react";
import { FRAME, sealShapes } from "@/core/art/scenery";
import { parseSealStyle } from "@/core/art/seal";
import { SHARE_FRAME } from "@/core/art/tag";
import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { readingSequence, stepPause } from "@/core/reveal/sequence";
import { cameraMatrix, presentedCamera, sceneGroups } from "@/core/scene/scene";
import { apply } from "@/core/art/geom";
import { clock, puzzleOf } from "@/core/puzzle";
import { CSS_EASE, DUR } from "@/anim/motion";
import { track, useTrackOnce } from "@/lib/track";
import { exportPng, shareOrDownload } from "@/render/canvas/exportPng";
import { LiveBouquet } from "@/render/svg/LiveBouquet";
import { AccountLink } from "@/components/AccountLink";
import { VideoMaker } from "@/components/VideoMaker";
import { Paths } from "@/render/svg/Paths";
import { Inked, LINGER, useAutoAdvance } from "./letter";
import { Puzzle, type PuzzleResult } from "./Puzzle";
import { ReplyActions, type Viewer } from "./Reply";
import styles from "./unwrap.module.css";

type Phase = "arrive" | "unwrapping" | "envelope" | "opening" | "reading" | "read" | "puzzle";

export interface UnwrapProps {
  code: string;
  message: string;
  salt: number;
  paper: number;
  /** The bouquet's key (null for bouquets made before keys). */
  cipherKey: string | null;
  /** The sender's signature seal, if any. */
  senderSeal: number | null;
  /** The sender's seal colour and emblem, if they chose one. */
  sealStyle: string | null;
  toName: string | null;
  fromName: string | null;
  /** Who's looking, and whether its sender can be answered in their inbox. */
  viewer: Viewer;
  replyable: boolean;
  /** Start with "decode it yourself". */
  solve?: boolean;
  /** A photo tucked in with the letter (its address), shown once the flowers are read. */
  photo?: string | null;
  /** In the private garden: her nickname, which month it's for, and the bouquets either side. */
  personal?: {
    nickname: string | null;
    occasion: string | null;
    next: { href: string; title: string } | null;
    prev: { href: string; title: string } | null;
  } | null;
}

/** Reading pace: a brisk typing rhythm, so even a long note doesn't drag. */
const PACE = 0.6;

/** A signed-in visitor opened it: keep it in their Received gallery, or mark it read. */
export function useSeen(code: string, viewer: Viewer) {
  useEffect(() => {
    if (viewer.signedIn && !viewer.own) fetch(`/api/bouquets/${code}/seen`, { method: "POST" }).catch(() => {});
  }, [code, viewer.signedIn, viewer.own]);
}

export function Unwrap({ code, message, salt, paper, cipherKey, senderSeal, sealStyle, toName, fromName, viewer, replyable, solve = false, photo = null, personal = null }: UnwrapProps) {
  const reduced = useReducedMotion() ?? false;
  const cipher = useMemo(() => cipherOf(cipherKey), [cipherKey]);
  const layout = useMemo(() => growBouquet(message, cipher, salt), [message, cipher, salt]);
  const signature = useMemo(() => sealOf(senderSeal, message, cipher, salt), [senderSeal, message, cipher, salt]);
  const ribbonSeed = ribbonSeedOf(cipher, salt);
  const steps = useMemo(() => readingSequence(layout, cipher), [layout, cipher]);
  const camera = useMemo(() => presentedCamera(layout), [layout]);
  const seal = useMemo(() => sealShapes([0, 0], signature, 1, parseSealStyle(sealStyle)), [signature, sealStyle]);

  const [phase, setPhase] = useState<Phase>("arrive");
  useSeen(code, viewer);
  useTrackOnce("open", { kind: "bouquet", signedIn: viewer.signedIn, solve }, code);
  const [read, setRead] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  // "decode it yourself": once the paper is off, the puzzle instead of the envelope
  const [wantPuzzle, setWantPuzzle] = useState(solve);
  const [puzzleGlow, setPuzzleGlow] = useState<string | null>(null);
  const [result, setResult] = useState<PuzzleResult | null>(null);
  const [scoreShared, setScoreShared] = useState(false);
  // reaching the end, once, whichever way they got there
  const counted = useRef(false);
  useEffect(() => {
    if (phase !== "read" || counted.current) return;
    counted.current = true;
    track("read", { puzzle: result !== null }, code);
  }, [phase, result, code]);
  const slots = useMemo(() => puzzleOf(layout, cipher), [layout, cipher]);
  const cardRef = useRef<HTMLDivElement>(null);

  // The bouquet steps back to make room for the letter. Rather than animating its size
  // (which redraws the whole picture every frame), it's laid out at the new size at once
  // and glides there from the old one with a transform.
  const lastBox = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const now = el.getBoundingClientRect();
    const was = lastBox.current;
    lastBox.current = now;
    if (!was || reduced || Math.abs(was.width - now.width) < 1) return;
    el.animate(
      [
        { transformOrigin: "0 0", transform: `translate(${was.left - now.left}px, ${was.top - now.top}px) scale(${was.width / now.width})` },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: DUR.slow * 1000, easing: CSS_EASE.inOut },
    );
  }, [phase, reduced]);



  const inGarden = personal !== null;
  // The flap lifts, the letter slides out, then the writing starts.
  useEffect(() => {
    if (phase !== "opening") return;
    const t = setTimeout(() => setPhase("reading"), reduced ? 0 : inGarden ? 1000 : 1500);
    return () => clearTimeout(t);
  }, [phase, reduced, inGarden]);

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
  const onUnwrapped = useCallback(() => setPhase((p) => (p === "unwrapping" ? (wantPuzzle ? "puzzle" : "envelope") : p)), [wantPuzzle]);
  const startPuzzle = () => {
    track("puzzle_start", undefined, code);
    setWantPuzzle(true);
    setPhase((p) => (p === "arrive" ? "unwrapping" : p === "envelope" ? "puzzle" : p));
  };
  const onSolved = useCallback((r: PuzzleResult) => {
    track("puzzle_solved", { guesses: r.guesses, misses: r.misses, seconds: Math.round(r.ms / 1000) }, code);
    setResult(r);
    setPhase("read");
  }, [code]);
  const giveUp = () => {
    track("puzzle_give_up", { guessed: 0 }, code);
    setPuzzleGlow(null);
    setRead(0);
    setPhase("reading");
  };
  const openEnvelope = useCallback(() => setPhase((p) => (p === "envelope" ? "opening" : p)), []);
  // in the garden, one bouquet after another: shorter pauses before it opens itself
  const linger = personal ? { arrive: 1300, envelope: 700 } : LINGER;
  // The garden's music starts from her tap on "Unwrap it" (phones won't start sound any
  // other way), so the first bouquet she opens waits for it; after that they open themselves.
  const music = useSyncExternalStore(subscribeMusic, musicState, serverMusicState);
  useEffect(() => {
    if (inGarden) loadMusic();
  }, [inGarden]);
  // (unless the music was switched off here before)
  const waitForTap = inGarden && !music.started && music.songs?.length !== 0 && !(music.songs && mutedBefore());
  const tapToUnwrap = useCallback(() => {
    if (inGarden) startMusic();
    unwrap();
  }, [inGarden, unwrap]);
  const tapToOpen = useCallback(() => {
    if (inGarden) startMusic();
    openEnvelope();
  }, [inGarden, openEnvelope]);
  useAutoAdvance(phase === "arrive" && !waitForTap, reduced ? linger.arrive / 2 : linger.arrive, unwrap);
  useAutoAdvance(phase === "envelope", reduced ? linger.envelope / 2 : linger.envelope, openEnvelope);
  // the garden greys out the bouquets she hasn't opened yet
  useEffect(() => {
    if (inGarden && phase !== "arrive") markOpened(code);
  }, [inGarden, phase, code]);

  // The photo is fetched as soon as the page opens, so it's ready (never a late flash) by the
  // time it settles onto the bouquet, while the note is still being typed.
  const [photoReady, setPhotoReady] = useState(false);
  useEffect(() => {
    if (!photo) return;
    let live = true;
    const img = new Image();
    img.src = photo;
    img
      .decode()
      .catch(() => {})
      .then(() => live && setPhotoReady(true));
    return () => {
      live = false;
    };
  }, [photo]);
  const photoPhase = phase === "opening" || phase === "reading" || phase === "read";
  const pinned = photoPhase && (photo ? photoReady : !!personal);
  const readAgain = () => {
    setRead(0);
    setPaused(false);
    setPhase("reading");
  };

  const current = phase === "reading" && read > 0 ? steps[read - 1] : undefined;
  const glowKey = phase === "puzzle" ? puzzleGlow : current?.kind === "element" ? current.key : null;
  const written = phase === "read" ? steps.map((s) => s.char).join("") : steps.slice(0, read).map((s) => s.char).join("");

  // the letter just read pops up over its flower while the note types it
  const chipAt = current?.kind === "element" ? apply(cameraMatrix(camera), [current.focus[0], current.focus[1] - current.r * 0.6]) : null;
  const chip = chipAt && current ? { left: (chipAt[0] / FRAME.w) * 100, top: (chipAt[1] / FRAME.h) * 100, char: current.char } : null;

  const shareScore = async () => {
    if (!result) return;
    const text = `I decoded a secret bouquet${fromName ? ` from ${fromName}` : ""} in ${result.guesses} guesses (${clock(result.ms)}). Every flower is a letter. Make one: ${window.location.origin}`;
    try {
      if (typeof navigator.share === "function") await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setScoreShared(true);
    } catch {
      // closed the share sheet
    }
  };

  const savePicture = async () => {
    setSaving(true);
    try {
      const url = `${window.location.origin}/b/${code}`;
      const blob = await exportPng(sceneGroups(layout, { seal: signature, sealStyle, ribbonSeed, paper, tag: { url, code, toName, fromName } }), {
        height: SHARE_FRAME.h,
      });
      await shareOrDownload(blob, "bouquet.png", undefined, false);
    } finally {
      setSaving(false);
    }
  };

  // Share: a clean picture of the wrapped bouquet (the flowers, never the words) to the phone's share sheet
  const [sharing, setSharing] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const sharePicture = async () => {
    setSharing(true);
    track("picture_save", { share: true, from: "unwrap" }, code);
    try {
      const blob = await exportPng(sceneGroups(layout, { seal: signature, sealStyle, ribbonSeed, paper, present: true }));
      await shareOrDownload(blob, "bouquet.png", fromName ? `A bouquet from ${fromName}. Every flower is a letter.` : "Every flower is a letter.");
    } finally {
      setSharing(false);
    }
  };

  const wrapped = phase === "arrive" || phase === "unwrapping";
  const letterVisible = !wrapped;
  const heading = phase === "puzzle" ? "Can you read it?" : fromName ? `${fromName} sent you a bouquet` : "Someone sent you a bouquet";

  return (
    <main className={styles.page} data-phase={phase} data-garden={personal ? "" : undefined}>
      {/* in the garden, the way around lives in the bar at the bottom instead */}
      {!personal ? (
        <header className={styles.top}>
          <Link href="/" className={styles.brand}>
            Bouquet Cipher
          </Link>
          <span className={styles.links}>
            <Link href="/alphabet" className={styles.link}>
              How it works
            </Link>
            <AccountLink />
          </span>
        </header>
      ) : null}

      <div className={styles.workspace}>
        <div ref={cardRef} className={styles.cardBox}>
          <LiveBouquet
            layout={layout}
            seal={signature}
            sealStyle={sealStyle}
            ribbonSeed={ribbonSeed}
            grow={false}
            glow={glowKey}
            wrap={phase === "arrive" ? { paper, state: "wrapped" } : phase === "unwrapping" ? { paper, state: "unwrapping" } : null}
            onUnwrapped={onUnwrapped}
            present
            className={styles.card}
            label={phase === "read" ? `A bouquet that reads: ${message}` : "A bouquet with a hidden message"}
          />
          {chip && !reduced ? (
            <span key={read} className={styles.chip} style={{ left: `${chip.left}%`, top: `${chip.top}%` }} aria-hidden>
              {chip.char}
            </span>
          ) : null}
          {/* the photo settles onto the bouquet as the envelope opens, and stays while the note types */}
          {pinned ? (
            <figure className={styles.pinned} aria-label={photo ? undefined : "A photo is coming"}>
              {photo ? (
                // the sender's own photo, served privately; not worth next/image
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="A photo tucked in with the letter" />
              ) : (
                <span className={styles.photoPlaceholder}>
                  <span aria-hidden>❤</span>a photo of us
                </span>
              )}
            </figure>
          ) : null}
        </div>
        <div className={styles.side}>
          <section className={styles.intro} aria-live="polite">
            {personal?.occasion && phase !== "puzzle" ? <p className={styles.occasion}>{personal.occasion}</p> : null}
            <h1 className={styles.heading}>{heading}</h1>
            <p className={styles.sub}>
              {phase === "puzzle" ? (
                "Every flower is a letter. Guess them to fill in the note; the colours are clues."
              ) : wrapped && wantPuzzle ? (
                "Taking off the paper…"
              ) : wrapped ? (
                <>
                  {personal?.nickname
                    ? `${personal.nickname}, there’s a message hidden in these flowers${fromName ? ` from ${fromName}` : ""}. Let’s see what they say…`
                    : `${toName ? `For ${toName}. ` : ""}There’s a message hidden in these flowers. Let’s see what they say…`}
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
          {phase === "puzzle" ? (
            <div className={styles.letterArea}>
              <Puzzle
                slots={slots}
                cipher={cipher}
                toName={toName}
                reduced={reduced}
                onFocusFlower={setPuzzleGlow}
                onSolved={onSolved}
                onGiveUp={giveUp}
              />
            </div>
          ) : letterVisible ? (
            <div className={styles.letterArea}>
              {phase === "envelope" || phase === "opening" ? (
                <button
                  type="button"
                  className={styles.envelope}
                  data-open={phase === "opening" ? "" : undefined}
                  onClick={tapToOpen}
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
          {/* on phones in the garden, the photo sits below the bouquet and the note instead */}
          {pinned ? (
            <figure className={styles.photoBelow} aria-label={photo ? undefined : "A photo is coming"}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="A photo tucked in with the letter" />
              ) : (
                <span className={styles.photoPlaceholder}>
                  <span aria-hidden>❤</span>a photo of us
                </span>
              )}
            </figure>
          ) : null}
          <div className={styles.actions}>
            {phase === "arrive" ? (
              <button type="button" className={styles.primary} onClick={tapToUnwrap}>
                {waitForTap && music.songs?.length ? "Unwrap it ♪" : "Unwrap it"}
              </button>
            ) : null}
            {phase === "envelope" ? (
              <button type="button" className={styles.primary} onClick={tapToOpen}>
                Open the envelope
              </button>
            ) : null}
            {(phase === "arrive" || phase === "envelope") && !wantPuzzle && !personal ? (
              <button type="button" className={styles.ghost} onClick={startPuzzle}>
                Decode it yourself
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
            {phase === "read" && result ? (
              <p className={styles.score}>
                <span>
                  You decoded it in <b>{result.guesses}</b> {result.guesses === 1 ? "guess" : "guesses"}
                  {result.misses ? `, ${result.misses} wrong` : ", not one wrong"} · {clock(result.ms)}
                </span>
                <button type="button" className={styles.ghost} onClick={shareScore}>
                  {scoreShared ? "Shared" : "Share your score"}
                </button>
              </p>
            ) : null}
            {phase === "read" ? (
              <>
                {canShare ? (
                  <button type="button" className={styles.primary} onClick={sharePicture} disabled={sharing}>
                    {sharing ? "Getting it ready…" : "Share"}
                  </button>
                ) : null}
                {personal?.next ? (
                  <Link className={styles.primary} href={personal.next.href}>
                    {personal.next.href === "/finale" ? "One last thing →" : `Next: ${personal.next.title}`}
                  </Link>
                ) : null}
                <button type="button" className={styles.ghost} onClick={readAgain}>
                  Read again
                </button>
                {/* where the phone can share, Share covers saving too */}
                {!canShare ? (
                  <button type="button" className={styles.ghost} onClick={savePicture} disabled={saving}>
                    {saving ? "Saving…" : "Save picture"}
                  </button>
                ) : null}
                <VideoMaker
                  layout={layout}
                  cipher={cipher}
                  seal={signature}
                  sealStyle={sealStyle}
                  ribbonSeed={ribbonSeed}
                  toName={toName}
                  fromName={fromName}
                  url={`${typeof window === "undefined" ? "" : window.location.origin}/b/${code}`}
                  revealByDefault
                  buttonClass={styles.ghost}
                />
                {/* in the garden, replying happens once, at the very end (the finale) */}
                {!personal ? <ReplyActions code={code} fromName={fromName} viewer={viewer} replyable={replyable} /> : null}
              </>
            ) : null}
          </div>
          {/* the bar waits until the bouquet is open, so it never covers "Unwrap it" */}
          {personal && !wrapped ? (
            <nav className={styles.gardenNav} aria-label="Around our garden">
              {personal.prev ? (
                <Link href={personal.prev.href} className={styles.navLink} title={personal.prev.title}>
                  ← <span>{personal.prev.title.replace(/^Our /, "")}</span>
                </Link>
              ) : (
                <span />
              )}
              <Link href="/garden" className={styles.navHome}>
                Our garden
              </Link>
              {personal.next ? (
                <Link href={personal.next.href} className={styles.navLink} title={personal.next.title}>
                  <span>{personal.next.href === "/finale" ? "One last thing" : personal.next.title.replace(/^Our /, "")}</span> →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {phase === "read" ? `The flowers say: ${message}` : ""}
      </p>
    </main>
  );
}
