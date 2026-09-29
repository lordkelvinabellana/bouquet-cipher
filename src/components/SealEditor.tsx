"use client";
import { useState, useTransition } from "react";
import { sealShapes } from "@/core/art/scenery";
import { cleanInitials, EMBLEMS, parseSealStyle, sealStyleString, WAXES, type Emblem, type SealStyle, type Wax } from "@/core/art/seal";
import { Paths } from "@/render/svg/Paths";
import styles from "./seal.module.css";

type Choice = Emblem | "initials";

/**
 * Design your wax seal: pick the wax, then an emblem or your initials. The big preview
 * is exactly what's pressed onto the ribbon of everything you send from now on.
 */
export function SealEditor({ seal, initial, save }: { seal: number; initial: string | null; save: (style: string | null) => Promise<void> }) {
  const start = parseSealStyle(initial);
  const [wax, setWax] = useState<Wax>(start?.wax ?? "red");
  const [choice, setChoice] = useState<Choice>(start ? (typeof start.mark === "string" ? start.mark : "initials") : "rosette");
  const [initials, setInitials] = useState(start && typeof start.mark !== "string" ? start.mark.initials : "");
  const [saved, setSaved] = useState<string | null>(initial);
  const [pending, startTransition] = useTransition();

  const style: SealStyle | null = choice === "initials" ? (initials ? { wax, mark: { initials } } : null) : { wax, mark: choice };
  // red with the rosette is the classic seal, which is stored as "no style"
  const value = style && !(style.wax === "red" && style.mark === "rosette") ? sealStyleString(style) : null;
  const preview = sealShapes([0, 0], seal, 1, style);
  const changed = value !== saved;

  const store = (next: string | null) =>
    startTransition(async () => {
      await save(next);
      setSaved(next);
    });

  return (
    <section id="seal" className={styles.editor} aria-labelledby="seal-title">
      <svg viewBox="-16 -16 32 32" className={styles.preview} role="img" aria-label="Your seal">
        <Paths shapes={preview} />
      </svg>
      <div className={styles.controls}>
        <h2 id="seal-title" className={styles.title}>
          Your seal
        </h2>
        <p className={styles.text}>Pressed onto the ribbon of every bouquet you send. Bouquets you’ve already sent keep the seal they left with.</p>

        <fieldset className={styles.group}>
          <legend>Wax</legend>
          <div className={styles.options}>
            {(Object.keys(WAXES) as Wax[]).map((w) => (
              <label key={w} className={styles.wax} data-on={w === wax ? "" : undefined}>
                <input type="radio" name="wax" value={w} checked={w === wax} onChange={() => setWax(w)} />
                <span style={{ background: WAXES[w].tone.base }} aria-hidden />
                <em>{WAXES[w].name}</em>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Emblem</legend>
          <div className={styles.options}>
            {(Object.keys(EMBLEMS) as Emblem[]).map((e) => (
              <label key={e} className={styles.emblem} data-on={e === choice ? "" : undefined}>
                <input type="radio" name="emblem" value={e} checked={e === choice} onChange={() => setChoice(e)} />
                <svg viewBox="-16 -16 32 32" aria-hidden>
                  <Paths shapes={sealShapes([0, 0], seal, 1, { wax, mark: e })} />
                </svg>
                <em>{EMBLEMS[e]}</em>
              </label>
            ))}
            <label className={styles.emblem} data-on={choice === "initials" ? "" : undefined}>
              <input type="radio" name="emblem" value="initials" checked={choice === "initials"} onChange={() => setChoice("initials")} />
              <svg viewBox="-16 -16 32 32" aria-hidden>
                <Paths shapes={sealShapes([0, 0], seal, 1, { wax, mark: { initials: initials || "AB" } })} />
              </svg>
              <em>Initials</em>
            </label>
          </div>
          {choice === "initials" ? (
            <label className={styles.initials}>
              <span>Your initials</span>
              <input
                value={initials}
                onChange={(e) => setInitials(cleanInitials(e.target.value))}
                placeholder="AB"
                maxLength={2}
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
              />
            </label>
          ) : null}
        </fieldset>

        <div className={styles.actions}>
          <button type="button" className={styles.save} disabled={!changed || pending || (choice === "initials" && !initials)} onClick={() => store(value)}>
            {pending ? "Saving…" : changed ? "Save seal" : "Saved"}
          </button>
          {saved ? (
            <button
              type="button"
              className={styles.reset}
              disabled={pending}
              onClick={() => {
                setWax("red");
                setChoice("rosette");
                setInitials("");
                store(null);
              }}
            >
              Back to classic
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
