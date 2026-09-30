"use client";
/**
 * The private garden's gate: one secret word, asked once. Also stands in for a locked
 * bouquet's question (the same look, a different question and endpoint).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { budsBouquet } from "@/core/bouquet";
import { LiveBouquet } from "@/render/svg/LiveBouquet";
import styles from "./gate.module.css";

export function Gate({
  next,
  heading,
  text,
  label,
  hint,
  endpoint,
  paper = 1,
  button = "Open the gate",
  welcome = null,
}: {
  /** Where to go once it's open (the gate page); omit to reload this page (a locked bouquet). */
  next?: string;
  heading: string;
  text: string;
  label: string;
  hint?: string | null;
  endpoint: string;
  paper?: number;
  button?: string;
  /** Shown for a moment once the answer is right, before going in. */
  welcome?: string | null;
}) {
  const buds = useMemo(() => budsBouquet(), []);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [shake, setShake] = useState(0);
  const [welcomed, setWelcomed] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    setProblem("");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase: answer, answer }),
    }).catch(() => null);
    if (res?.ok) {
      if (welcome) {
        setWelcomed(true);
        await new Promise((r) => setTimeout(r, 1400));
      }
      // a fresh page load, so the new cookie is sent and nothing stale from before the gate is reused
      if (next) window.location.replace(next);
      else window.location.reload();
      return;
    }
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "You seem to be offline." };
    setProblem(data.error ?? "That's not it. Try again?");
    setShake((n) => n + 1);
    setBusy(false);
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
      </header>
      <div className={styles.body}>
        <LiveBouquet
          layout={buds.layout}
          seal={buds.seal}
          ribbonSeed={buds.ribbonSeed}
          grow={false}
          wrap={{ paper, state: "wrapped" }}
          present
          className={styles.card}
          label="A wrapped bouquet"
        />
        <section className={styles.panel} aria-labelledby="gate-title">
          <h1 id="gate-title" className={styles.heading}>
            {heading}
          </h1>
          <p className={styles.text}>{text}</p>
          <form onSubmit={submit} className={styles.form} key={shake} data-shake={shake ? "" : undefined}>
            <label className={styles.field}>
              <span>{label}</span>
              <input
                className={styles.input}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                maxLength={200}
              />
            </label>
            {hint ? <p className={styles.hint}>Hint: {hint}</p> : null}
            <button type="submit" className={styles.primary} disabled={busy || !answer.trim()}>
              {busy ? "One moment…" : button}
            </button>
          </form>
          <p className={welcomed ? styles.welcome : styles.problem} role="status" aria-live="polite">
            {welcomed ? welcome : problem}
          </p>
        </section>
      </div>
    </main>
  );
}
