import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FLAGS } from "@/lib/flags";
import { Greeting } from "@/screens/Greeting";
import { latestGreeting, PERSONAL } from "@/server/personal";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "For you · Bouquet Cipher", robots: { index: false, follow: false } };

/** How many photo frames the greeting has (their photos are GREETING-1.jpg … in the private bucket). */
const FRAMES = 3;

/** The special link's greeting (reached at /for-april; see proxy.ts). Behind the gate. */
export default async function GreetingPage() {
  if (!FLAGS.garden) notFound();
  const g = latestGreeting();
  if (!g) redirect("/garden");
  // only the photos that exist; the rest show a soft stand-in (a missing image never flashes broken)
  const names = Array.from({ length: FRAMES }, (_, i) => `greeting-${i + 1}.jpg`);
  const exist = await getStore().photosThatExist(names);
  const photos = names.map((n, i) => (exist.has(n) ? `/greeting/photo/${i + 1}` : null));
  return <Greeting title={g.title} line={g.line} note={g.note} photos={photos} from={PERSONAL.from} />;
}
