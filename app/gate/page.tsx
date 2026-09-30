import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateEnabled, isGateOpen } from "@/lib/gate";
import { safeNext } from "@/lib/redirect";
import { Gate } from "@/screens/Gate";
import { gateCopy } from "@/server/personal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bouquet Cipher", robots: { index: false, follow: false } };

export default async function GatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const next = safeNext((await searchParams).next, "/");
  if (!gateEnabled() || (await isGateOpen((await cookies()).get(GATE_COOKIE)?.value))) redirect(next);
  return <Gate next={next} endpoint="/api/gate" {...gateCopy()} />;
}
