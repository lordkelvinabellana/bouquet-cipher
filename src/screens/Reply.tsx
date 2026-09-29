"use client";
import Link from "next/link";
import { useState } from "react";
import { graphemes } from "@/core/text/canon";
import { MAX_GRAPHEMES } from "@/core/text/limits";
import styles from "./unwrap.module.css";

export interface Viewer {
  signedIn: boolean;
  /** It's the viewer's own bouquet. */
  own: boolean;
}

/**
 * Ways to answer a bouquet. If its sender has an account, a reply (a bouquet, or just a
 * card) goes straight to their inbox; otherwise you can send one back by link.
 */
export function ReplyActions({ code, fromName, viewer, replyable }: { code: string; fromName: string | null; viewer: Viewer; replyable: boolean }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const them = fromName ?? "them";

  if (viewer.own) {
    return (
      <Link className={styles.primary} href="/bouquets?tab=sent">
        Your bouquets
      </Link>
    );
  }
  if (!replyable) {
    return (
      <Link className={styles.primary} href={fromName ? `/create?to=${encodeURIComponent(fromName)}` : "/create"}>
        Send one back
      </Link>
    );
  }
  if (!viewer.signedIn) {
    return (
      <Link className={styles.primary} href={`/login?next=${encodeURIComponent(`/b/${code}`)}`}>
        Sign in to reply
      </Link>
    );
  }
  if (state === "sent") {
    return (
      <p className={styles.sent} role="status">
        Your card is in {them === "them" ? "their" : `${them}’s`} inbox.
      </p>
    );
  }
  if (!writing) {
    return (
      <>
        <button type="button" className={styles.ghost} onClick={() => setWriting(true)}>
          Reply with a card
        </button>
        <Link className={styles.primary} href={`/create?reply=${code}`}>
          Reply with a bouquet
        </Link>
      </>
    );
  }

  const count = graphemes(text.trim()).length;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    const res = await fetch("/api/bouquets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "card", message: text, replyTo: code, toName: fromName }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "You seem to be offline." };
    if (!res?.ok) {
      setState("idle");
      setError(data.error ?? "The card couldn't be sent. Please try again.");
      return;
    }
    setState("sent");
  };
  return (
    <form className={styles.cardForm} onSubmit={send}>
      <label htmlFor="card-text" className={styles.cardLabel}>
        A card for {them}
      </label>
      <textarea
        id="card-text"
        className={styles.cardText}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={400}
        placeholder="Thank you, they’re lovely…"
        autoFocus
      />
      <span className={styles.cardFoot}>
        <span className={count > MAX_GRAPHEMES ? styles.over : undefined}>
          {count} / {MAX_GRAPHEMES}
        </span>
        <button type="button" className={styles.ghost} onClick={() => setWriting(false)} disabled={state === "sending"}>
          Cancel
        </button>
        <button type="submit" className={styles.primary} disabled={state === "sending" || !count || count > MAX_GRAPHEMES}>
          {state === "sending" ? "Sending…" : "Send card"}
        </button>
      </span>
      <span className={styles.cardError} role="status">
        {error}
      </span>
    </form>
  );
}
