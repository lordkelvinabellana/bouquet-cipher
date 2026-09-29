import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildGenome, signatureOf } from "@/core/genome/genome";
import { COLLAR, FLOOR, MIN_GAP, TUCK, gatherBouquet } from "@/core/layout/v1/gather";
import { layoutBouquet, slotFor, tierSwings } from "@/core/layout/v1/layout";
import { readingSequence } from "@/core/reveal/sequence";
import {
  CARD_CENTER,
  MAX_LEAN,
  cameraMatrix,
  fitZoom,
  fitsCamera,
  growingCamera,
  presentedCamera,
  sceneGroups,
} from "@/core/scene/scene";
import { apply, compose, rotate, translate } from "@/core/art/geom";
import { FRAME } from "@/core/art/scenery";
import { canon } from "@/core/text/canon";
import { MAX_GRAPHEMES, fitToLimits } from "@/core/text/limits";
import { hashString } from "@/core/rng";
import { expectOnlySwings } from "./stable";

/** What someone might type: letters, punctuation, digits, single spaces. */
const typed = fc
  .array(fc.constantFrom(..."etaoinshrdlucmwfgypbvkjxqzETAOIS.,!?'-0123456789     "), { minLength: 0, maxLength: 70 })
  .map((cs) => fitToLimits(canon(cs.join(""), "live")));

function layoutOf(text: string, salt = 0) {
  return layoutBouquet(buildGenome(text), salt);
}

/** Messages at the limit: a real one, and the most stems a card can get (all one-letter words). */
const LONG = [
  "Happy anniversary, my love. Ten years of laughter, adventures and quiet mornings. I would choose you again, every time!",
  Array.from({ length: MAX_GRAPHEMES / 2 }, (_, i) => "abcdefghijklmnopqrstuvwxyz"[i % 26]).join(" "),
].map((m) => fitToLimits(canon(m)));

