"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { glyphName } from "@/core/alphabet/v1";
import { SHARE_FRAME } from "@/core/art/tag";
import { PAPERS } from "@/core/art/wrap";
import { formatCode } from "@/core/code";
import { sealShapes } from "@/core/art/scenery";
import { parseSealStyle } from "@/core/art/seal";
import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { newCipherKey } from "@/core/cipher";
import type { BouquetLayout } from "@/core/layout/v1/layout";
import { FRAME, sceneGroups } from "@/core/scene/scene";
import { MAX_GRAPHEMES } from "@/core/text/limits";
import { useGardenInput } from "@/input/useGardenInput";
import { exportPng, shareOrDownload } from "@/render/canvas/exportPng";
import { VideoMaker } from "@/components/VideoMaker";
import { useSignatureSeal } from "@/identity/signature";
import { AccountLink } from "@/components/AccountLink";
import { LiveBouquet } from "@/render/svg/LiveBouquet";
import { Paths } from "@/render/svg/Paths";
import styles from "./composer.module.css";

type Phase = "write" | "wrap" | "saving" | "shared";

/** A few ways in, for when the blank card is the hard part. */
const STARTERS = ["I'm so proud of you", "Thank you for everything", "Happy birthday! Love you", "Thinking of you today"];

/** Keys already sent with a bouquet in this tab, so going back to the composer never reuses one. */
const spentKeys = new Set<string>();

/** Tell screen readers what just grew, without chattering on every keystroke. */
function useAnnouncement(layout: BouquetLayout): string {
  const [message, setMessage] = useState("");
  const prevCount = useRef(0);
  useEffect(() => {
    const n = layout.elements.length;
    const grew = n > prevCount.current;
    prevCount.current = n;
    const last = layout.elements[n - 1];
    if (!grew || !last) return;
    const t = setTimeout(() => setMessage(`Added a ${glyphName(last.glyph)}.`), 450);
    return () => clearTimeout(t);
  }, [layout]);
  return message;
}

/**
 * `initialKey` comes from the server, so the first render (the empty card and its ribbon)
 * matches between the server's HTML and the browser.
 */
export interface ComposerProps {
  initialTo?: string;
  initialKey: string;
  /** Signed in: the account's seal and name (otherwise the seal is this device's). */
  account?: { seal: number; name: string | null; sealStyle: string | null } | null;
  /** Replying to this bouquet: it goes to its sender's inbox. */
  replyTo?: string | null;
}

