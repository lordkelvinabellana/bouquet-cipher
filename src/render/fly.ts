"use client";
/**
 * A letter lifting off its flower and flying to its place in the note. The target stays
 * invisible until the letter lands on it, so each letter visibly travels from where it
 * was hidden to where it's read.
 */

import { CSS_EASE, DUR } from "@/anim/motion";

export interface Point {
  x: number;
  y: number;
}

/** How long one letter is in the air. */
export const FLIGHT_MS = 620;

export function flyLetter(char: string, from: Point, target: HTMLElement, delay = 0) {
  const to = target.getBoundingClientRect();
  const style = getComputedStyle(target);
  target.style.visibility = "hidden";
  const land = () => {
    target.style.visibility = "";
    target.style.animation = "none";
    target.animate([{ transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: DUR.quick * 1000, easing: CSS_EASE.out });
  };
  if (!to.width && !to.height) return land();

  const el = document.createElement("span");
  el.textContent = char;
  el.setAttribute("aria-hidden", "true");
  const size = parseFloat(style.fontSize) || 26;
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "50",
    pointerEvents: "none",
    font: style.font,
    color: style.color,
    lineHeight: "1",
    padding: "0.16em 0.34em 0.1em",
    borderRadius: "999px",
    background: "#FFF6DA",
    boxShadow: "0 4px 14px rgb(0 0 0 / 0.28), 0 0 0 2px rgb(255 246 218 / 0.5)",
    willChange: "transform, opacity",
  });
  document.body.appendChild(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const end = { x: to.left + to.width / 2 - w / 2, y: to.top + to.height / 2 - h / 2 };
  const start = { x: from.x - w / 2, y: from.y - h / 2 };
  // arc up and over, a touch bigger while it's off the page
  const lift = Math.min(90, 30 + Math.hypot(end.x - start.x, end.y - start.y) * 0.18);
  const mid = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - lift };
  const grow = Math.max(1.2, 40 / size);
  const at = (p: Point, k: number) => `translate(${p.x}px, ${p.y}px) scale(${k})`;
  const flight = el.animate(
    [
      { transform: at(start, grow * 0.6), opacity: 0, offset: 0 },
      { transform: at({ x: start.x, y: start.y - 18 }, grow), opacity: 1, offset: 0.2 },
      { transform: at(mid, grow * 0.9), opacity: 1, offset: 0.6 },
      // the token melts into the paper as it lands
      { transform: at(end, 1.08), opacity: 1, backgroundColor: "#FFF6DA", boxShadow: "0 4px 14px rgb(0 0 0 / 0.2), 0 0 0 2px rgb(255 246 218 / 0.4)", offset: 0.88 },
      { transform: at(end, 1), opacity: 1, backgroundColor: "rgb(255 246 218 / 0)", boxShadow: "0 0 0 0 rgb(0 0 0 / 0), 0 0 0 0 rgb(255 246 218 / 0)", offset: 1 },
    ],
    { duration: FLIGHT_MS, delay, easing: CSS_EASE.inOut, fill: "both" },
  );
  const done = () => {
    el.remove();
    land();
  };
  flight.onfinish = done;
  flight.oncancel = done;
}
