"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { track } from "@/lib/track";
import styles from "./signin.module.css";

const ERRORS: Record<string, string> = {
  link: "That link has expired or was already used. Please try again.",
  provider: "Signing in with Google didn't finish. Please try again.",
};

type Mode = "signin" | "signup" | "forgot";

/** Supabase's messages, in the app's words. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/already registered|already exists/i.test(message)) return "There's already an account with that email. Sign in instead.";
  if (/password should be at least/i.test(message)) return "Your password needs at least 6 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many tries just now. Wait a minute and try again.";
  if (/email not confirmed/i.test(message)) return "Check your email to confirm your account first.";
  return "Something went wrong. Please try again.";
}

/**
 * Sign in with an email and a password (or make an account on the spot), or Google when
 * it's switched on. Accounts are optional: everyone can make and read bouquets without one.
 */
export function SignIn({ next, google, error }: { next: string; google: boolean; error?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(error ? (ERRORS[error] ?? "") : "");
  const [notice, setNotice] = useState("");

  const done = () => {
    router.replace(next);
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setProblem("");
    setNotice("");
    const auth = supabaseBrowser().auth;
    if (mode === "signin") {
      const { error: err } = await auth.signInWithPassword({ email: address, password });
      if (err) setProblem(friendly(err.message));
      else {
        track("signin");
        return done();
      }
    } else if (mode === "signup") {
      const { data, error: err } = await auth.signUp({
        email: address,
        password,
        options: {
          data: name.trim() ? { full_name: name.trim().slice(0, 40) } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });
      if (err) setProblem(friendly(err.message));
      else if (data.session) {
        track("signup");
        return done();
      }
      else setNotice(`Almost there: we sent a link to ${address} to confirm it's you.`);
    } else {
      const { error: err } = await auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/reset")}`,
      });
      if (err) setProblem(friendly(err.message));
      else setNotice(`If there's an account for ${address}, a link to choose a new password is on its way.`);
    }
    setBusy(false);
  };

  const withGoogle = async () => {
    setBusy(true);
    setProblem("");
    const { error: err } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) {
      setBusy(false);
      setProblem(ERRORS.provider);
    }
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setProblem("");
    setNotice("");
  };

  const title = mode === "signin" ? "Sign in" : mode === "signup" ? "Create an account" : "Forgot your password?";
  const action = mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send me a link";

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
      </header>
      <section className={styles.card} aria-labelledby="signin-title">
        <h1 id="signin-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.text}>
          {mode === "forgot"
            ? "We’ll email you a link to choose a new one."
            : "Keep the bouquets you send and receive, and reply straight to someone’s inbox."}
        </p>
        <form onSubmit={submit} className={styles.stack}>
          {mode === "signup" ? (
            <label className={styles.field}>
              <span>Your name</span>
              <input className={styles.input} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="shown on your bouquets" />
            </label>
          ) : null}
          <label className={styles.field}>
            <span>Email</span>
            <input className={styles.input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </label>
          {mode !== "forgot" ? (
            <label className={styles.field}>
              <span>Password</span>
              <input
                className={styles.input}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={mode === "signup" ? "at least 6 characters" : ""}
              />
            </label>
          ) : null}
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? "One moment…" : action}
          </button>
        </form>
        <p className={styles.switch}>
          {mode === "signin" ? (
            <>
              <button type="button" className={styles.textButton} onClick={() => switchTo("signup")}>
                Create an account
              </button>
              <button type="button" className={styles.textButton} onClick={() => switchTo("forgot")}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" className={styles.textButton} onClick={() => switchTo("signin")}>
              {mode === "signup" ? "I already have an account" : "Back to sign in"}
            </button>
          )}
        </p>
        {google && mode !== "forgot" ? (
          <>
            <p className={styles.or}>or</p>
            <button type="button" className={styles.google} onClick={withGoogle} disabled={busy}>
              <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden>
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </button>
          </>
        ) : null}
        <p className={styles.problem} role="status" aria-live="polite">
          {problem || notice}
        </p>
      </section>
      <p className={styles.small}>
        No account needed to send or read bouquets: <Link href="/create">make one now</Link>.
      </p>
    </main>
  );
}
