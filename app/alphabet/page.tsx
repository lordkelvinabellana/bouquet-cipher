import type { Metadata } from "next";
import Link from "next/link";
import { AccountLink } from "@/components/AccountLink";
import { GlyphSvg } from "@/render/svg/GlyphSvg";
import styles from "./alphabet.module.css";

export const metadata: Metadata = {
  title: "The floral alphabet · Bouquet Cipher",
  description: "How a bouquet keeps a message: every vowel is a flower, every consonant a leaf, every word a stem, and every bouquet has its own secret key.",
};

const BLOOMS: ReadonlyArray<readonly [string, string, string]> = [
  ["e", "Tulip", "the classic cup, for the most common letter"],
  ["a", "Anemone", "broad petals and a dark eye"],
  ["o", "Rose", "round, like an O"],
  ["i", "Iris", "tall and upright, like an I"],
  ["u", "Philippine violet", "a spike of little florets reaching up, like a U held open to the sky"],
  ["y", "Yarrow", "a flat cluster of tiny florets"],
];

const SHAPES = ["Teardrop", "Round", "Heart", "Slender", "Needle", "Lobed", "Fern"];

const LEAVES: ReadonlyArray<{ tint: string; note: string; letters: ReadonlyArray<readonly [string, string] | null> }> = [
  {
    tint: "Sage",
    note: "the seven most common consonants",
    letters: [
      ["t", "Teardrop"],
      ["r", "Round"],
      ["h", "Heart"],
      ["s", "Slender"],
      ["n", "Needle"],
      ["l", "Lobed"],
      ["d", "Divided fern"],
    ],
  },
  {
    tint: "Dusty blue",
    note: "the next six",
    letters: [
      ["p", "Pear-shaped"],
      ["c", "Coin"],
      ["w", "Water-lily pad"],
      ["g", "Grass blade"],
      null,
      ["m", "Maple"],
      ["f", "Fern"],
    ],
  },
  {
    tint: "Coral",
    note: "the rarest seven, always on a thin sprig",
    letters: [
      ["b", "Bay leaf"],
      ["k", "Kidney"],
      ["v", "V-notch"],
      ["x", "Xiphoid (sword)"],
      ["j", "Juniper"],
      ["q", "Quercus (oak)"],
      ["z", "Zigzag frond"],
    ],
  },
];

const MARKS: ReadonlyArray<readonly [string, string, string]> = [
  [".", "Full stop", "a closed bud"],
  [",", "Comma", "a curled tendril"],
  ["!", "Exclamation", "a starburst of florets"],
  ["?", "Question", "a nodding snowdrop"],
  ["'", "Apostrophe", "a thorn"],
  ["-", "Dash", "a knuckle ring on the stem"],
  ["3", "Numbers", "a sprig of one to nine berries"],
  ["0", "…or a seed pod", "the key decides which count is which digit"],
  ["❤️", "Hearts", "a heart-shaped bloom"],
  ["é", "Accents", "a dewdrop, shaped by the accent"],
];

export default function AlphabetPage() {
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Bouquet Cipher
        </Link>
        <span className={styles.links}>
          <AccountLink />
          <Link href="/create" className={styles.cta}>
            Grow a bouquet
          </Link>
        </span>
      </header>

      <h1 className={styles.title}>The floral alphabet</h1>
      <p className={styles.lede}>Every bouquet is a message. Here’s how one is written.</p>

      <section className={styles.how}>
        <ol>
          <li>
            <b>Each stem is a word.</b> Start with the tall stem in the middle, then the one to its right, then the one to its left. Then
            read the tier in front of them the same way, from the middle outward, and keep going toward the ribbon. (Press “Read the
            flowers” on any bouquet to watch the order light up.)
          </li>
          <li>
            <b>Read each stem from the bottom up.</b>
          </li>
          <li>
            <b>Flowers are vowels, leaves are consonants.</b> Buds, curls and berries are punctuation and numbers. A bigger, fuller version
            of a flower or leaf is a capital letter.
          </li>
          <li>
            <b>Every bouquet has its own secret key.</b> The key shuffles which flower stands for which vowel, and which leaf for which
            consonant, and it shuffles them again for every letter. So no two bouquets look alike, even two that both say “I love you”, and
            nobody can read one by eye. The key stays with the app; the bouquet’s link or gift tag is how the person you send it to opens it.
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Flowers: the vowels (and Y)</h2>
        <p className={styles.note}>
          The six flowers a vowel can grow into, shown with the letter each stands for before a key shuffles them. A flower’s colour is only
          decoration: each bouquet’s key picks its own palette.
        </p>
        <div className={styles.grid}>
          {BLOOMS.map(([ch, name, hook], i) => (
            <figure key={ch} className={styles.tile}>
              <GlyphSvg ch={ch} seed={31 + i} className={styles.svg} />
              <figcaption>
                <span className={styles.letter}>{ch.toUpperCase()}</span>
                <span className={styles.name}>{name}</span>
                <span className={styles.hook}>{hook}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Leaves: the consonants</h2>
        <p className={styles.note}>
          A leaf’s tint says how common its consonant is, and the key decides which leaf of that tint is which letter. Before the key, each
          leaf’s name starts with its letter. The tints here are the Garden palette’s; other palettes swap in their own fresh greens, blues
          and warm tones.
        </p>
        <div className={styles.leafScroll}>
          <div className={styles.leafGrid}>
            <div />
            {SHAPES.map((s) => (
              <div key={s} className={styles.colLabel}>
                {s}
              </div>
            ))}
            {LEAVES.map((row) => (
              <div key={row.tint} className={styles.contents}>
                <div className={styles.rowLabel}>
                  <b>{row.tint}</b>
                  <span>{row.note}</span>
                </div>
                {row.letters.map((cell, i) =>
                  cell ? (
                    <figure key={cell[0]} className={styles.tile}>
                      <GlyphSvg ch={cell[0]} seed={61 + i} className={styles.svg} />
                      <figcaption>
                        <span className={styles.letter}>{cell[0].toUpperCase()}</span>
                        <span className={styles.hook}>{cell[1]}</span>
                      </figcaption>
                    </figure>
                  ) : (
                    <div key={`spare-${i}`} className={styles.spare} aria-label="Unused" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Punctuation, numbers and the rest</h2>
        <div className={styles.grid}>
          {MARKS.map(([ch, name, hook], i) => (
            <figure key={name} className={styles.tile}>
              <GlyphSvg ch={ch} seed={91 + i} className={styles.svg} />
              <figcaption>
                <span className={styles.name}>{name}</span>
                <span className={styles.hook}>{hook}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.note}>Anything else, like other emoji or other alphabets, becomes a small mystery seed. The message still keeps it.</p>
      </section>

      <p className={styles.footer}>
        <Link href="/create" className={styles.cta}>
          Grow a bouquet
        </Link>
      </p>
    </main>
  );
}