describe("layout v1", () => {
  it("never redraws an element when more is typed; only a filling tier turns, as one piece", () => {
    fc.assert(
      fc.property(typed, typed, (a, more) => {
        expectOnlySwings(layoutOf(a), layoutOf(fitToLimits(canon(a + more, "live"))));
      }),
      { numRuns: 250 },
    );
  });

  it("fans every tier out evenly either side of upright", () => {
    for (let total = 1; total <= MAX_GRAPHEMES / 2 + 1; total++) {
      const swings = tierSwings(total);
      const tiers = new Map<number, number[]>();
      for (let k = 0; k < total; k++) {
        const s = slotFor(k);
        tiers.set(s.tier, [...(tiers.get(s.tier) ?? []), s.angle + swings.get(s.tier)!]);
      }
      for (const [tier, angles] of tiers) {
        const a = [...angles].sort((x, y) => x - y);
        const step = slotFor([...Array(total).keys()].find((k) => slotFor(k).tier === tier)!).halfStep * 2;
        a.forEach((v, i) => {
          expect(v).toBeCloseTo(-a[a.length - 1 - i], 9);
          if (i > 0) expect(v - a[i - 1]).toBeCloseTo(step, 9);
        });
      }
    }
  });

  it("gives every stem its tier's swing, and a full tier none", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const l = layoutOf(t);
        const swings = tierSwings(l.stems.length + (l.sprout ? 1 : 0));
        for (const st of l.stems) expect(st.swing).toBe(swings.get(st.slot.tier));
        for (const e of l.elements) expect(e.swing).toBe(l.stems[e.stem].swing);
      }),
      { numRuns: 150 },
    );
  });

  it("stands every bouquet upright over its ribbon while it grows", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const l = layoutOf(t);
        if (!l.elements.length) return;
        const cam = growingCamera(l);
        expect(fitsCamera(l, cam)).toBe(true);
        if (Math.abs(cam.angle) >= MAX_LEAN) return;
        // the flowers' centre of mass sits right above the tie
        const m = cameraMatrix({ ...cam, zoom: 1, x: 0, y: 0 });
        let sw = 0;
        let sx = 0;
        for (const e of l.elements) {
          const w = e.hit.r * e.hit.r;
          sw += w;
          sx += w * apply(m, [e.hit.x, e.hit.y])[0];
        }
        expect(Math.abs(sx / sw)).toBeLessThan(0.1);
      }),
      { numRuns: 200 },
    );
  });

  it("fits a full-length message, with flowers still a good size", () => {
    for (const m of LONG) {
      expect(m.length).toBeGreaterThan(MAX_GRAPHEMES - 5);
      const l = layoutOf(m);
      const cam = growingCamera(l);
      expect(fitsCamera(l, cam)).toBe(true);
      expect(cam.zoom).toBeGreaterThan(1.1);
      expect(presentedCamera(l).zoom).toBeGreaterThan(1.1);
    }
  });

  it("is deterministic", () => {
    const t = "Happy birthday! Wishing you all the love in the world";
    expect(JSON.stringify(layoutOf(t))).toBe(JSON.stringify(layoutOf(t)));
  });

  it("changes decoration, not structure, with a different salt", () => {
    const t = "I love you";
    const a = layoutOf(t, 0);
    const b = layoutOf(t, 99);
    expect(a.elements.map((e) => e.glyph)).toEqual(b.elements.map((e) => e.glyph));
    expect(JSON.stringify(a.elements.map((e) => e.m))).not.toBe(JSON.stringify(b.elements.map((e) => e.m)));
  });

  it("reads back exactly the message it was grown from", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const c = canon(t);
        const text = readingSequence(layoutOf(c))
          .map((s) => s.char)
          .join("");
        expect(text).toBe(c);
      }),
      { numRuns: 300 },
    );
  });

  it("centres wrapped bouquets on the oval, upright and inside the picture", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const c = canon(t);
        if (!c) return;
        const l = layoutOf(c);
        const cam = presentedCamera(l);
        const m = cameraMatrix(cam);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        for (const e of l.elements) {
          const [x, y] = apply(m, [e.hit.x, e.hit.y]);
          const r = e.hit.r * 1.12 * cam.zoom;
          minX = Math.min(minX, x - r);
          maxX = Math.max(maxX, x + r);
          minY = Math.min(minY, y - r);
        }
        for (const st of l.stems) {
          for (const p of st.line) {
            const [x, y] = apply(m, p);
            minX = Math.min(minX, x - 2 * cam.zoom);
            maxX = Math.max(maxX, x + 2 * cam.zoom);
            minY = Math.min(minY, y - 2 * cam.zoom);
          }
        }
        expect(Math.abs(cam.angle)).toBeLessThanOrEqual(12);
        expect(minX).toBeGreaterThanOrEqual(11);
        expect(maxX).toBeLessThanOrEqual(FRAME.w - 11);
        expect(minY).toBeGreaterThanOrEqual(11);
        // centred across the oval (small bouquets have a minimum width, so allow a hair)
        expect(Math.abs((minX + maxX) / 2 - CARD_CENTER[0])).toBeLessThan(40 * cam.zoom);
      }),
      { numRuns: 200 },
    );
  });

  it("always fits inside the card", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const l = layoutOf(canon(t));
        const z = fitZoom(l);
        expect(z).toBeGreaterThan(0.3);
        expect(Number.isFinite(z)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});

