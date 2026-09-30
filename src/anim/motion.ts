/**
 * The app's motion system for code-driven animation, mirroring the CSS tokens in
 * app/globals.css: three curves and five speeds, and two springs.
 *
 * Springs are tuned by their damping ratio (damping / 2√stiffness): SETTLE is critically
 * damped, so a glide lands without wobbling; POP overshoots just a touch, so a new leaf
 * or bloom feels alive without bouncing. Everything that grows uses POP; everything
 * that moves from one place to another uses SETTLE.
 */

export const EASE = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.55, 0, 1, 0.45],
} as const;

export const CSS_EASE = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  in: "cubic-bezier(0.55, 0, 1, 0.45)",
} as const;

/** Seconds. */
export const DUR = { press: 0.16, quick: 0.26, base: 0.48, slow: 0.72, scene: 0.9 } as const;

/** Gliding to a new place (a stem's pose, the camera): lands without a wobble. */
export const SETTLE = { type: "spring", stiffness: 120, damping: 22 } as const;

/** Growing in (leaves, blooms, stems, paper): a touch of overshoot, the same everywhere. */
export const POP = { type: "spring", stiffness: 190, damping: 22 } as const;
