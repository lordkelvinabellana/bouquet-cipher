import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cipherOf, growBouquet } from "@/core/bouquet";
import { newCipherKey } from "@/core/cipher";
import { CLUE_LETTERS, clock, hitsFor, isSolved, letterOf, puzzleOf } from "@/core/puzzle";
import { canon } from "@/core/text/canon";
import { MAX_GRAPHEMES } from "@/core/text/limits";

const message = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJéÉ .,!?'1\n"), { minLength: 1, maxLength: MAX_GRAPHEMES })
  .map((cs) => canon(cs.join("")))
  .filter((t) => t.length > 0);

describe("decode it yourself", () => {
  it("lays out the whole message, and every clue is true to the letter it hides", () => {
    fc.assert(
      fc.property(message, (text) => {
        const cipher = cipherOf(newCipherKey());
        const slots = puzzleOf(growBouquet(text, cipher), cipher);
        expect(slots.map((s) => s.char).join("")).toBe(text);
        for (const s of slots) if (s.kind === "letter") expect(CLUE_LETTERS[s.clue]).toContain(s.letter);
      }),
      { numRuns: 60 },
    );
  });

  it("is solved exactly when every letter has been guessed", () => {
    fc.assert(
      fc.property(message, (text) => {
        const cipher = cipherOf(newCipherKey());
        const slots = puzzleOf(growBouquet(text, cipher), cipher);
        const letters = new Set(slots.flatMap((s) => (s.kind === "letter" ? [s.letter] : [])));
        expect(isSolved(slots, letters)).toBe(true);
        for (const l of letters) {
          const fewer = new Set(letters);
          fewer.delete(l);
          expect(isSolved(slots, fewer)).toBe(false);
          expect(hitsFor(slots, l).length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 30 },
    );
  });

  it("guesses accented and capital letters by their plain letter", () => {
    expect(letterOf("É")).toBe("e");
    expect(letterOf("ñ")).toBe("n");
    expect(letterOf("!")).toBeNull();
    const cipher = cipherOf(newCipherKey());
    const slots = puzzleOf(growBouquet("Éclair, é!", cipher), cipher);
    expect(hitsFor(slots, "e").map((i) => slots[i].char)).toEqual(["É", "é"]);
    expect(slots.filter((s) => s.kind === "given").map((s) => s.char)).toEqual([",", "!"]);
  });

  it("shows time as m:ss", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(67_400)).toBe("1:07");
  });
});
