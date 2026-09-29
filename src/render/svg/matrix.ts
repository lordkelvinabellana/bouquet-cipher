/**
 * An SVG transform string, rounded to 4 decimals. The server and the browser can differ
 * in the last digit of trigonometry results; rounding keeps server-rendered HTML and
 * the hydrated page identical (and the strings short). 1e-4 is far below a pixel.
 */
export function matrix(m: readonly number[]): string {
  return `matrix(${m.map((n) => {
    const r = Math.round(n * 1e4) / 1e4;
    return r === 0 ? 0 : r;
  }).join(" ")})`;
}
