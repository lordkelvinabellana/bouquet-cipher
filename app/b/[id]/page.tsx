import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  const user = await currentUser();
  const viewer = { signedIn: user !== null, own: user !== null && b.senderId === user.id };
  // its sender has an inbox to answer into
  const replyable = b.senderId !== null;
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
    />
  );
}
