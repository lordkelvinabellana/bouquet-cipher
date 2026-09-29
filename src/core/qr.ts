/**
 * QR codes as shapes, so the same code renders in the live SVG, the saved PNG and
 * server-side previews. Error correction "M" survives a little blur and JPEG
 * recompression from chat apps; dark ink on the cream tag keeps contrast high.
 */
import { encode } from "uqr";
import type { Shape } from "./art/types";

export interface QrMatrix {
  size: number;
  dark: boolean[][];
}

export function qrMatrix(text: string): QrMatrix {
  const r = encode(text, { ecc: "M", border: 0 });
  return { size: r.size, dark: r.data };
}

const f = (v: number) => String(Math.round(v * 100) / 100);

/**
 * The code's dark modules as one compound path, merging runs along each row. Modules
 * overlap by a hair so no seams show when scaled. The caller must leave a light margin
 * (quiet zone) of at least two modules around it.
 */
export function qrShape(text: string, x: number, y: number, size: number, color: string): { shape: Shape; modules: number } {
  const { size: n, dark } = qrMatrix(text);
  const m = size / n;
  let d = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!dark[r][c]) {
        c++;
        continue;
      }
      let e = c;
      while (e < n && dark[r][e]) e++;
      const w = (e - c) * m + 0.03;
      d += `M${f(x + c * m)} ${f(y + r * m)}h${f(w)}v${f(m + 0.03)}h${f(-w)}Z`;
      c = e;
    }
  }
  return { shape: { d, fill: color }, modules: n };
}
