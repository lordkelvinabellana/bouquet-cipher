import { ImageResponse } from "next/og";
import { loadBouquet } from "@/server/load";
import { bouquetPreviewSvg, cardPreviewSvg } from "@/server/preview";

export const alt = "A bouquet of flowers with a hidden message";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The chat-app preview: the real bouquet on its card, on slate. Bouquets never change, so cache hard. */
export default async function PreviewImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await loadBouquet(id);
  // a card shows its sealed envelope; a bouquet, its flowers (never the words)
  const svg =
    b?.kind === "card"
      ? cardPreviewSvg(b.seal ?? 0, b.sealStyle)
      : bouquetPreviewSvg({ message: b?.message ?? "", salt: b?.salt, paper: b?.paper, cipherKey: b?.cipherKey, seal: b?.seal, sealStyle: b?.sealStyle });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3E4F57" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={src} width={440} height={630} />
      </div>
    ),
    {
      ...size,
      headers: b ? { "Cache-Control": "public, max-age=31536000, immutable" } : undefined,
    },
  );
}
