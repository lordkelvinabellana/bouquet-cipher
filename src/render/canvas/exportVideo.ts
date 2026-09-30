"use client";
/**
 * A short vertical video (1080×1920, made for Stories and TikTok) of the bouquet growing
 * and then being read back into its message, or left as a mystery. Every frame replays
 * the same draw list as the picture export, and frames are encoded straight to MP4 with
 * WebCodecs, faster than real time and identical on every run.
 */
import { BufferTarget, CanvasSource, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat } from "mediabunny";
import { apply, compose, scale, translate } from "@/core/art/geom";
import { cardShape, FRAME } from "@/core/art/scenery";
import type { Cipher } from "@/core/cipher";
import type { BouquetLayout } from "@/core/layout/v1/layout";
import { cameraMatrix, sceneGroups } from "@/core/scene/scene";
import { FLY, FPS, planVideo, POP, popScale, readingAt, sweepAt, type VideoPlan } from "@/core/video/timeline";
import { drawGroup, fontFamily, noiseTile } from "./exportPng";

/** The video in logical units (the card frame is 600 wide), and its pixel scale. */
const W = 600;
const H = (W * 16) / 9;
const PX = 1.8;
/** Where the 600×900 card sits in the video. */
const CARD_AT = { x: 54, y: 124, k: 0.82 };
const TEXT_TOP = 884;
const TEXT_BOTTOM = 994;
const TEXT_WIDTH = 520;

const SLATE = "#3E4F57";
const ON_SLATE = "#F4EAD7";
const MUTED = "#C9C3B4";

export class VideoUnsupportedError extends Error {
  constructor() {
    super("This browser can’t make videos. Try the latest Chrome, Safari or Edge.");
  }
}

export interface VideoInput {
  layout: BouquetLayout;
  cipher: Cipher | null;
  /** Read the message out, or keep it a mystery. */
  reveal: boolean;
  seal: number;
  sealStyle: string | null;
  ribbonSeed: number;
  toName: string | null;
  fromName: string | null;
  /** The bouquet's link, shown at the bottom (without the https://). */
  link: string;
}

export interface VideoFile {
  blob: Blob;
  filename: string;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Break text into lines that fit `width` at the current font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** The message's font size and lines, fitted once so the text never reflows as it's written. */
function fitMessage(ctx: CanvasRenderingContext2D, text: string, hand: string) {
  for (let size = 40; size >= 20; size -= 2) {
    ctx.font = `${size}px ${hand}`;
    let lines = wrapLines(ctx, text, TEXT_WIDTH);
    const lineHeight = size * 1.12;
    if (lines.length * lineHeight <= TEXT_BOTTOM - TEXT_TOP) {
      // balance the lines: the narrowest width that still needs no extra line
      let lo = TEXT_WIDTH * 0.4;
      let hi = TEXT_WIDTH;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (wrapLines(ctx, text, mid).length > lines.length) lo = mid;
        else hi = mid;
      }
      lines = wrapLines(ctx, text, hi);
      return { size, lines, lineHeight };
    }
  }
  ctx.font = `20px ${hand}`;
  return { size: 20, lines: wrapLines(ctx, text, TEXT_WIDTH), lineHeight: 22.4 };
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, alpha = 1, spacing = 0) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in spaced) spaced.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  if ("letterSpacing" in spaced) spaced.letterSpacing = "0px";
}

