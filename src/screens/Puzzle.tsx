"use client";
/**
 * "Decode it yourself": the recipient guesses letters, hangman style, and every right
 * guess flies out of its flowers into the note. The bouquet itself is the clue sheet:
 * blooms are vowels, and each leaf colour is its own small set of consonants.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PALETTES } from "@/core/art/palette";
import type { Cipher } from "@/core/cipher";
import {
  CLUE_LETTERS,
  clock,
  hitsFor,
  isSolved,
  type Clue,
  type Slot,
} from "@/core/puzzle";
import { CSS_EASE } from "@/anim/motion";
import styles from "./unwrap.module.css";

export interface PuzzleResult {
  guesses: number;
  misses: number;
  ms: number;
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const STAGGER = 70;
/** How long a letter takes to pop into its place. */
const POP_MS = 380;
const CLUE_NAME: Record<Clue, string> = {
  vowel: "Flower",
  sage: "Leaf",
  blue: "Leaf",
  coral: "Leaf",
};

export function Puzzle({
  slots,
  cipher,
  toName,
  reduced,
  onFocusFlower,
  onSolved,
  onGiveUp,
}: {
  slots: readonly Slot[];
  cipher: Cipher | null;
  toName: string | null;
  reduced: boolean;
  /** Light up a flower on the bouquet (null to stop). */
  onFocusFlower: (key: string | null) => void;
  onSolved: (result: PuzzleResult) => void;
  onGiveUp: () => void;
}) {
  const [guessed, setGuessed] = useState<ReadonlySet<string>>(new Set());
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const [landing, setLanding] = useState<{
    letter: string;
    slots: number[];
  } | null>(null);
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  const note = useRef<HTMLParagraphElement>(null);

  const leaves = PALETTES[cipher?.palette ?? 0]?.leaves ?? PALETTES[0].leaves;
  const colour = (c: Clue) => (c === "vowel" ? "#D9709A" : leaves[c].dark);
  const clues = useMemo(
    () =>
      (["vowel", "sage", "blue", "coral"] as const).filter((c) =>
        slots.some((s) => s.kind === "letter" && s.clue === c),
      ),
    [slots],
  );
  const solved = isSolved(slots, guessed);

  useEffect(() => {
    if (solved) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [solved]);

  const guess = useCallback(
    (letter: string) => {
      if (guessed.has(letter) || solved) return;
      const next = new Set(guessed).add(letter);
      setGuessed(next);
      const hits = hitsFor(slots, letter);
      if (hits.length) setLanding({ letter, slots: hits });
      else {
        setMisses((m) => m + 1);
        setShake(letter);
      }
      if (isSolved(slots, next)) {
        const result = {
          guesses: next.size,
          misses: misses + (hits.length ? 0 : 1),
          ms: Date.now() - started,
        };
        setTimeout(
          () => onSolved(result),
          reduced ? 400 : POP_MS + hits.length * STAGGER + 500,
        );
      }
    },
    [guessed, solved, slots, misses, started, onSolved, reduced],
  );

  // each right guess pops into all its places in the note, one after another,
  // while its first flower lights up on the bouquet
  useLayoutEffect(() => {
    if (!landing || reduced) return;
    landing.slots.forEach((i, n) => {
      const target = note.current?.querySelector<HTMLElement>(`[data-slot="${i}"] > span`);
      target?.animate(
        [
          { transform: "scale(0.3)", opacity: 0 },
          { transform: "scale(1.25)", opacity: 1, offset: 0.55 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: POP_MS, delay: n * STAGGER, easing: CSS_EASE.out, fill: "backwards" },
      );
    });
    const first = slots[landing.slots[0]];
    if (first?.kind === "letter") onFocusFlower(first.key);
    const t = setTimeout(() => onFocusFlower(null), POP_MS + landing.slots.length * STAGGER + 300);
    return () => clearTimeout(t);
  }, [landing, reduced, slots, onFocusFlower]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (e.target as HTMLElement)?.closest?.("input, textarea")
      )
        return;
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) {
        e.preventDefault();
        guess(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guess]);

  // words stay whole, so lines only break between words
  const words: Array<Array<{ slot: Slot; i: number }> | "br"> = [[]];
  slots.forEach((slot, i) => {
    if (slot.kind === "space") words.push([]);
    else if (slot.kind === "newline") words.push("br", []);
    else
      (words[words.length - 1] as Array<{ slot: Slot; i: number }>).push({
        slot,
        i,
      });
  });
  const hidden = slots.filter(
    (s) => s.kind === "letter" && !guessed.has(s.letter),
  ).length;

  return (
    <div className={styles.puzzle}>
      <article className={styles.letter} aria-label="The message, still hidden">
        {toName ? <p className={styles.dear}>Dear {toName},</p> : null}
        <p ref={note} className={`${styles.note} ${styles.puzzleNote}`}>
          {words.map((w, wi) =>
            w === "br" ? (
              <br key={wi} />
            ) : w.length ? (
              <Fragment key={wi}>
                <span className={styles.word}>
                  {w.map(({ slot, i }) =>
                    slot.kind === "letter" ? (
                      <button
                        key={i}
                        type="button"
                        data-slot={i}
                        className={styles.slot}
                        data-open={guessed.has(slot.letter) ? "" : undefined}
                        style={
                          { "--clue": colour(slot.clue) } as React.CSSProperties
                        }
                        onPointerEnter={() => onFocusFlower(slot.key)}
                        onPointerLeave={() => onFocusFlower(null)}
                        onFocus={() => onFocusFlower(slot.key)}
                        onBlur={() => onFocusFlower(null)}
                        aria-label={
                          guessed.has(slot.letter)
                            ? slot.char
                            : `hidden ${slot.clue === "vowel" ? "vowel" : "consonant"}: one of ${CLUE_LETTERS[slot.clue].split("").join(" ")}`
                        }
                      >
                        <span>
                          {guessed.has(slot.letter) ? slot.char : " "}
                        </span>
                      </button>
                    ) : (
                      <span key={i} className={styles.given}>
                        {slot.char}
                      </span>
                    ),
                  )}
                </span>
                {wi < words.length - 1 ? " " : null}
              </Fragment>
            ) : null,
          )}
        </p>
      </article>

      <p className={styles.puzzleStats} aria-live="polite">
        {solved
          ? "Solved!"
          : `${hidden} ${hidden === 1 ? "letter" : "letters"} to go`}{" "}
        · {guessed.size} {guessed.size === 1 ? "guess" : "guesses"} ·{" "}
        {clock(now - started)}
      </p>

      <ul className={styles.clues} aria-label="Clues">
        {clues.map((c) => (
          <li key={c} style={{ "--clue": colour(c) } as React.CSSProperties}>
            <span className={styles.clueMark} aria-hidden />
            <b>{CLUE_NAME[c]}</b>{" "}
            {CLUE_LETTERS[c].toUpperCase().split("").join(" ")}
          </li>
        ))}
      </ul>

      <div className={styles.keys} role="group" aria-label="Guess a letter">
        {ROWS.map((row) => (
          <div key={row} className={styles.keyRow}>
            {Array.from(row).map((k) => {
              const used = guessed.has(k);
              const hit = used && hitsFor(slots, k).length > 0;
              return (
                <button
                  key={k}
                  type="button"
                  className={styles.key}
                  data-state={used ? (hit ? "hit" : "miss") : undefined}
                  data-shake={shake === k ? "" : undefined}
                  onAnimationEnd={() => setShake(null)}
                  onClick={() => guess(k)}
                  disabled={used || solved}
                  aria-label={`Guess ${k.toUpperCase()}${used ? (hit ? ", in the message" : ", not in the message") : ""}`}
                >
                  {k.toUpperCase()}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!solved ? (
        <button type="button" className={styles.textButton} onClick={onGiveUp}>
          Read it to me instead
        </button>
      ) : null}
    </div>
  );
}
