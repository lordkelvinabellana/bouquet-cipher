import fs from "node:fs";
import { VideoSpecimen } from "@/components/VideoSpecimen";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { glyphFor, glyphName } from "@/core/alphabet/v1";
import { drawGlyph, standaloneShapes } from "@/core/art";
import { cipherOf } from "@/core/bouquet";
import { EMBLEMS, WAXES, type SealStyle, type Wax } from "@/core/art/seal";
import { FRAME, cardShape, ribbonShapes, sealShapes, stemShape, stitchShapes } from "@/core/art/scenery";
import { PALETTES, PAPER } from "@/core/art/palette";
import { hashString } from "@/core/rng";
import { Paths } from "@/render/svg/Paths";
import { StaticBouquet } from "@/render/svg/StaticBouquet";
import styles from "./specimen.module.css";

export const metadata: Metadata = { title: "Specimen sheet · Bouquet Cipher" };

const VOWELS: ReadonlyArray<readonly [string, string, string]> = [
  ["e", "Tulip", "é"],
  ["a", "Anemone", "á"],
  ["o", "Rose", "ö"],
  ["i", "Iris", "í"],
  ["u", "Philippine violet", "ü"],
  ["y", "Yarrow", "ÿ"],
];
const LEAF_COLUMNS = ["Teardrop", "Round", "Heart", "Slender", "Needle", "Lobed", "Fern"];
const LEAF_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["Sage", "trhsnld"],
  ["Dusty blue", "pcwg mf"],
  ["Coral", "bkvxjqz"],
];
const MARK_CHARS = [".", "…", ",", "!", "?", "'", "’", '"', "-", "–", "—"];
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const HEARTS = ["❤️", "\u{1F495}", "\u{1F9E1}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}", "\u{1F90D}"];
const ACCENTED = ["é", "è", "ê", "ë", "ñ", "å", "ç", "č", "ā", "ă", "ż", "ő", "ą"];
const SEEDS = ["ß", "\u{1F60A}", "&", "@"];

function Tile({ ch, seed = 1, caption }: { ch: string; seed?: number; caption?: string }) {
  const glyph = glyphFor(ch);
  const art = drawGlyph(glyph, seed);
  const label = caption ?? glyphName(glyph);
  return (
    <figure className={styles.tile}>
      <svg viewBox="-60 -108 120 128" className={styles.tileSvg} role="img" aria-label={`${ch}: ${label}`}>
        <path d="M-1.5 22 L1.5 22 L0.9 0 L-0.9 0 Z" fill={PAPER.ink} />
        <Paths shapes={standaloneShapes(art)} />
      </svg>
      <figcaption className={styles.caption}>
        <span className={styles.char}>{ch}</span>
        <span className={styles.name}>{label}</span>
      </figcaption>
    </figure>
  );
}

function EmptyTile({ caption }: { caption: string }) {
  return (
    <figure className={`${styles.tile} ${styles.empty}`}>
      <div className={styles.tileSvg} />
      <figcaption className={styles.caption}>
        <span className={styles.name}>{caption}</span>
      </figcaption>
    </figure>
  );
}

function SceneryPreview() {
  const tie: [number, number] = [300, 742];
  const stems: Array<[number, number][]> = [-24, -12, 0, 12, 24].map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const len = 300 + (2 - Math.abs(i - 2)) * 60;
    return [
      [tie[0] - Math.sin(a) * 110, tie[1] + Math.cos(a) * 110],
      [tie[0], tie[1]],
      [tie[0] + Math.sin(a) * len * 0.5, tie[1] - Math.cos(a) * len * 0.5],
      [tie[0] + Math.sin(a * 1.15) * len, tie[1] - Math.cos(a * 1.15) * len],
    ];
  });
  return (
    <svg viewBox={`0 0 ${FRAME.w} ${FRAME.h}`} className={styles.scene} role="img" aria-label="Card, stems, ribbon and seal">
      <rect width={FRAME.w} height={FRAME.h} fill={PAPER.slate} />
      <Paths shapes={[cardShape(), ...stitchShapes()]} />
      <Paths shapes={stems.map((s) => stemShape(s))} />
      <Paths shapes={ribbonShapes(tie, 7)} />
      <Paths shapes={sealShapes([tie[0], tie[1] + 1], hashString("I love you"))} />
    </svg>
  );
}

/** `?focus=eaoiuy` shows just those glyphs, large, across several seeds (for close inspection). */
function FocusView({ chars, seeds }: { chars: string[]; seeds: number[] }) {
  return (
    <main className={styles.page}>
      <div className={styles.focusGrid}>
        {chars.flatMap((ch) =>
          seeds.map((seed) => (
            <div key={`${ch}-${seed}`} className={styles.focusTile}>
              <Tile ch={ch} seed={seed} caption={`seed ${seed}`} />
            </div>
          )),
        )}
      </div>
    </main>
  );
}

/** `?bouquet=I love you|Happy birthday!` shows whole bouquets for those messages. */
function BouquetView({ messages, withReference }: { messages: string[]; withReference: boolean }) {
  return (
    <main className={styles.page}>
      <div className={styles.compare}>
        {messages.map((m) => (
          <figure key={m} className={styles.bouquetFigure}>
            <StaticBouquet text={m} className={styles.scene} />
            <figcaption>{m}</figcaption>
          </figure>
        ))}
        {withReference ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/_dev/reference.png" alt="Style reference (local only)" className={styles.scene} />
        ) : null}
      </div>
    </main>
  );
}