function makePainter(ctx: CanvasRenderingContext2D, input: VideoInput, plan: VideoPlan, hand: string, serif: string) {
  const groups = sceneGroups(input.layout, { seal: input.seal, sealStyle: input.sealStyle, ribbonSeed: input.ribbonSeed, present: true }).slice(1); // the slate is painted separately
  const elements = new Map(input.layout.elements.map((e) => [e.key, e]));
  const cam = cameraMatrix(plan.camera);
  const paths = new Map<string, Path2D>();
  const path = (d: string) => {
    let p = paths.get(d);
    if (!p) paths.set(d, (p = new Path2D(d)));
    return p;
  };
  const grain = ctx.createPattern(noiseTile(), "repeat");
  const card = new Path2D(cardShape().d);

  const written = plan.reads.map((r) => r.step.char).join("");
  const message = fitMessage(ctx, written, hand);
  // where each read step lands in the message (null for the spaces between lines)
  ctx.font = `${message.size}px ${hand}`;
  const textTop = TEXT_TOP + (TEXT_BOTTOM - TEXT_TOP - message.lines.length * message.lineHeight) / 2 + message.lineHeight / 2;
  const landing: Array<{ x: number; y: number; line: number; upto: number } | null> = [];
  message.lines.forEach((l, i) => {
    const chars = Array.from(l);
    const left = W / 2 - ctx.measureText(l).width / 2;
    chars.forEach((c, k) => {
      const before = ctx.measureText(chars.slice(0, k).join("")).width;
      landing.push({ x: left + before + ctx.measureText(c).width / 2, y: textTop + i * message.lineHeight, line: i, upto: k + 1 });
    });
    landing.push(null); // the space or line break that ended the line
  });
  const toVideo = (p: [number, number]): [number, number] => [CARD_AT.x + p[0] * CARD_AT.k, CARD_AT.y + p[1] * CARD_AT.k];

  const title = input.toName ? `A bouquet for ${input.toName}` : input.fromName ? `A bouquet from ${input.fromName}` : "A bouquet with a secret";

  return (t: number) => {
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = SLATE;
    ctx.fillRect(0, 0, W, H);

    // header
    text(ctx, "BOUQUET CIPHER", W / 2, 50, `600 13px ${serif}`, MUTED, 1, 3);
    text(ctx, title, W / 2, 90, `36px ${hand}`, ON_SLATE, clamp01(t / 0.5));

    // the card and the bouquet
    ctx.save();
    ctx.translate(CARD_AT.x, CARD_AT.y);
    ctx.scale(CARD_AT.k, CARD_AT.k);
    const line = sweepAt(plan, t);
    const reading = readingAt(plan, t);
    const current = reading >= 0 && t < plan.outro ? plan.reads[reading] : null;
    for (const g of groups) {
      const e = g.key ? elements.get(g.key) : undefined;
      if (e) {
        const p = (t - (plan.pops.get(e.key) ?? 0)) / POP;
        if (p <= 0) continue;
        const s = popScale(p);
        const f: [number, number] = [e.art.focus.x, e.art.focus.y];
        drawGroup(ctx, { ...g, m: compose(g.m, translate(f[0], f[1]), scale(s), translate(-f[0], -f[1])) }, path, clamp01(p * 2.5));
      } else if (g.key === "stems") {
        // the stems rise with the growth line
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, line, FRAME.w, FRAME.h);
        ctx.clip();
        drawGroup(ctx, g, path);
        ctx.restore();
      } else drawGroup(ctx, g, path);
    }
    if (grain) {
      ctx.save();
      ctx.clip(card);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, FRAME.w, FRAME.h);
      ctx.restore();
    }
    // the flower being read glows
    if (current && current.step.kind === "element") {
      const { focus, r } = current.step;
      const u = clamp01((t - current.at) / 0.12);
      ctx.save();
      ctx.transform(cam[0], cam[1], cam[2], cam[3], cam[4], cam[5]);
      [1.9, 1.45, 1.1].forEach((k, i) => {
        ctx.globalAlpha = (0.22 + i * 0.1) * u;
        ctx.fillStyle = "#FFF6DA";
        ctx.beginPath();
        ctx.arc(focus[0], focus[1], r * k, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.restore();

    // below the card: the message as it's read, or the question
    if (input.reveal) {
      // letters that have landed are written; the ones in the air fly from their flowers
      const landed = plan.reads.filter((r) => r.at + FLY <= t).length;
      const shown = new Map<number, number>();
      for (let k = 0; k < landed; k++) {
        const at = landing[k];
        if (at) shown.set(at.line, Math.max(shown.get(at.line) ?? 0, at.upto));
      }
      message.lines.forEach((l, i) => {
        const n = shown.get(i) ?? 0;
        if (!n) return;
        const chars = Array.from(l);
        const part = chars.slice(0, n).join("");
        ctx.font = `${message.size}px ${hand}`;
        const x = W / 2 - ctx.measureText(l).width / 2 + ctx.measureText(part).width / 2;
        text(ctx, part, x, textTop + i * message.lineHeight, `${message.size}px ${hand}`, ON_SLATE);
      });
      plan.reads.forEach((r, k) => {
        const u = (t - r.at) / FLY;
        const to = landing[k];
        if (u <= 0 || u >= 1 || r.step.kind !== "element" || !to) return;
        const [fx, fy] = toVideo(apply(cam, r.step.focus) as [number, number]);
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        // up off the flower, then an arc down to its place
        const lift = 40 + Math.abs(to.y - fy) * 0.12;
        const x = fx + (to.x - fx) * e;
        const y = fy + (to.y - fy) * e - Math.sin(Math.PI * e) * lift - (1 - e) * 16 * Math.min(1, u * 5);
        const size = message.size * (1 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1)));
        const melt = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
        const a = Math.min(1, u * 6);
        ctx.save();
        ctx.globalAlpha = a * melt;
        ctx.fillStyle = "#FFF6DA";
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.font = `${size}px ${hand}`;
        const w = Math.max(size * 0.62, ctx.measureText(r.step.char).width) + size * 0.5;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - size * 0.62, w, size * 1.2, size * 0.6);
        ctx.fill();
        ctx.restore();
        text(ctx, r.step.char, x, y, `${size}px ${hand}`, melt < 1 ? ON_SLATE : "#3A3833", a);
      });
      if (input.fromName) {
        const a = clamp01((t - plan.outro) / 0.4);
        if (a > 0) text(ctx, input.fromName, W / 2 + 140, textTop + message.lines.length * message.lineHeight - message.lineHeight / 2 + 18, `30px ${hand}`, MUTED, a);
      }
    } else {
      const a = clamp01((t - plan.outro) / 0.5);
      if (a > 0) {
        text(ctx, "Can you read it?", W / 2, TEXT_TOP + 38, `48px ${hand}`, ON_SLATE, a);
        text(ctx, "Every flower is a letter.", W / 2, TEXT_TOP + 92, `17px ${serif}`, MUTED, a);
      }
    }
    text(ctx, input.reveal ? input.link.replace(/\/b\/.*$/, "") : `Read it at ${input.link}`, W / 2, H - 30, `15px ${serif}`, MUTED, 0.9);
  };
}

