"use client";
/**
 * Typing → text, robustly on desktop and mobile.
 *
 * The textarea is uncontrolled (the browser owns its value) and we only listen to
 * `input` events, never keydown: Android keyboards report most keys as keyCode 229,
 * and a React-controlled value can break IME composition. One code path covers typing,
 * paste, autocorrect, dictation, cut, selection deletes and undo.
 *
 * Limits are enforced without fighting the keyboard: an over-limit keystroke is quietly
 * undone (with a shake), an over-long paste is trimmed to what fits, and nothing is
 * touched while an IME is mid-composition.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canon, graphemes } from "@/core/text/canon";
import { measure } from "@/core/text/limits";

export type LimitKind = "total" | "stem";

const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff;

/** The longest version of an insertion that still fits the limits. */
export function fitInsertion(prev: string, next: string): { value: string; caret: number } {
  const max = Math.min(prev.length, next.length);
  let p = 0;
  while (p < max && prev[p] === next[p]) p++;
  if (p > 0 && isHigh(next.charCodeAt(p - 1))) p--;
  let s = 0;
  while (s < max - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  if (s > 0 && isLow(next.charCodeAt(next.length - s))) s--;
  const head = next.slice(0, p);
  const tail = next.slice(next.length - s);
  const inserted = graphemes(next.slice(p, next.length - s));
  const fits = (k: number) => measure(canon(head + inserted.slice(0, k).join("") + tail, "live")).ok;
  if (!fits(0)) return { value: prev, caret: p };
  let lo = 0;
  let hi = inserted.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  const ins = inserted.slice(0, lo).join("");
  return { value: head + ins + tail, caret: head.length + ins.length };
}

export interface GardenInput {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  /** What's in the textarea. */
  raw: string;
  /** Canonical live text: what the bouquet grows from. */
  live: string;
  /** Canonical final text: what gets saved and sent. */
  final: string;
  count: number;
  /** Changes each time input is refused, with the reason. */
  refusal: { kind: LimitKind; n: number } | null;
  bind: {
    onInput: (e: React.FormEvent<HTMLTextAreaElement>) => void;
    onCompositionStart: () => void;
    onCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => void;
  };
  reset: (value?: string) => void;
}

export function useGardenInput(initial = ""): GardenInput {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [raw, setRaw] = useState(initial);
  const [refusal, setRefusal] = useState<{ kind: LimitKind; n: number } | null>(null);
  const composing = useRef(false);
  const accepted = useRef(initial);
  const selectionBefore = useRef<[number, number]>([initial.length, initial.length]);

  // Remember the selection just before each edit, so a refused keystroke can put it back.
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const remember = () => {
      selectionBefore.current = [ta.selectionStart, ta.selectionEnd];
    };
    ta.addEventListener("beforeinput", remember);
    return () => ta.removeEventListener("beforeinput", remember);
  }, []);

  const settle = useCallback((ta: HTMLTextAreaElement, inputType: string) => {
    const value = ta.value;
    const report = measure(canon(value, "live"));
    if (report.ok) {
      accepted.current = value;
      setRaw(value);
      // an accepted edit (like deleting a character) clears any "bouquet is full" warning
      setRefusal(null);
      return;
    }
    if (composing.current) {
      // Never fight an IME mid-word; the limit is applied when composition ends.
      setRaw(value);
      return;
    }
    const prev = accepted.current;
    if (/^insertFrom|^insertReplacementText|^insertCompositionText/.test(inputType)) {
      const fitted = fitInsertion(prev, value);
      ta.value = fitted.value;
      ta.setSelectionRange(fitted.caret, fitted.caret);
      accepted.current = fitted.value;
      setRaw(fitted.value);
    } else {
      const [a, b] = selectionBefore.current;
      ta.value = prev;
      ta.setSelectionRange(Math.min(a, prev.length), Math.min(b, prev.length));
      setRaw(prev);
    }
    setRefusal((r) => ({ kind: report.tooLong ? "total" : "stem", n: (r?.n ?? 0) + 1 }));
  }, []);

  const bind = useMemo(
    () => ({
      onInput: (e: React.FormEvent<HTMLTextAreaElement>) => settle(e.currentTarget, (e.nativeEvent as InputEvent).inputType ?? ""),
      onCompositionStart: () => {
        composing.current = true;
      },
      onCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => {
        composing.current = false;
        settle(e.currentTarget, "insertCompositionText");
      },
    }),
    [settle],
  );

  const reset = useCallback((value = "") => {
    if (ref.current) ref.current.value = value;
    accepted.current = value;
    setRaw(value);
  }, []);

  const live = useMemo(() => canon(raw, "live"), [raw]);
  const final = useMemo(() => canon(raw), [raw]);
  const count = useMemo(() => measure(final).count, [final]);

  return { ref, raw, live, final, count, refusal, bind, reset };
}
