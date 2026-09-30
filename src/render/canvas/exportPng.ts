"use client";
/**
 * Save the bouquet as a PNG by replaying the same draw list onto a canvas (drawing the
 * SVG into a canvas is unreliable across Safari and Firefox). The paper grain is a
 * seeded noise pattern, so every export of the same bouquet looks the same.
 */
import { cardShape, FRAME } from "@/core/art/scenery";
import { makeRng } from "@/core/rng";
import type { Label } from "@/core/art/types";
import type { DrawGroup } from "@/core/scene/scene";

/** iOS Safari refuses canvases above about 16.7 megapixels. */
const MAX_PIXELS = 16_000_000;

export function noiseTile(): HTMLCanvasElement {
  const size = 200;
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const ctx = tile.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rng = makeRng(1234);
  for (let i = 0; i < size * size; i++) {
    const v = rng.next();
    img.data[i * 4] = 84;
    img.data[i * 4 + 1] = 66;
    img.data[i * 4 + 2] = 46;
    img.data[i * 4 + 3] = v > 0.5 ? Math.round((v - 0.5) * 2 * 120) : 0;
  }
  ctx.putImageData(img, 0, 0);
  return tile;
}

export function fontFamily(font: Label["font"]): string {
  const css = getComputedStyle(document.documentElement).getPropertyValue(font === "hand" ? "--font-hand" : "--font-serif").trim();
  return css || (font === "hand" ? "cursive" : "Georgia, serif");
}

export function drawLabels(ctx: CanvasRenderingContext2D, labels: readonly Label[]) {
  for (const l of labels) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = l.color;
    ctx.font = `${l.weight ?? 400} ${l.size}px ${fontFamily(l.font)}`;
    ctx.textAlign = l.anchor === "middle" ? "center" : l.anchor === "end" ? "right" : "left";
    ctx.textBaseline = "middle";
    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if ("letterSpacing" in spaced) spaced.letterSpacing = `${l.letterSpacing ?? 0}px`;
    ctx.fillText(l.text, l.x, l.y);
    if ("letterSpacing" in spaced) spaced.letterSpacing = "0px";
  }
}

/** Fill one group's shapes (and write its labels) under its own transform. */
export function drawGroup(ctx: CanvasRenderingContext2D, g: DrawGroup, path: (d: string) => Path2D = (d) => new Path2D(d), alpha = 1) {
  ctx.save();
  ctx.transform(g.m[0], g.m[1], g.m[2], g.m[3], g.m[4], g.m[5]);
  for (const s of g.shapes) {
    ctx.globalAlpha = (s.opacity ?? 1) * alpha;
    ctx.fillStyle = s.fill;
    ctx.fill(path(s.d), s.rule === "evenodd" ? "evenodd" : "nonzero");
  }
  if (g.labels) drawLabels(ctx, g.labels);
  ctx.restore();
}

export async function exportPng(
  groups: readonly DrawGroup[],
  opts: { scale?: number; footer?: string; height?: number } = {},
): Promise<Blob> {
  const height = opts.height ?? FRAME.h;
  let scale = opts.scale ?? 2;
  while (FRAME.w * scale * height * scale > MAX_PIXELS) scale -= 0.25;
  // make sure the handwriting and serif fonts are ready before any text is drawn
  try {
    await Promise.all([document.fonts.load(`32px ${fontFamily("hand")}`), document.fonts.load(`600 15px ${fontFamily("serif")}`)]);
  } catch {
    // fall back to whatever font is available
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(FRAME.w * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available.");
  ctx.scale(scale, scale);

  for (const g of groups) drawGroup(ctx, g);

  // paper grain, clipped to the card
  const pattern = ctx.createPattern(noiseTile(), "repeat");
  if (pattern) {
    ctx.save();
    ctx.clip(new Path2D(cardShape().d));
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, FRAME.w, FRAME.h);
    ctx.restore();
  }

  if (opts.footer) {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim() || "Georgia, serif";
    try {
      await document.fonts.load(`15px ${family}`);
    } catch {
      // fall back to whatever font is available
    }
    ctx.globalAlpha = 1;
    ctx.font = `15px ${family}`;
    ctx.fillStyle = "#D9D1C0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.footer, FRAME.w / 2, 36);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  canvas.width = canvas.height = 0; // free the backing store right away (matters on iOS)
  if (!blob) throw new Error("The image couldn't be created.");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Share the file (a picture or a video) with the native share sheet when possible (and wanted),
 * otherwise download it.
 */
export async function shareOrDownload(blob: Blob, filename: string, text?: string, share = true) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}
