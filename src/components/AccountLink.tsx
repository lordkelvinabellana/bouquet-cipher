"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./account.module.css";

interface Me {
  enabled: boolean;
  user: { name: string | null } | null;
  unread: number;
}

/**
 * "Sign in", or "Your bouquets" with the unread count. Fetched after load, so the pages
 * around it can stay static; it simply isn't shown when accounts aren't set up.
 */
export function AccountLink({ tone = "slate" }: { tone?: "slate" | "cream" }) {
  const [me, setMe] = useState<Me | null>(null);
  const path = usePathname();
  useEffect(() => {
    let live = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Me | null) => live && setMe(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [path]);
  if (!me?.enabled) return null;
  const cls = `${styles.link} ${tone === "cream" ? styles.cream : ""}`;
  if (!me.user) {
    return (
      <Link className={cls} href={`/login?next=${encodeURIComponent(path || "/")}`}>
        Sign in
      </Link>
    );
  }
  return (
    <Link className={cls} href="/bouquets" aria-label={me.unread ? `Your bouquets, ${me.unread} new` : "Your bouquets"}>
      Your bouquets
      {me.unread ? <span className={styles.badge}>{me.unread}</span> : null}
    </Link>
  );
}
