import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FLAGS } from "@/lib/flags";
import { Greeting } from "@/screens/Greeting";
import { latestGreeting } from "@/server/personal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "For you · Bouquet Cipher", robots: { index: false, follow: false } };

/** How many photo frames the greeting has (their photos are GREETING-1.jpg … in the private bucket). */
const FRAMES = 3;

/** The special link's greeting (reached at /for-april; see proxy.ts). Behind the gate. */
export default function GreetingPage() {
  if (!FLAGS.garden) notFound();
  const g = latestGreeting();
  if (!g) redirect("/garden");
  return (
    <Greeting title={g.title} line={g.line} note={g.note} photos={Array.from({ length: FRAMES }, (_, i) => `/greeting/photo/${i + 1}`)} />
  );
}
