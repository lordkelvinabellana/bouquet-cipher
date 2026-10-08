"use client";
/**
 * The garden's grid, oldest first. Bouquets she hasn't opened yet are greyed out and the
 * first of them glows ("Start here"), so the story is read in order; each one turns to
 * colour once it's opened. Which ones she's opened lives in a cookie on her device.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { forgetOpened, openedCookie, parseOpened } from "@/lib/opened";
import styles from "../../app/garden/garden.module.css";

export type GardenItem =
  | { kind: "plant"; id: string; title: string; date: string; locked: boolean }
  | { kind: "waiting"; key: string; title: string; date: string | null };

const noSubscription = () => () => {};

export function GardenGrid({ items, opened: initial }: { items: GardenItem[]; opened: string[] }) {
  // the cookie is read on every render, so a visit back shows what's been opened since
  const raw = useSyncExternalStore(noSubscription, openedCookie, () => initial.join("."));
  const opened = useMemo(() => parseOpened(raw), [raw]);
  const router = useRouter();
  // `?fresh` starts the garden over: every bouquet unopened again
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("fresh")) return;
    forgetOpened();
    router.replace("/garden");
  }, [router]);

  const plants = items.filter((i) => i.kind === "plant");
  const nextId = plants.find((p) => !opened.has(p.id))?.id ?? null;
  const allOpened = plants.length > 0 && nextId === null;
  const started = plants.some((p) => opened.has(p.id));

  return (
    <ul className={styles.plants} aria-label="Every bouquet in our garden">
      {items.map((item) =>
        item.kind === "waiting" ? (
          <li key={item.key} className={styles.waiting}>
            <span className={styles.plotCard}>
              <span aria-hidden className={styles.bud} />
              Still growing
            </span>
            <span className={styles.caption}>
              <b>{item.title}</b>
              {item.date ? <span>{item.date}</span> : null}
            </span>
          </li>
        ) : (
          <li key={item.id} data-state={opened.has(item.id) ? "opened" : item.id === nextId ? "next" : "later"}>
            <Link href={`/b/${item.id}`} className={styles.plant} aria-label={`${item.title}${opened.has(item.id) ? ", opened" : item.id === nextId ? ", open this one next" : ""}`}>
              {item.id === nextId ? <span className={styles.startHere}>{started ? "Up next" : "Start here"}</span> : null}
              {/* a small server-drawn picture; private to the garden, so not worth next/image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/b/${item.id}/thumb`} alt="" width={180} height={258} loading="lazy" />
              <span className={styles.caption}>
                <b>{item.title}</b>
                <span>
                  {item.date}
                  {item.locked ? " · locked" : ""}
                </span>
              </span>
            </Link>
          </li>
        ),
      )}
      {/* after the last bouquet, one last thing */}
      <li data-state={allOpened ? "next" : "later"}>
        <Link href="/finale" className={`${styles.plant} ${styles.finaleCard}`}>
          <span className={styles.plotCard}>
            <span aria-hidden className={styles.heartBig}>
              ❤
            </span>
            One last thing
          </span>
          <span className={styles.caption}>
            <b>For you</b>
            <span>after all fifty</span>
          </span>
        </Link>
      </li>
    </ul>
  );
}
