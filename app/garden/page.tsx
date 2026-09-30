import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dayIn, daysBetween, isMonthsary, monthsaryOf, monthsBetween, parseDay, yearsAndMonths, type Day } from "@/core/together";
import { FLAGS } from "@/lib/flags";
import { isDevTraffic } from "@/server/analytics";
import { monthTitle, PERSONAL, today as todayInGarden } from "@/server/personal";
import { getStore, type StoredBouquet } from "@/server/store";
import styles from "./garden.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Our garden · Bouquet Cipher", robots: { index: false, follow: false } };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDay = (d: Day) => `${MONTHS[d.m - 1]} ${d.d}, ${d.y}`;
const shortDay = (d: Day) => `${MONTHS[d.m - 1].slice(0, 3)} ${d.d}`;

interface Bed {
  key: string;
  title: string;
  /** When the month began (its monthsary), if the garden knows your date. */
  date: Day | null;
  plants: { b: StoredBouquet; day: Day }[];
}

/**
 * The garden's rows, newest first. With your date, there's one for every month since you
 * started (each letter in the month it was written for, empty months waiting for theirs);
 * without it, one per calendar month that has bouquets.
 */
function beds(list: StoredBouquet[], since: Day | null, now: number | null, timeZone: string): Bed[] {
  const out = new Map<string, Bed>();
  const title = monthTitle;
  if (since && now !== null) {
    for (let month = 0; month <= now; month++) out.set(`m${month}`, { key: `m${month}`, title: title(month), date: monthsaryOf(since, month), plants: [] });
  }
  for (const b of list) {
    const day = dayIn(timeZone, new Date(b.createdAt));
    const month = since ? (b.month ?? Math.max(0, monthsBetween(since, day))) : null;
    const key = month !== null ? `m${month}` : `${day.y}-${day.m}`;
    if (!out.has(key)) {
      out.set(key, month !== null ? { key, title: title(month), date: since ? monthsaryOf(since, month) : null, plants: [] } : { key, title: `${MONTHS[day.m - 1]} ${day.y}`, date: null, plants: [] });
    }
    out.get(key)!.plants.push({ b, day });
  }
  const order = (k: string) => (k.startsWith("m") ? Number(k.slice(1)) : Number(k.replace("-", "")));
  return [...out.values()].sort((x, y) => order(y.key) - order(x.key));
}

export default async function GardenPage() {
  if (!FLAGS.garden) notFound();
  const since = PERSONAL.since ? parseDay(PERSONAL.since) : null;
  const t = todayInGarden();
  const today = parseDay(t.day)!;
  const months = since ? monthsBetween(since, today) : null;
  const monthsary = since ? isMonthsary(since, today) : false;
  // the live site shows only real bouquets; local runs and previews, only their own
  const list = await getStore().garden(isDevTraffic());
  const rows = beds(list, since, months !== null && months >= 0 ? months : null, PERSONAL.timeZone);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <nav className={styles.links}>
          <Link href="/create" className={styles.link}>
            Make a bouquet
          </Link>
          <Link href="/decode" className={styles.link}>
            Open one
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.title}>Our garden</h1>
        {monthsary && t.greeting ? (
          <div className={styles.celebration}>
            <p className={styles.celebrate}>{t.greeting.title}</p>
            <p className={styles.celebrateLine}>{t.greeting.line}</p>
          </div>
        ) : t.nickname ? (
          <p className={styles.hello}>Hi, {t.nickname}.</p>
        ) : null}
        {since && months !== null && months >= 0 ? (
          <p className={styles.count}>
            {months === 0 ? (
              <>
                <b>{daysBetween(since, today)}</b> {daysBetween(since, today) === 1 ? "day" : "days"} together
              </>
            ) : (
              <>
                <b>{months}</b> {months === 1 ? "month" : "months"} together
                {months >= 12 ? <span> · {yearsAndMonths(months)}</span> : null}
              </>
            )}
            <span> · since {longDay(since)}</span>
          </p>
        ) : null}
        <p className={styles.lede}>
          A bouquet for every {PERSONAL.word}, each with a message hidden in its flowers. {list.length ? `${list.length} so far.` : ""}
        </p>
      </section>

      {list.length === 0 && !since ? (
        <section className={styles.empty}>
          <p>Nothing planted yet. The first bouquet you make grows here.</p>
          <Link href="/create" className={styles.primary}>
            Make the first one
          </Link>
        </section>
      ) : (
        rows.map((bed) => (
          <section key={bed.key} className={styles.bed} aria-labelledby={`bed-${bed.key}`}>
            <h2 id={`bed-${bed.key}`} className={styles.bedTitle}>
              {bed.title}
              {bed.date ? <span className={styles.bedDate}>{longDay(bed.date)}</span> : null}
            </h2>
            {bed.plants.length === 0 ? (
              <p className={styles.plot}>
                <span aria-hidden className={styles.bud} />This month’s bouquet is still growing.
              </p>
            ) : null}
            <ul className={styles.plants}>
              {bed.plants.map(({ b, day }) => (
                <li key={b.id}>
                  <Link href={`/b/${b.id}`} className={styles.plant}>
                    {/* a small server-drawn picture; private to the garden, so not worth next/image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/b/${b.id}/thumb`} alt="" width={180} height={258} loading="lazy" />
                    <span className={styles.caption}>
                      <b>{b.fromName ? `From ${b.fromName}` : b.kind === "card" ? "A card" : "A bouquet"}</b>
                      <span>
                        {shortDay(day)}
                        {b.lockHash ? " · locked" : ""}
                        {b.photo ? " · with a photo" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
