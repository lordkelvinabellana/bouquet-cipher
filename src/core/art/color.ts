export type Hex = string;

/** A paint colour with its highlight and shadow. */
export interface Tone {
  base: Hex;
  light: Hex;
  dark: Hex;
}

function parse(hex: Hex): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): Hex {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function mix(a: Hex, b: Hex, t: number): Hex {
  const A = parse(a);
  const B = parse(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** amount > 0 lightens toward warm paper white; amount < 0 darkens toward deep ink. */
export function shade(hex: Hex, amount: number): Hex {
  return amount >= 0 ? mix(hex, "#fffaf0", amount) : mix(hex, "#1f2a33", -amount);
}

/** The same tone, shifted one step lighter or darker (used for front and back petals). */
export function toneStep(tone: Tone, step: "light" | "base" | "dark"): Tone {
  if (step === "base") return tone;
  if (step === "light") return { base: tone.light, light: shade(tone.light, 0.3), dark: tone.base };
  return { base: tone.dark, light: tone.base, dark: shade(tone.dark, -0.15) };
}
