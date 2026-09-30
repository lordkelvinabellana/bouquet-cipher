"use client";
import { useEffect, useRef } from "react";
import { cipherOf, growBouquet, ribbonSeedOf, sealOf } from "@/core/bouquet";
import { videoFrames } from "@/render/canvas/exportVideo";

const KEY = "specimenSpecimenSpecxA";

/** Dev only: frames of the share video at chosen times, for checking it by eye. */
export function VideoSpecimen({ message, times, reveal, toName, fromName }: { message: string; times: number[]; reveal: boolean; toName: string | null; fromName: string | null }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    const cipher = cipherOf(KEY) ?? null;
    const layout = growBouquet(message, cipher);
    refs.current.forEach(async (canvas, i) => {
      if (!canvas) return;
      const { paint } = await videoFrames(canvas, {
        layout,
        cipher,
        reveal,
        seal: sealOf(null, message, cipher),
        sealStyle: null,
        ribbonSeed: ribbonSeedOf(cipher),
        toName,
        fromName,
        link: "bouquet-cipher.vercel.app/b/ABCDE12345",
      });
      paint(times[i]);
    });
  }, [message, times, reveal, toName, fromName]);
  return (
    <main style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 12, background: "#222" }}>
      {times.map((t, i) => (
        <figure key={t} style={{ margin: 0, color: "#ccc", font: "12px system-ui" }}>
          <canvas ref={(el) => void (refs.current[i] = el)} style={{ width: 270, height: 480, display: "block" }} />
          <figcaption>t = {t}s</figcaption>
        </figure>
      ))}
    </main>
  );
}