/** A key that wears palette `p`, found by counting (so the sheet is the same on every load). */
function keyForPalette(p: number): string {
  for (let i = 0; ; i++) {
    const bytes = new Uint8Array(16);
    new DataView(bytes.buffer).setUint32(12, i);
    const key = Buffer.from(bytes).toString("base64url");
    if (cipherOf(key)?.palette === p) return key;
  }
}

/** `?palettes=I love you|Happy birthday!` shows each message in every palette, each with its own key. */
function PaletteView({ messages }: { messages: string[] }) {
  return (
    <main className={styles.page}>
      {messages.map((m) => (
        <section key={m} className={styles.section}>
          <h2>{m}</h2>
          <div className={styles.compare}>
            {PALETTES.map((p) => (
              <figure key={p.id} className={styles.bouquetFigure}>
                <StaticBouquet text={m} cipherKey={keyForPalette(p.id)} className={styles.scene} />
                <figcaption>{p.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

/** `?seals=1` shows every wax colour with every emblem, and initials. */
function SealsView() {
  const marks: SealStyle["mark"][] = [...(Object.keys(EMBLEMS) as (keyof typeof EMBLEMS)[]), { initials: "KA" }, { initials: "M" }];
  return (
    <main className={styles.page}>
      {(Object.keys(WAXES) as Wax[]).map((wax) => (
        <div key={wax} style={{ display: "flex", gap: 12, margin: "12px 0" }}>
          {marks.map((mark, i) => (
            <svg key={i} viewBox="-20 -20 40 40" width={88} height={88} style={{ background: "#FBEFD6", borderRadius: 12 }}>
              <Paths shapes={sealShapes([0, 0], 12345 + i, 1.4, { wax, mark })} />
            </svg>
          ))}
        </div>
      ))}
    </main>
  );
}

export default async function SpecimenPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  if (params.bouquet) {
    const ref = fs.existsSync(path.join(process.cwd(), "public/_dev/reference.png")) && params.ref !== "0";
    return <BouquetView messages={params.bouquet.split("|")} withReference={ref} />;
  }
  if (params.palettes) return <PaletteView messages={params.palettes.split("|")} />;
  if (params.seals) return <SealsView />;
  // `?video=Your message&t=1,3,6&mystery=1` shows frames of the share video
  if (params.video)
    return (
      <VideoSpecimen
        message={params.video}
        times={(params.t ?? "0.5,1.6,2.6,4,6,9,12").split(",").map(Number)}
        reveal={!params.mystery}
        toName={params.to ?? null}
        fromName={params.from ?? null}
      />
    );
  if (params.focus) {
    const seeds = (params.seeds ?? "11,22,33").split(",").map(Number);
    return <FocusView chars={Array.from(params.focus)} seeds={seeds} />;
  }
  const hasReference = fs.existsSync(path.join(process.cwd(), "public/_dev/reference.png"));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Floral alphabet · specimen sheet</h1>
        <p>Every glyph in alphabet v1, drawn by code. Seeds change the decoration only, never the meaning.</p>
      </header>

      <section className={styles.section}>
        <h2>Blooms: vowels and Y</h2>
        <div className={styles.bloomRows}>
          {VOWELS.map(([ch, name, accented]) => (
            <div key={ch} className={styles.row}>
              <div className={styles.rowLabel}>
                <b>{ch.toUpperCase()}</b> {name}
              </div>
              <Tile ch={ch} seed={11} caption="seed 1" />
              <Tile ch={ch} seed={22} caption="seed 2" />
              <Tile ch={ch} seed={33} caption="seed 3" />
              <Tile ch={ch.toUpperCase()} seed={44} caption="capital" />
              <Tile ch={accented} seed={55} caption="accent" />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Leaves: consonants</h2>
        <div className={styles.leafGrid}>
          <div />
          {LEAF_COLUMNS.map((c) => (
            <div key={c} className={styles.colLabel}>
              {c}
            </div>
          ))}
          {LEAF_ROWS.map(([tint, letters]) => (
            <div key={tint} className={styles.contents}>
              <div className={styles.rowLabel}>{tint}</div>
              {Array.from(letters).map((ch, i) =>
                ch === " " ? <EmptyTile key={i} caption="spare" /> : <Tile key={i} ch={ch} seed={100 + i} caption={ch.toUpperCase()} />,
              )}
            </div>
          ))}
          <div className={styles.contents}>
            <div className={styles.rowLabel}>Capitals</div>
            {Array.from("TRHSNLD").map((ch, i) => (
              <Tile key={ch} ch={ch} seed={200 + i} caption="capital" />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Punctuation, numbers and hearts</h2>
        <div className={styles.flow}>
          {MARK_CHARS.map((ch, i) => (
            <Tile key={ch} ch={ch} seed={300 + i} />
          ))}
        </div>
        <div className={styles.flow}>
          {DIGITS.map((ch, i) => (
            <Tile key={ch} ch={ch} seed={400 + i} />
          ))}
        </div>
        <div className={styles.flow}>
          {HEARTS.map((ch, i) => (
            <Tile key={ch} ch={ch} seed={500 + i} />
          ))}
          {SEEDS.map((ch, i) => (
            <Tile key={ch} ch={ch} seed={600 + i} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Accents become dewdrops</h2>
        <div className={styles.flow}>
          {ACCENTED.map((ch, i) => (
            <Tile key={ch} ch={ch} seed={700 + i} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Card, stems, ribbon and seal</h2>
        <div className={styles.compare}>
          <SceneryPreview />
          {hasReference ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/_dev/reference.png" alt="Style reference (local only)" className={styles.scene} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
