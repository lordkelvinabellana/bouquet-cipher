import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatCode } from "@/core/code";
import { sealShapes } from "@/core/art/scenery";
import { parseSealStyle, sealStyleString } from "@/core/art/seal";
import { SealEditor } from "@/components/SealEditor";
import { currentUser } from "@/lib/supabase/server";
import { Paths } from "@/render/svg/Paths";
import { getStore, type StoredBouquet } from "@/server/store";
import { cleanName } from "@/server/validate";
import styles from "./bouquets.module.css";

export const metadata: Metadata = { title: "Your bouquets · Bouquet Cipher", robots: { index: false } };
// always per visitor (without Supabase keys at build time it would otherwise be prerendered)
export const dynamic = "force-dynamic";

const TABS = [
  { id: "inbox", label: "Inbox", empty: "Nothing yet. When someone replies to a bouquet you sent, it lands here." },
  { id: "received", label: "Received", empty: "Bouquets you open while signed in are kept here." },
  { id: "sent", label: "Sent", empty: "Bouquets you send while signed in are kept here." },
] as const;
type Tab = (typeof TABS)[number]["id"];

const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

async function saveName(form: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) return;
  const name = cleanName(form.get("name"), "Your name");
  if (!name.ok) return;
  await getStore().setDisplayName(user.id, name.value);
  revalidatePath("/bouquets");
}

async function saveSeal(style: string | null) {
  "use server";
  const user = await currentUser();
  if (!user) return;
  const parsed = parseSealStyle(style);
  await getStore().setSealStyle(user.id, parsed ? sealStyleString(parsed) : null);
  revalidatePath("/bouquets");
}

function Item({ b, tab }: { b: StoredBouquet; tab: Tab }) {
  const what = b.kind === "card" ? "a card" : "a bouquet";
  const title =
    tab === "sent"
      ? `${b.kind === "card" ? "Card" : "Bouquet"} to ${b.toName ?? "someone"}`
      : `${b.fromName ?? "Someone"} sent you ${what}`;
  const unread = tab === "inbox" && !b.readAt;
  return (
    <li>
      <Link href={`/b/${b.id}`} className={styles.item} data-unread={unread ? "" : undefined}>
        {/* the thumbnail is a cached PNG made on the server */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/b/${b.id}/thumb`} alt="" width={180} height={258} loading="lazy" className={styles.thumb} />
        <span className={styles.caption}>
          <span className={styles.itemTitle}>
            {unread ? <span className={styles.dot} aria-label="New" /> : null}
            {title}
          </span>
          <span className={styles.meta}>
            {b.replyTo ? "A reply · " : ""}
            {day.format(new Date(b.createdAt))} · {formatCode(b.id)}
            {tab === "sent" && b.recipientId ? " · in their inbox" : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function BouquetsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/bouquets");
  const store = getStore();
  const [me, inbox, received, sent] = await Promise.all([store.profile(user.id), store.inbox(user.id), store.kept(user.id), store.sent(user.id)]);
  const lists: Record<Tab, StoredBouquet[]> = {
    // unread first, then newest
    inbox: [...inbox].sort((a, b) => Number(!!a.readAt) - Number(!!b.readAt)),
    received,
    sent,
  };
  const asked = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.id === asked) ? (asked as Tab) : "inbox";
  const unread = inbox.filter((b) => !b.readAt).length;
  const list = lists[tab];

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <Link href="/create" className={styles.cta}>
          Make a bouquet
        </Link>
      </header>

      <section className={styles.profile} aria-label="Your profile">
        <svg viewBox="-14 -14 28 28" className={styles.seal} aria-hidden>
          <Paths shapes={sealShapes([0, 0], me?.seal ?? 0, 1, parseSealStyle(me?.sealStyle))} />
        </svg>
        <form action={saveName} className={styles.nameForm}>
          <label htmlFor="name" className={styles.nameLabel}>
            Your name on bouquets
          </label>
          <span className={styles.nameRow}>
            <input id="name" name="name" defaultValue={me?.displayName ?? ""} maxLength={60} placeholder="your name" className={styles.nameInput} />
            <button type="submit" className={styles.ghost}>
              Save
            </button>
          </span>
          <span className={styles.meta}>
            {user.email} · your seal is on everything you send
          </span>
        </form>
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.ghost}>
            Sign out
          </button>
        </form>
      </section>

      <SealEditor seal={me?.seal ?? 0} initial={me?.sealStyle ?? null} save={saveSeal} />

      <nav className={styles.tabs} aria-label="Your bouquets">
        {TABS.map((t) => (
          <Link key={t.id} href={`/bouquets?tab=${t.id}`} className={styles.tab} aria-current={t.id === tab ? "page" : undefined}>
            {t.label}
            {t.id === "inbox" && unread ? <span className={styles.badge}>{unread}</span> : null}
            <span className={styles.count}>{lists[t.id].length}</span>
          </Link>
        ))}
      </nav>

      {list.length ? (
        <ul className={styles.grid}>
          {list.map((b) => (
            <Item key={b.id} b={b} tab={tab} />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{TABS.find((t) => t.id === tab)!.empty}</p>
      )}
    </main>
  );
}
