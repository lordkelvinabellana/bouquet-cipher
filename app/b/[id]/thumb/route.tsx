import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import sharp from "sharp";
import { loadBouquet } from "@/server/load";
import { previewSvgFor } from "@/server/preview";

const SIZE = { width: 360, height: 516 };

/** A small picture of a bouquet (or card) for the galleries, as WebP. Bouquets never change, so cache hard. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const b = await loadBouquet((await params).id);
  if (!b) return new Response("Not found", { status: 404 });
  const svg = previewSvgFor(b);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* rendered by Satori into a PNG, not a page, so next/image doesn't apply */}
        {/* eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element */}
        <img src={src} width={SIZE.width} height={SIZE.height} />
      </div>
    ),
    SIZE,
  );
  // the paper grain makes PNGs heavy (about 200 KB); as WebP it's about 16 KB, grain and all
  const webp = await sharp(Buffer.from(await png.arrayBuffer())).webp({ quality: 80 }).toBuffer();
  return new Response(new Uint8Array(webp), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