export function Composer({ initialTo = "", initialKey, account = null, replyTo = null }: ComposerProps) {
  const { ref, bind, live, final, count, refusal, reset } = useGardenInput();
  const [phase, setPhase] = useState<Phase>("write");
  // Every draft gets its own key: the bouquet you watch grow is the one that's sent.
  const [key, setKey] = useState(() => (spentKeys.has(initialKey) ? newCipherKey() : initialKey));
  const [paper, setPaper] = useState(0);
  const [toName, setToName] = useState(initialTo);
  const [fromName, setFromName] = useState(account?.name ?? "");
  const [shared, setShared] = useState<{ url: string; code: string; delivered: boolean } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [shaking, setShaking] = useState(false);

  const writing = phase === "write";
  const text = writing ? live : final;
  const cipher = useMemo(() => cipherOf(key)!, [key]);
  const layout = useMemo(() => growBouquet(text, cipher), [text, cipher]);
  const deviceSeal = useSignatureSeal();
  const mySeal = account ? account.seal : deviceSeal;
  const seal = !writing && final ? sealOf(mySeal, final, cipher) : undefined;
  const sealStyle = account?.sealStyle ?? null;
  const sealPreview = useMemo(() => (mySeal === null ? null : sealShapes([0, 0], mySeal, 1, parseSealStyle(sealStyle))), [mySeal, sealStyle]);
  const ribbonSeed = ribbonSeedOf(cipher);
  const announcement = useAnnouncement(layout);
  const tag = shared ? { url: shared.url, code: shared.code, toName: toName || null, fromName: fromName || null } : null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (refusal) setShaking(true);
  }, [refusal]);

  const full = count >= MAX_GRAPHEMES;
  const left = MAX_GRAPHEMES - count;
  const startWith = (text: string) => {
    reset(text);
    setTimeout(() => {
      const box = ref.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    }, 0);
  };
  const hint = refusal
    ? refusal.kind === "total"
      ? `Your bouquet is full: ${MAX_GRAPHEMES} characters is the most a card can hold.`
      : "That word is getting long for one stem. Add a space to start another."
    : "";

  const createLink = async () => {
    setPhase("saving");
    setError("");
    try {
      const res = await fetch("/api/bouquets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: final, key, seal: mySeal, paper, toName: toName || null, fromName: fromName || null, replyTo }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; delivered?: boolean };
      if (!res.ok || !data.id) throw new Error(data.error ?? "The bouquet couldn't be saved. Please try again.");
      spentKeys.add(key);
      setShared({ url: `${window.location.origin}/b/${data.id}`, code: data.id, delivered: data.delivered === true });
      setPhase("shared");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("wrap");
    }
  };

  const copyLink = async () => {
    if (!shared) return;
    try {
      await navigator.clipboard.writeText(shared.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  const shareImage = async (share: boolean) => {
    if (!shared || !tag) return;
    setSavingImage(true);
    try {
      const blob = await exportPng(sceneGroups(layout, { seal, sealStyle, ribbonSeed, paper, tag }), { height: SHARE_FRAME.h });
      if (share) await shareOrDownload(blob, "bouquet.png", `${toName ? `A bouquet for ${toName}. ` : ""}Scan the tag or open ${shared.url} to read the flowers.`);
      else await shareOrDownload(blob, "bouquet.png", undefined, false);
    } finally {
      setSavingImage(false);
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const startOver = () => {
    reset("");
    setKey(newCipherKey());
    setShared(null);
    setError("");
    setPhase("write");
    setTimeout(() => ref.current?.focus(), 0);
  };

  const frameH = tag ? SHARE_FRAME.h : FRAME.h;

  return (
    <main className={styles.page} data-wrapped={writing ? undefined : ""}>
      <header className={styles.top}>
        <Link className={styles.brand} href="/">
          Bouquet Cipher
        </Link>
        <span className={styles.links}>
          <Link className={styles.link} href="/alphabet">
            The floral alphabet
          </Link>
          <AccountLink />
        </span>
      </header>

      <div className={styles.workspace}>
        <div className={styles.stage}>
          <LiveBouquet
            layout={layout}
            seal={seal}
            sealStyle={sealStyle}
            ribbonSeed={ribbonSeed}
            wrap={writing ? null : { paper, state: "wrapping" }}
            present={!writing}
            tag={tag}
            className={styles.card}
            style={{ aspectRatio: `${FRAME.w} / ${frameH}`, ["--ratio" as string]: FRAME.w / frameH }}
            label={final ? "Your bouquet so far" : "An empty card, waiting for your message"}
          />
          {writing && count === 0 ? (
            <p className={styles.emptyCard} aria-hidden>
              Your bouquet grows here.
              <span>Every letter becomes a flower or a leaf.</span>
            </p>
          ) : null}
        </div>

        <div className={styles.side}>
          <ol className={styles.progress} aria-label="Steps">
            {(
              [
                ["write", "Write"],
                ["wrap", "Wrap"],
                ["shared", "Send"],
              ] as const
            ).map(([id, label], i) => {
              const at = phase === "saving" ? 1 : ["write", "wrap", "shared"].indexOf(phase);
              const state = i < at ? "done" : i === at ? "current" : "next";
              const go = id === "write" && phase === "wrap" ? () => setPhase("write") : id === "wrap" && phase === "write" && final ? () => setPhase("wrap") : null;
              return (
                <li key={id} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                  {go ? (
                    <button type="button" onClick={go}>
                      {label}
                    </button>
                  ) : (
                    <span>{label}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {/* The writing note stays mounted (just hidden) so its text survives wrapping. */}
          <section className={`${styles.note} ${shaking ? styles.shake : ""}`} onAnimationEnd={() => setShaking(false)} hidden={!writing}>
            <label htmlFor="message" className={styles.srOnly}>
              Your message
            </label>
            {count === 0 ? (
              <p className={styles.prompt}>
                What do you really want them to know? You have {MAX_GRAPHEMES} characters, so make each one count.
              </p>
            ) : null}
            <textarea
              id="message"
              ref={ref}
              className={styles.text}
              placeholder="Type your message…"
              rows={2}
              autoFocus
              spellCheck
              autoComplete="off"
              aria-describedby="message-count message-hint"
              {...bind}
            />
            {count === 0 ? (
              <div className={styles.starters} role="group" aria-label="Start with one of these">
                {STARTERS.map((text) => (
                  <button key={text} type="button" className={styles.starter} onClick={() => startWith(text)}>
                    {text}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.foot}>
              <span id="message-count" className={`${styles.counter} ${full ? styles.counterFull : left <= 10 ? styles.counterLow : ""}`}>
                {count} / {MAX_GRAPHEMES}
              </span>
              <button type="button" className={styles.wrap} disabled={!final} onClick={() => setPhase("wrap")}>
                Wrap it
              </button>
            </div>
            <p id="message-hint" className={`${styles.hint} ${hint ? "" : styles.hintSoft}`} role="status">
              {hint || (left > 0 && left <= 10 ? `${left} left. Short and sweet lands best.` : "")}
            </p>
          </section>

          {phase === "wrap" || phase === "saving" ? (
            <section className={`${styles.note} ${styles.wrapPanel}`} aria-labelledby="wrap-title">
              <h2 id="wrap-title" className={styles.panelTitle}>
                Wrap it up
              </h2>

              <fieldset className={styles.step}>
                <legend className={styles.stepTitle}>Choose the paper</legend>
                <div className={styles.papers}>
                  {PAPERS.map((p, i) => (
                    <label key={p.name} className={`${styles.swatch} ${paper === i ? styles.swatchOn : ""}`}>
                      <input type="radio" name="paper" value={i} checked={paper === i} onChange={() => setPaper(i)} disabled={phase === "saving"} />
                      <span style={{ background: `linear-gradient(135deg, ${p.tone.light}, ${p.tone.base} 55%, ${p.tone.dark})` }} aria-hidden />
                      <em>{p.name}</em>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.step}>
                <h3 className={styles.stepTitle}>Who’s it for?</h3>
                <p className={styles.stepText}>Both names go on the gift tag. You can leave them blank.</p>
                <label className={styles.field}>
                  <span>For</span>
                  <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="their name (optional)" maxLength={60} autoComplete="off" />
                </label>
                <label className={styles.field}>
                  <span>From</span>
                  <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="your name (optional)" maxLength={60} autoComplete="off" />
                </label>
              </div>

              {sealPreview ? (
                <div className={`${styles.step} ${styles.sealStep}`}>
                  <svg viewBox="-14 -14 28 28" className={styles.sealBig} aria-hidden>
                    <Paths shapes={sealPreview} />
                  </svg>
                  <div>
                    <h3 className={styles.stepTitle}>Your wax seal</h3>
                    <p className={styles.stepText}>
                      Pressed onto the ribbon. It’s the same on everything you send {account ? "from your account" : "from this device"}, so they’ll know it’s from you.
                    </p>
                    {account ? (
                      <Link className={styles.inlineLink} href="/bouquets#seal">
                        Change your seal
                      </Link>
                    ) : (
                      <Link className={styles.inlineLink} href={`/login?next=${encodeURIComponent("/bouquets#seal")}`}>
                        Sign in to design your own seal
                      </Link>
                    )}
                  </div>
                </div>
              ) : null}

              <div className={`${styles.step} ${styles.arrangeStep}`}>
                <div>
                  <h3 className={styles.stepTitle}>Arrangement</h3>
                  <p className={styles.stepText}>Same words, new flowers and colours. Every arrangement has its own secret key, so only its link or tag can read it.</p>
                </div>
                <button type="button" className={styles.ghost} onClick={() => setKey(newCipherKey())} disabled={phase === "saving"}>
                  Try another
                </button>
              </div>

              <button type="button" className={`${styles.wrap} ${styles.next}`} onClick={createLink} disabled={phase === "saving"}>
                {phase === "saving" ? "Tying the ribbon…" : replyTo ? "Send reply" : "Create link"}
              </button>
              <button type="button" className={styles.textButton} onClick={() => setPhase("write")} disabled={phase === "saving"}>
                Back to writing
              </button>
              <p className={styles.hint} role="status">
                {error}
              </p>
            </section>
          ) : null}

          {phase === "shared" && shared ? (
            <section className={styles.note} aria-labelledby="share-title">
              <h2 id="share-title" className={styles.panelTitle}>
                {shared.delivered ? "Sent" : "Wrapped and ready"}
              </h2>
              <p className={styles.panelText}>
                {shared.delivered ? (
                  <>
                    It’s waiting in {toName ? `${toName}’s` : "their"} inbox. You can still send the picture or the link, or the code{" "}
                    <b className={styles.code}>{formatCode(shared.code)}</b>.
                  </>
                ) : (
                  <>
                    Send the picture: anyone can scan its tag to open the bouquet. Or send the link, or the code{" "}
                    <b className={styles.code}>{formatCode(shared.code)}</b>.
                  </>
                )}
              </p>
              <div className={styles.linkRow}>
                <input className={styles.linkBox} value={shared.url} readOnly aria-label="Link to your bouquet" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className={styles.wrap} onClick={copyLink}>
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <div className={styles.row}>
                {canShare ? (
                  <button type="button" className={styles.ghost} onClick={() => shareImage(true)} disabled={savingImage}>
                    Share picture…
                  </button>
                ) : null}
                <button type="button" className={styles.ghost} onClick={() => shareImage(false)} disabled={savingImage}>
                  {savingImage ? "Saving…" : "Save picture"}
                </button>
                <a className={styles.ghost} href={shared.url} target="_blank" rel="noopener">
                  Open it
                </a>
                {seal !== undefined ? (
                  <VideoMaker
                    layout={layout}
                    cipher={cipher}
                    seal={seal}
                    sealStyle={sealStyle}
                    ribbonSeed={ribbonSeed}
                    toName={toName.trim() || null}
                    fromName={fromName.trim() || null}
                    url={shared.url}
                    revealByDefault={false}
                    buttonClass={styles.ghost}
                    tone="cream"
                  />
                ) : null}
              </div>
              <button type="button" className={styles.textButton} onClick={startOver}>
                Write another
              </button>
              <p className={styles.hint} role="status">
                {error}
              </p>
            </section>
          ) : null}

        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}
