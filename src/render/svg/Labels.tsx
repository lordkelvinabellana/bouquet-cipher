import type { Label } from "@/core/art/types";

const FAMILY = {
  hand: "var(--font-hand), 'Caveat', cursive",
  serif: "var(--font-serif), Georgia, serif",
} as const;

/** Text lines (the gift tag's names and code) as SVG text in the app's fonts. */
export function Labels({ labels }: { labels: readonly Label[] }) {
  return (
    <>
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          fill={l.color}
          textAnchor={l.anchor ?? "start"}
          dominantBaseline="middle"
          style={{ fontFamily: FAMILY[l.font], fontSize: l.size, fontWeight: l.weight, letterSpacing: l.letterSpacing }}
        >
          {l.text}
        </text>
      ))}
    </>
  );
}
