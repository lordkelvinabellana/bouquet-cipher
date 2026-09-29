import { expect } from "vitest";
import { compose, rotate } from "@/core/art/geom";
import { slotFor, type BouquetLayout } from "@/core/layout/v1/layout";

/**
 * What typing more may change in a bouquet: nothing already drawn is redrawn or moved
 * along its stem. The only movement allowed is a whole stem turning about the tie, and
 * only in the tier that was still filling (full tiers never turn).
 */
export function expectOnlySwings(before: BouquetLayout, after: BouquetLayout) {
  const filling = slotFor(before.stems.length + (before.sprout ? 1 : 0) - 1).tier;
  for (let i = 0; i < before.elements.length; i++) {
    const x = before.elements[i];
    const y = after.elements[i];
    expect(y.key).toBe(x.key);
    expect(y.local).toEqual(x.local);
    expect(y.art.shapes).toEqual(x.art.shapes);
    expect(y.shift).toEqual([0, 0]);
    const turned = compose(rotate(y.swing), y.local);
    y.m.forEach((v, j) => expect(v).toBeCloseTo(turned[j], 9));
  }
  for (const x of before.stems) {
    const y = after.stems[x.ordinal];
    expect(y.curve).toEqual(x.curve);
    if (x.slot.tier !== filling) {
      expect(y.swing).toBe(0);
      expect(x.swing).toBe(0);
    }
  }
}
