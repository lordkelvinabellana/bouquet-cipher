import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canon } from "@/core/text/canon";
import { measure } from "@/core/text/limits";
import { FLAGS } from "@/lib/flags";
import { Finale } from "@/screens/Finale";
import { isDevTraffic } from "@/server/analytics";
import { monthOf, PERSONAL } from "@/server/personal";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "One last thing · Bouquet Cipher", robots: { index: false, follow: false } };

/** Which months' photos gather around the finale's bouquet: the first, each anniversary, and the last. */
const MOMENTS = [0, 12, 24, 36, 48, 50];

/** After the last bouquet: one big bouquet, your photos around it, and a last letter. Behind the gate. */
export default async function FinalePage() {
  if (!FLAGS.garden) notFound();
  const garden = await getStore().garden(isDevTraffic());
  const withPhotos = garden.filter((b) => b.photo).map((b) => ({ id: b.id, month: monthOf(b) ?? 0 }));
  const photos = MOMENTS.map((m) => withPhotos.find((b) => b.month === m))
    .filter((b): b is { id: string; month: number } => !!b)
    .map((b) => `/b/${b.id}/photo`);
  const words = canon(PERSONAL.finale.bouquet);
  const bouquet = measure(words).tooLong ? "I love you" : words;
  return (
    <Finale title={PERSONAL.finale.title} bouquet={bouquet} note={PERSONAL.finale.note} from={PERSONAL.from} her={PERSONAL.nicknames[0] ?? PERSONAL.name} photos={photos} />
  );
}
