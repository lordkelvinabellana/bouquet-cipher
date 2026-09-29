import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { isCipherKey, newCipherKey } from "@/core/cipher";
import { sceneGroups } from "@/core/scene/scene";
import { toSvgString } from "@/core/scene/svgString";
import { canon } from "@/core/text/canon";
import { fitToLimits } from "@/core/text/limits";

/**
 * Development only: `/api/dev/card?text=I love you&paper=1&key=random` renders the full
 * card as a PNG. `paper` wraps it; `key` is a bouquet key, or "random" for a fresh one
 * (leave it out for the open, unkeyed alphabet).
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") notFound();
  const text = canon(fitToLimits(canon(req.nextUrl.searchParams.get("text") ?? "")));
  const salt = Math.max(0, Number(req.nextUrl.searchParams.get("salt") ?? 0) | 0);
  const paperParam = req.nextUrl.searchParams.get("paper");
  const paper = paperParam === null ? null : Math.min(3, Math.max(0, Number(paperParam) | 0));
  const keyParam = req.nextUrl.searchParams.get("key");
  const cipher = cipherOf(keyParam === "random" ? newCipherKey() : isCipherKey(keyParam) ? keyParam : null);
  const layout = growBouquet(text, cipher, salt);
  const svg = toSvgString(
    sceneGroups(layout, { seal: text ? sealOf(null, text, cipher, salt) : undefined, ribbonSeed: ribbonSeedOf(cipher, salt), paper }),
    { grain: true },
  );
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* rendered by Satori into a PNG, not a page, so next/image doesn't apply */}
        {/* eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element */}
        <img src={src} width={900} height={1350} />
      </div>
    ),
    { width: 900, height: 1350 },
  );
}
