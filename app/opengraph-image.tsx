import { ImageResponse } from "next/og";
import { bouquetPreviewSvg } from "@/server/preview";

export const alt = "A hand-drawn bouquet whose flowers spell a message";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A fixed key, so the site's own preview is always the same bouquet. */
const SAMPLE = { message: "Say it with flowers", cipherKey: "SayItWithFlowersBqCphA", paper: 1, seal: 7 };

/** The site's link preview (any page without its own): a wrapped sample bouquet, on slate. */
export default function SiteImage() {
  const svg = bouquetPreviewSvg(SAMPLE);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3E4F57" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={src} width={440} height={630} />
      </div>
    ),
    { ...size },
  );
}
