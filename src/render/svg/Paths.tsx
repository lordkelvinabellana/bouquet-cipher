import type { Shape } from "@/core/art/types";

/** Render a list of shapes as SVG paths. */
export function Paths({ shapes }: { shapes: readonly Shape[] }) {
  return (
    <>
      {shapes.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} fillOpacity={s.opacity} fillRule={s.rule} />
      ))}
    </>
  );
}
