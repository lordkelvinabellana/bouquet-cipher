/**
 * The garden's music: one audio element for the whole visit, so a song keeps playing as she
 * moves from bouquet to bouquet. Phones only let sound start from a tap, so it starts from
 * one ("Unwrap it" on the first bouquet she opens) and then plays the songs in order, round
 * and round. Browser only.
 */
import type { Song } from "@/server/store";

export interface MusicState {
  /** The songs, once asked for (null while loading, [] when there are none). */
  songs: Song[] | null;
  /** Started this visit (from a tap), whether or not it's paused now. */
  started: boolean;
  playing: boolean;
  index: number;
}

/** A moment of silence: playing it from the tap unlocks the element before the songs arrive. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const MUTED = "bc-music-off";

let state: MusicState = { songs: null, started: false, playing: false, index: 0 };
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let loading: Promise<Song[]> | null = null;

function set(next: Partial<MusicState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function element(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("ended", () => {
    if (audio?.src !== SILENCE) next();
  });
  audio.addEventListener("play", () => set({ playing: true }));
  audio.addEventListener("pause", () => set({ playing: false }));
  return audio;
}

/** The music was switched off on this device before (so nothing waits for a tap to start it). */
export function mutedBefore(): boolean {
  try {
    return localStorage.getItem(MUTED) === "1";
  } catch {
    return false;
  }
}

function remember(off: boolean) {
  try {
    if (off) localStorage.setItem(MUTED, "1");
    else localStorage.removeItem(MUTED);
  } catch {}
}

/** Ask for the song list (once). Safe to call early, e.g. when a bouquet page opens. */
export function loadMusic(): Promise<Song[]> {
  loading ??= fetch("/api/music")
    .then((r) => (r.ok ? (r.json() as Promise<Song[]>) : []))
    .catch(() => [] as Song[])
    .then((songs) => {
      set({ songs });
      return songs;
    });
  return loading;
}

function play(index: number) {
  const songs = state.songs;
  if (!songs?.length) return;
  const a = element();
  const i = ((index % songs.length) + songs.length) % songs.length;
  set({ index: i });
  a.src = songs[i].src;
  a.play().catch(() => set({ playing: false }));
}

/** Start the music. Call it straight from a tap (the browser insists). Only the first call counts. */
export function startMusic() {
  if (state.started || state.songs?.length === 0) return;
  set({ started: true });
  if (mutedBefore()) return;
  if (state.songs?.length) return play(0);
  // the songs aren't here yet: unlock the element now, while we still have the tap
  const a = element();
  a.src = SILENCE;
  a.play().catch(() => {});
  loadMusic().then((songs) => songs.length && !mutedBefore() && play(0));
}

export function toggleMusic() {
  const a = element();
  if (state.playing) {
    a.pause();
    remember(true);
  } else {
    remember(false);
    if (!a.src || a.src === SILENCE) play(state.index);
    else a.play().catch(() => {});
  }
}

export function next() {
  play(state.index + 1);
}

export function subscribeMusic(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const musicState = () => state;
const SERVER: MusicState = { songs: null, started: false, playing: false, index: 0 };
export const serverMusicState = () => SERVER;
