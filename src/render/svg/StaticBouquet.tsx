import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { sceneGroups } from "@/core/scene/scene";
import { FRAME } from "@/core/art/scenery";
import { canon } from "@/core/text/canon";
import { matrix } from "./matrix";
import { Paths } from "./Paths";

interface StaticBouquetProps {
  text: string;
  salt?: number;
  /** A bouquet key; without one, the open alphabet and the original palette. */
  cipherKey?: string | null;
  seal?: boolean;
  className?: string;
}

/** A finished bouquet, rendered once (no animation). Works in server components. */
export function StaticBouquet({ text, salt = 0, cipherKey = null, seal = true, className }: StaticBouquetProps) {
  const c = canon(text);
  const cipher = cipherOf(cipherKey);
  const layout = growBouquet(c, cipher, salt);
  const groups = sceneGroups(layout, { seal: seal ? sealOf(null, c, cipher, salt) : undefined, ribbonSeed: ribbonSeedOf(cipher, salt) });
  return (
    <svg viewBox={`0 0 ${FRAME.w} ${FRAME.h}`} className={className} role="img" aria-label="A bouquet">
      {groups.map((g, i) => (
        <g key={g.key ?? `g${i}`} transform={matrix(g.m)}>
          <Paths shapes={g.shapes} />
        </g>
      ))}
    </svg>
  );
}