async function loadFonts() {
  const hand = fontFamily("hand");
  const serif = fontFamily("serif");
  try {
    await Promise.all([document.fonts.load(`36px ${hand}`), document.fonts.load(`600 13px ${serif}`), document.fonts.load(`15px ${serif}`)]);
  } catch {
    // fall back to whatever font is available
  }
  return { hand, serif };
}

/** Draw single frames onto a canvas (the specimen sheet uses this to check the video). */
export async function videoFrames(canvas: HTMLCanvasElement, input: VideoInput) {
  const { hand, serif } = await loadFonts();
  canvas.width = Math.round(W * PX);
  canvas.height = Math.round(H * PX);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn’t available.");
  const plan = planVideo(input.layout, input.cipher, input.reveal);
  return { plan, paint: makePainter(ctx, input, plan, hand, serif) };
}

/** Make the video. `onProgress` gets 0…1 as frames are encoded. */
export async function exportVideo(input: VideoInput, onProgress?: (done: number) => void): Promise<VideoFile> {
  if (typeof VideoEncoder === "undefined") throw new VideoUnsupportedError();
  const width = Math.round(W * PX);
  const height = Math.round(H * PX);
  const mp4 = await getFirstEncodableVideoCodec(["avc", "hevc"], { width, height });
  const webm = mp4 ? null : await getFirstEncodableVideoCodec(["vp9", "vp8", "av1"], { width, height });
  const codec = mp4 ?? webm;
  if (!codec) throw new VideoUnsupportedError();

  const { hand, serif } = await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn’t available.");

  const plan = planVideo(input.layout, input.cipher, input.reveal);
  const paint = makePainter(ctx, input, plan, hand, serif);
  const format = mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat();
  const output = new Output({ format, target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const frames = Math.round(plan.duration * FPS);
  try {
    for (let i = 0; i < frames; i++) {
      const t = i / FPS;
      paint(t);
      await source.add(t, 1 / FPS);
      if (i % 6 === 0) {
        onProgress?.(i / frames);
        // let the page breathe (progress, taps) between batches of frames
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    canvas.width = canvas.height = 0;
  }
  onProgress?.(1);
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("The video couldn’t be created.");
  return { blob: new Blob([buffer], { type: format.mimeType }), filename: `bouquet${format.fileExtension}` };
}
