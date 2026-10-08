import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FLAGS } from "@/lib/flags";
import { GATE_COOKIE, isGateOpen, isUnlocked, unlockCookie } from "@/lib/gate";
import { Gate } from "@/screens/Gate";
import { isDevTraffic } from "@/server/analytics";
import { gateCopy, monthOf, monthTitle, nickname } from "@/server/personal";
import { getStore } from "@/server/store";
import { currentUser } from "@/lib/supabase/server";
import { CardView } from "@/screens/CardView";
import { Unwrap } from "@/screens/Unwrap";
import { loadBouquet } from "@/server/load";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = await loadBouquet(id);
  if (!b) return { title: "This bouquet has wilted" };
  const what = b.kind === "card" ? "a card" : "a bouquet";
  const title = b.fromName ? `${b.fromName} sent you ${what}` : `Someone sent you ${what}`;
  const description = b.kind === "card" ? "A few words, sealed in an envelope." : "There's a message hidden in these flowers. Open it and read the flowers.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", url: `/b/${id}`, siteName: "Bouquet Cipher" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false, follow: false },
  };
}

export default async function BouquetPage({ params, searchParams }: Props) {
  const { id } = await params;
  // `?solve` opens straight into "decode it yourself"
  const solve = (await searchParams)?.solve !== undefined;
  const b = await loadBouquet(id);
  if (!b) notFound();
  // the private garden: the gate in place of the bouquet (its preview tags above stay)
  const jar = await cookies();
  if (!(await isGateOpen(jar.get(GATE_COOKIE)?.value))) return <Gate endpoint="/api/gate" next={`/b/${b.id}`} {...gateCopy()} />;
  // a bouquet waiting behind a question: closed buds until it's answered
  if (b.lockHash && b.lockQuestion && !(await isUnlocked(b.id, jar.get(unlockCookie(b.id))?.value))) {
    return (
      <Gate
        endpoint={`/api/bouquets/${b.id}/unlock`}
        heading={b.fromName ? `${b.fromName} left you a question` : "Answer this to open it"}
        text={b.lockQuestion}
        label="Your answer"
        button="Open it"
        paper={b.paper}
      />
    );
  }
  // in the private garden: greet her, name the month, and lead on to the next bouquet
  let personal = null;
  if (FLAGS.garden) {
    const month = b.garden ? monthOf(b) : null;
    let next: { href: string; title: string } | null = null;
    let prev: { href: string; title: string } | null = null;
    if (month !== null) {
      const all = (await getStore().garden(isDevTraffic()))
        .map((x) => ({ id: x.id, month: monthOf(x) ?? 0, at: x.createdAt }))
        .sort((x, y) => x.month - y.month || x.at.localeCompare(y.at));
      const i = all.findIndex((x) => x.id === b.id);
      const later = all[i + 1];
      const earlier = i > 0 ? all[i - 1] : null;
      // after the last bouquet comes the finale
      next = later ? { href: `/b/${later.id}`, title: monthTitle(later.month) } : { href: "/finale", title: "One last thing" };
      if (earlier) prev = { href: `/b/${earlier.id}`, title: monthTitle(earlier.month) };
    }
    personal = { nickname: nickname(), occasion: month !== null ? monthTitle(month) : null, next, prev };
  }
  const user = await currentUser();
  const viewer = { signedIn: user !== null, own: user !== null && b.senderId === user.id };
  // its sender has an inbox to answer into
  const replyable = FLAGS.accounts && b.senderId !== null;
  if (b.kind === "card") {
    return (
      <CardView code={b.id} message={b.message} seal={b.seal ?? 0} sealStyle={b.sealStyle} toName={b.toName} fromName={b.fromName} viewer={viewer} replyable={replyable} />
    );
  }
  return (
    <Unwrap
      code={b.id}
      message={b.message}
      salt={b.salt}
      paper={b.paper}
      cipherKey={b.cipherKey}
      senderSeal={b.seal}
      sealStyle={b.sealStyle}
      toName={b.toName}
      fromName={b.fromName}
      viewer={viewer}
      replyable={replyable}
      solve={solve}
      photo={b.photo ? `/b/${b.id}/photo` : null}
      personal={personal}
    />
  );
}
