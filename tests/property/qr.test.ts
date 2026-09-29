import fc from "fast-check";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, formatCode, newCode, normaliseCode, parseCode } from "@/core/code";
import { qrMatrix } from "@/core/qr";

/** Rasterise a QR matrix (with a quiet zone) into RGBA pixels, like a screenshot of the tag. */
function rasterise(text: string, scale = 4, quiet = 4) {
  const { size, dark } = qrMatrix(text);
  const px = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!dark[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((r + quiet) * scale + dy) * px + (c + quiet) * scale + dx) * 4;
          // the tag's ink on cream, not pure black on white
          data[i] = 46;
          data[i + 1] = 58;
          data[i + 2] = 70;
        }
      }
    }
  }
  for (let i = 0; i < px * px; i++) {
    // cream background where it's light
    if (data[i * 4] === 255) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 248;
      data[i * 4 + 2] = 234;
    }
  }
  return { data, px };
}

describe("bouquet codes", () => {
  it("are ten unambiguous characters", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const c = newCode();
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(3000);
    expect(CODE_ALPHABET).not.toMatch(/[ILOU]/);
  });

  it("survive being typed sloppily", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const c = newCode();
        expect(normaliseCode(formatCode(c))).toBe(c);
        expect(normaliseCode(c.toLowerCase())).toBe(c);
        expect(normaliseCode(` ${c.slice(0, 5)} ${c.slice(5)} `)).toBe(c);
        expect(normaliseCode(c.replace(/0/g, "O").replace(/1/g, "l"))).toBe(c);
      }),
      { numRuns: 300 },
    );
  });

  it("are found in links and scanned QR text", () => {
    expect(parseCode("https://bouquet.app/b/K7M2Q9XWPT")).toBe("K7M2Q9XWPT");
    expect(parseCode("http://localhost:3000/b/K7M2Q9XWPT?x=1")).toBe("K7M2Q9XWPT");
    expect(parseCode("k7m2q-9xwpt")).toBe("K7M2Q9XWPT");
    expect(parseCode("not a code")).toBeNull();
    expect(parseCode("K7M2Q9XWP")).toBeNull();
  });
});

describe("QR codes", () => {
  it("decode back to the exact link", () => {
    fc.assert(
      fc.property(fc.constantFrom("https://bouquet.app", "http://localhost:3000", "https://my-bouquet-cipher.vercel.app"), (origin) => {
        const url = `${origin}/b/${newCode()}`;
        const { data, px } = rasterise(url);
        const result = jsQR(data, px, px);
        expect(result?.data).toBe(url);
      }),
      { numRuns: 25 },
    );
  });
});
