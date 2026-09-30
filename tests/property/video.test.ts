import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cipherOf, growBouquet } from "@/core/bouquet";
import { newCipherKey } from "@/core/cipher";
import { readingSequence } from "@/core/reveal/sequence";
import { canon } from "@/core/text/canon";
import { MAX_GRAPHEMES } from "@/core/text/limits";
import { planVideo, popScale, readingAt, sweepAt } from "@/core/video/timeline";

const message = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJ .,!?'"), { minLength: 1, maxLength: MAX_GRAPHEMES })
  .map((cs) => canon(cs.join("")))
  .filter((t) => t.length > 0);

describe("share video timeline", () => {
  it("opens every flower during the growth, and reads the whole message in order", () => {
    fc.assert(
      fc.property(message, (text) => {
        const cipher = cipherOf(newCipherKey());
        const layout = growBouquet(text, cipher);
        const plan = planVideo(layout, cipher, true);
        expect(plan.pops.size).toBe(layout.elements.length);
        for (const at of plan.pops.values()) {
          expect(at).toBeGreaterThanOrEqual(plan.sweep.start);
          expect(at).toBeLessThanOrEqual(plan.sweep.end);
        }
        expect(plan.reads.map((r) => r.step.char).join("")).toBe(readingSequence(layout, cipher).map((s) => s.char).join(""));
        plan.reads.forEach((r, i) => i > 0 && expect(r.at).toBeGreaterThan(plan.reads[i - 1].at));
        expect(plan.reads[0].at).toBeGreaterThanOrEqual(plan.grown);
        expect(plan.outro).toBeGreaterThan(plan.reads[plan.reads.length - 1].at);
      }),
      { numRuns: 40 },
    );
  });

  it("stays a short clip even for a full-length message", () => {
    const text = canon("Happy birthday Ana! Wishing you all the love in the world and more cake than yo");
    const cipher = cipherOf(newCipherKey());
    const plan = planVideo(growBouquet(text, cipher), cipher, true);
    expect(plan.duration).toBeLessThan(18);
    expect(plan.duration).toBeGreaterThan(8);
  });

  it("keeps the message a mystery when asked", () => {
    const cipher = cipherOf(newCipherKey());
    const plan = planVideo(growBouquet("guess who", cipher), cipher, false);
    expect(plan.reads).toHaveLength(0);
    expect(readingAt(plan, plan.duration)).toBe(-1);
    expect(plan.outro).toBeGreaterThanOrEqual(plan.grown);
  });

  it("sweeps up from the ribbon, and pops overshoot a little then settle", () => {
    const cipher = cipherOf(newCipherKey());
    const plan = planVideo(growBouquet("hello there", cipher), cipher, true);
    expect(sweepAt(plan, 0)).toBe(plan.sweep.fromY);
    expect(sweepAt(plan, plan.duration)).toBeCloseTo(plan.sweep.toY, 6);
    expect(plan.sweep.toY).toBeLessThan(plan.sweep.fromY);
    expect(popScale(0)).toBe(0);
    expect(popScale(1)).toBe(1);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => popScale(i / 50)))).toBeGreaterThan(1);
  });
});
