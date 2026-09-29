"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./signin.module.css";

export function NewPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem("");
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setProblem(/at least/i.test(error.message) ? "Your password needs at least 6 characters." : "That didn't work. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
      </header>
      <section className={styles.card} aria-labelledby="reset-title">
        <h1 id="reset-title" className={styles.title}>
          New password
        </h1>
        <p className={styles.text}>Choose a new password for your account.</p>
        <form onSubmit={save} className={styles.stack}>
          <label className={styles.field}>
            <span>New password</span>
            <input className={styles.input} type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="at least 6 characters" />
          </label>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
        <p className={styles.problem} role="status">
          {problem}
        </p>
      </section>
    </main>
  );
}
