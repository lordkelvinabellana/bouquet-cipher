"use client";
/**
 * The little ♪ control in the corner once the garden's music has started: pause or play,
 * and skip to the next song. It lives in the root layout, so it (and the song) stays put
 * from page to page.
 */
import { useEffect, useSyncExternalStore } from "react";
import { musicState, next, serverMusicState, subscribeMusic, toggleMusic } from "@/lib/music";
import styles from "./music.module.css";

export function MusicPlayer() {
  const music = useSyncExternalStore(subscribeMusic, musicState, serverMusicState);
  const shown = music.started && !!music.songs?.length;
  useEffect(() => {
    // pages can make room for it (see garden.module.css)
    if (shown) document.documentElement.dataset.music = "";
    else delete document.documentElement.dataset.music;
  }, [shown]);
  if (!shown) return null;
  const title = music.songs![music.index]?.title ?? "";
  return (
    <div className={styles.player} role="group" aria-label="Music">
      <button
        type="button"
        className={styles.play}
        onClick={toggleMusic}
        aria-label={music.playing ? `Pause the music (${title})` : `Play the music (${title})`}
        title={title}
      >
        {music.playing ? (
          <span className={styles.bars} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span aria-hidden>♪</span>
        )}
      </button>
      {music.songs!.length > 1 ? (
        <button type="button" className={styles.skip} onClick={next} aria-label="Next song" title="Next song">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M3 3.2v9.6L10 8zM11.2 3h1.8v10h-1.8z" fill="currentColor" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
