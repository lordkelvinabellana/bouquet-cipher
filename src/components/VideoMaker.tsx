"use client";
import { useState } from "react";
import type { Cipher } from "@/core/cipher";
import type { BouquetLayout } from "@/core/layout/v1/layout";
import { downloadBlob } from "@/render/canvas/exportPng";
import type { VideoFile } from "@/render/canvas/exportVideo";
import styles from "./video.module.css";

type State = { at: "idle" } | { at: "making"; done: number } | { at: "ready"; file: VideoFile } | { at: "failed"; why: string };

/**
 * "Make a video": a vertical clip of the bouquet growing, then its flowers read back into
 * the message, or left as a mystery for the viewer to crack. Made on the device.
 */
export function VideoMaker({
  layout,
  cipher,
  seal,
  sealStyle,
  ribbonSeed,
  toName,
  fromName,
  url,
  revealByDefault,
  buttonClass,
  tone = "slate",
}: {
  layout: BouquetLayout;
  cipher: Cipher | null;
  seal: number;
  sealStyle: string | null;
  ribbonSeed: number;
  toName: string | null;
  fromName: string | null;
  url: string;
  /** Recipients show the reading; senders keep the secret by default. */
  revealByDefault: boolean;
  buttonClass: string;
  /** The surface it sits on, for the choice's colours. */
  tone?: "slate" | "cream";
}) {
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(revealByDefault);
  const [state, setState] = useState<State>({ at: "idle" });

  // a new choice needs a new video
  const choose = (next: boolean) => {
    setReveal(next);
    if (next !== reveal) setState({ at: "idle" });
  };

  const make = async () => {
    setState({ at: "making", done: 0 });
    try {
      const { exportVideo } = await import("@/render/canvas/exportVideo");
      const file = await exportVideo(
        { layout, cipher, reveal, seal, sealStyle, ribbonSeed, toName, fromName, link: url.replace(/^https?:\/\//, "") },
        (done) => setState({ at: "making", done }),
      );
      setState({ at: "ready", file });
    } catch (err) {
      setState({ at: "failed", why: err instanceof Error && err.message ? err.message : "The video couldn’t be made. Please try again." });
    }
  };

  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (data: ShareData) => boolean }) : null;
  const shareFile = state.at === "ready" ? new File([state.file.blob], state.file.filename, { type: state.file.blob.type }) : null;
  const canShare = !!shareFile && !!nav?.canShare?.({ files: [shareFile] });

  const share = async () => {
    if (!shareFile || !nav) return;
    try {
      await nav.share({ files: [shareFile], text: reveal ? `Every flower is a letter. ${url}` : `Can you read it? Every flower is a letter. ${url}` });
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") downloadBlob(shareFile, shareFile.name);
    }
  };

  if (!open) {
    return (
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        Make a video
      </button>
    );
  }

  const making = state.at === "making";
  return (
    <section className={styles.panel} data-tone={tone} aria-label="Make a video">
      <p className={styles.title}>A video for Stories and TikTok</p>
      <div className={styles.choice} role="radiogroup" aria-label="What the video shows">
        <label data-on={reveal ? "" : undefined}>
          <input type="radio" name="video-reveal" checked={reveal} onChange={() => choose(true)} disabled={making} />
          Read the message
        </label>
        <label data-on={!reveal ? "" : undefined}>
          <input type="radio" name="video-reveal" checked={!reveal} onChange={() => choose(false)} disabled={making} />
          Keep it a mystery
        </label>
      </div>
      <p className={styles.text}>
        {reveal ? "The bouquet grows, then every flower turns back into its letter." : "The bouquet grows and asks “Can you read it?”, with the link to find out."}
      </p>
      <div className={styles.row}>
        {state.at === "ready" ? (
          <>
            {canShare ? (
              <button type="button" className={buttonClass} onClick={share}>
                Share video…
              </button>
            ) : null}
            <button type="button" className={buttonClass} onClick={() => downloadBlob(state.file.blob, state.file.filename)}>
              Save video
            </button>
          </>
        ) : (
          <button type="button" className={buttonClass} onClick={make} disabled={making}>
            {making ? `Making it… ${Math.round(state.done * 100)}%` : "Create video"}
          </button>
        )}
      </div>
      {making ? (
        <div className={styles.bar} role="progressbar" aria-label="Making the video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.done * 100)}>
          <span style={{ transform: `scaleX(${state.done})` }} />
        </div>
      ) : null}
      <p className={styles.problem} role="status">
        {state.at === "failed" ? state.why : ""}
      </p>
    </section>
  );
}