describe("gathering for the wrap", () => {
  const pairs = (t: string) => {
    const open = layoutOf(canon(t));
    return { open, bunch: gatherBouquet(open) };
  };
  const leanOf = (st: { curve: { theta: number }; swing: number }) => (st.curve.theta * 180) / Math.PI + st.swing;

  it("only moves whole stems: nothing is redrawn or moved along its stem", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const { open, bunch } = pairs(t);
        bunch.elements.forEach((y, i) => {
          const x = open.elements[i];
          expect([y.key, y.local, y.art]).toEqual([x.key, x.local, x.art]);
          const posed = compose(translate(y.shift[0], y.shift[1]), rotate(y.swing), y.local);
          y.m.forEach((v, j) => expect(v).toBeCloseTo(posed[j], 9));
          expect([y.swing, y.shift]).toEqual([bunch.stems[y.stem].swing, bunch.stems[y.stem].shift]);
        });
        bunch.stems.forEach((st, i) => expect(st.curve).toEqual(open.stems[i].curve));
      }),
      { numRuns: 150 },
    );
  });

  it("never presses one flower head onto another", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const { open, bunch } = pairs(t);
        const heads = bunch.elements.map((e, i) => ({ e, o: open.elements[i] })).filter(({ e }) => e.kind === "bloom");
        for (const a of heads) {
          for (const b of heads) {
            if (a.e.stem >= b.e.stem) continue;
            const before = Math.hypot(a.o.hit.x - b.o.hit.x, a.o.hit.y - b.o.hit.y);
            const after = Math.hypot(a.e.hit.x - b.e.hit.x, a.e.hit.y - b.e.hit.y);
            expect(after).toBeGreaterThanOrEqual(Math.min(before, (a.e.hit.r + b.e.hit.r) * TUCK) - 1e-6);
          }
        }
      }),
      { numRuns: 150 },
    );
  });

  it("never crosses stems, and pulls none into the paper's neck", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const { open, bunch } = pairs(t);
        for (const side of [-1, 1]) {
          const stems = open.stems
            .filter((st) => (leanOf(st) < 0 ? -1 : 1) === side)
            .sort((a, b) => Math.abs(leanOf(a)) - Math.abs(leanOf(b)) || a.ordinal - b.ordinal);
          for (let i = 1; i < stems.length; i++) {
            const inner = Math.abs(leanOf(bunch.stems[stems[i - 1].ordinal]));
            const outer = Math.abs(leanOf(bunch.stems[stems[i].ordinal]));
            const moved = bunch.stems[stems[i].ordinal].swing !== stems[i].swing;
            expect(outer).toBeGreaterThanOrEqual(moved ? inner + MIN_GAP - 1e-6 : inner - 1e-6);
          }
        }
        bunch.elements.forEach((e, i) => {
          if (e.hit.y === open.elements[i].hit.y && e.hit.x === open.elements[i].hit.x) return;
          expect(e.hit.y).toBeLessThanOrEqual(-(e.kind === "bloom" ? FLOOR.head : FLOOR.other) + 1e-6);
        });
      }),
      { numRuns: 150 },
    );
  });

  it("makes the bunch narrower, never wider, and still fits the picture", () => {
    let narrower = 0;
    fc.assert(
      fc.property(typed, (t) => {
        const { open, bunch } = pairs(t);
        const w = (l: typeof open) => l.bbox.maxX - l.bbox.minX;
        expect(w(bunch)).toBeLessThanOrEqual(w(open) + 1e-6);
        if (w(bunch) < w(open) - 1) narrower++;
        const cam = presentedCamera(bunch);
        expect(Math.abs(cam.angle)).toBeLessThanOrEqual(MAX_LEAN);
      }),
      // a fixed seed, so the count below is the same on every run
      { numRuns: 200, seed: 20260929 },
    );
    expect(narrower).toBeGreaterThan(25);
  });

  it("sits every flower and leaf above the paper's collar", () => {
    fc.assert(
      fc.property(typed, (t) => {
        const { bunch } = pairs(t);
        for (const e of bunch.elements) expect(e.hit.y).toBeLessThanOrEqual(-COLLAR + 1e-6);
      }),
      { numRuns: 200 },
    );
  });

  it("is the same every time", () => {
    const t = "Happy birthday Mom! Love you always and forever";
    expect(JSON.stringify(gatherBouquet(layoutOf(t)))).toBe(JSON.stringify(gatherBouquet(layoutOf(t))));
  });
});

/**
 * Golden hashes: v1 output must never change silently once shipped. While the art is
 * still being tuned before launch, update with `npx vitest -u` on purpose.
 */
describe("golden bouquets", () => {
  const MESSAGES = [
    "I love you",
    "The quick brown fox jumps over the lazy dog",
    "Happy birthday! Wishing you all the love in the world",
    "hmm",
    "aeiou",
    "Don't stop, ok?!",
    "Happy 21st birthday!!",
    "Caf" + String.fromCodePoint(0xe9) + " cr" + String.fromCodePoint(0xe8) + "me",
    "Dear Sam,\nthinking of you",
    "WILL YOU GO TO PROM WITH ME?",
  ];
  for (const m of MESSAGES) {
    it(`draws "${m.replace(/\n/g, "\\n")}" the same way`, () => {
      const c = canon(m);
      const groups = sceneGroups(layoutOf(c), { seal: signatureOf(c) });
      expect(hashString(JSON.stringify(groups)).toString(16)).toMatchSnapshot();
    });
  }
});
