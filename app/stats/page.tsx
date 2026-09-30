import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EVENTS, type EventName } from "@/lib/events";
import { currentUser } from "@/lib/supabase/server";
import { getStore, type EventCount, type EventDay } from "@/server/store";
import styles from "./stats.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Numbers · Bouquet Cipher", robots: { index: false } };

const RANGES = [7, 30, 90] as const;
const TIME_ZONE = process.env.STATS_TIME_ZONE || "UTC";

/** The site's owners: `ADMIN_EMAILS`, comma-separated. */
function isAdmin(email: string | undefined): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
}

/** The start of the range, and each day in it (YYYY-MM-DD, in the stats time zone). */
function rangeOf(range: number): { since: Date; days: string[] } {
  const now = Date.now();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
  const days = Array.from({ length: range }, (_, i) => day.format(new Date(now - (range - 1 - i) * 86_400_000)));
  return { since: new Date(now - range * 86_400_000), days };
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");
const fmt = (n: number) => n.toLocaleString("en-US");

/** Steps as bars against the first. `ofFirst`: each is a share of the first, not of the step before. */
function Funnel({ title, note, steps, ofFirst = false }: { title: string; note: string; steps: { label: string; value: number }[]; ofFirst?: boolean }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <section className={styles.panel} aria-labelledby={`f-${title}`}>
      <h2 id={`f-${title}`} className={styles.panelTitle}>
        {title}
      </h2>
      <p className={styles.note}>{note}</p>
      <ol className={styles.funnel}>
        {steps.map((s, i) => (
          <li key={s.label}>
            <span className={styles.stepLabel}>{s.label}</span>
            <span className={styles.track}>
              <span className={styles.bar} style={{ width: `${Math.max(1.5, (s.value / top) * 100)}%` }} />
            </span>
            <span className={styles.value}>
              {fmt(s.value)}
              {i > 0 ? (
                <em title={`of ${(ofFirst ? steps[0] : steps[i - 1]).label.toLowerCase()}`}>{pct(s.value, (ofFirst ? steps[0] : steps[i - 1]).value)}</em>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One event per day as bars: one series, so no legend; the title names it. */
function Daily({ title, days, rows, name }: { title: string; days: string[]; rows: EventDay[]; name: EventName }) {
  const by = new Map(rows.filter((r) => r.name === name).map((r) => [r.day, r.total]));
  const values = days.map((d) => by.get(d) ?? 0);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const W = 600;
  const H = 120;
  const gap = 2;
  const w = W / days.length;
  return (
    <figure className={styles.panel}>
      <figcaption className={styles.panelTitle}>
        {title} <span className={styles.muted}>{fmt(total)} in all</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className={styles.chart} role="img" aria-label={`${title} per day`}>
        <line x1={0} x2={W} y1={H} y2={H} className={styles.axis} />
        {values.map((v, i) => {
          const h = v ? Math.max(3, (v / max) * (H - 8)) : 0;
          return (
            <g key={days[i]} className={styles.col}>
              {/* the hit area is the whole column, bigger than the bar */}
              <rect x={i * w} y={0} width={w} height={H} fill="transparent">
                <title>{`${days[i]}: ${fmt(v)}`}</title>
              </rect>
              {h ? <rect x={i * w + gap / 2} y={H - h} width={Math.max(1, w - gap)} height={h} rx={Math.min(4, w / 3)} className={styles.mark} /> : null}
            </g>
          );
        })}
        <text x={0} y={H + 14} className={styles.tick}>
          {days[0]}
        </text>
        <text x={W} y={H + 14} textAnchor="end" className={styles.tick}>
          {days[days.length - 1]}
        </text>
        <text x={0} y={10} className={styles.tick}>
          most in a day: {fmt(total === 0 ? 0 : max)}
        </text>
      </svg>
    </figure>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/stats");
  if (!isAdmin(user.email)) notFound();

  const params = await searchParams;
  const range = RANGES.find((r) => String(r) === params.days) ?? 30;
  const dev = params.dev === "1";
  const { since, days } = rangeOf(range);
  const store = getStore();
  const [counts, daily, kinds, videos] = await Promise.all([
    store.eventCounts(since, dev),
    store.eventDaily(since, ["sent", "open"], dev, TIME_ZONE),
    store.eventBreakdown(since, "sent", "kind", dev),
    store.eventBreakdown(since, "video_make", "reveal", dev),
  ]);
  const by = new Map<string, EventCount>(counts.map((c) => [c.name, c]));
  const total = (n: EventName) => by.get(n)?.total ?? 0;
  const tabs = (n: EventName) => by.get(n)?.sessions ?? 0;

  const cards = kinds.find((k) => k.value === "card")?.total ?? 0;
  const tiles = [
    { label: "Bouquets sent", value: total("sent") - cards, sub: cards ? `plus ${fmt(cards)} ${cards === 1 ? "card" : "cards"}` : "" },
    { label: "Opened", value: total("open"), sub: `${pct(total("open"), total("sent"))} of sends` },
    { label: "Read to the end", value: total("read"), sub: `${pct(total("read"), total("open"))} of opens` },
    { label: "Videos made", value: total("video_make"), sub: videos.length ? videos.map((v) => `${fmt(v.total)} ${v.value === "true" ? "read out" : "mystery"}`).join(", ") : "" },
  ];

  const link = (q: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams();
    const next = { days: range, dev: dev ? "1" : undefined, ...q };
    for (const [k, v] of Object.entries(next)) if (v !== undefined) s.set(k, String(v));
    return `/stats?${s}`;
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <nav className={styles.filters} aria-label="Time range">
          {RANGES.map((r) => (
            <Link key={r} href={link({ days: r })} className={styles.filter} aria-current={r === range ? "page" : undefined}>
              {r} days
            </Link>
          ))}
          <Link href={link({ dev: dev ? undefined : "1" })} className={styles.filter} aria-current={dev ? "page" : undefined}>
            Test traffic
          </Link>
        </nav>
      </header>

      <h1 className={styles.title}>{dev ? "Test traffic" : "The numbers"}</h1>
      <p className={styles.lede}>
        The last {range} days{dev ? " of local and preview runs" : " on the live site"}. No messages, names or addresses are
        recorded, and browsers that ask not to be tracked aren’t. Days are in {TIME_ZONE}.
      </p>

      <div className={styles.tiles}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.tile}>
            <span className={styles.tileLabel}>{t.label}</span>
            <b className={styles.tileValue}>{fmt(t.value)}</b>
            <span className={styles.muted}>{t.sub}</span>
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <Funnel
          title="Sending"
          note="Browser tabs that reached each step."
          steps={[
            { label: "Opened the composer", value: tabs("create_view") },
            { label: "Started writing", value: tabs("write_start") },
            { label: "Wrapped it", value: tabs("wrap") },
            { label: "Sent it", value: tabs("sent") },
          ]}
        />
        <Funnel
          title="Receiving"
          note="Each time a bouquet or card was opened."
          steps={[
            { label: "Opened", value: total("open") },
            { label: "Read to the end", value: total("read") },
            { label: "Started a reply", value: total("reply_start") },
          ]}
        />
        <Daily title="Sent per day" days={days} rows={daily} name="sent" />
        <Daily title="Opened per day" days={days} rows={daily} name="open" />
        <Funnel
          title="Decode it yourself"
          note="Recipients who chose to guess the message."
          steps={[
            { label: "Started", value: total("puzzle_start") },
            { label: "Solved it", value: total("puzzle_solved") },
          ]}
        />
        <Funnel
          title="Sharing"
          note="What people did with a bouquet, as a share of all sends."
          ofFirst
          steps={[
            { label: "Sent", value: total("sent") },
            { label: "Copied the link", value: total("link_copy") },
            { label: "Saved the picture", value: total("picture_save") },
            { label: "Shared a video", value: total("video_share") },
          ]}
        />
      </div>

      <section className={styles.panel} aria-labelledby="all-events">
        <h2 id="all-events" className={styles.panelTitle}>
          Every event
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Times</th>
              <th scope="col">Browser tabs</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(EVENTS) as EventName[]).map((n) => (
              <tr key={n}>
                <th scope="row">
                  {EVENTS[n]} <code>{n}</code>
                </th>
                <td>{fmt(total(n))}</td>
                <td>{fmt(tabs(n))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
