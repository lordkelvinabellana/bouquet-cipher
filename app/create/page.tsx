import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ID_PATTERN } from "@/core/code";
import { newCipherKey } from "@/core/cipher";
import { currentUser } from "@/lib/supabase/server";
import { Composer } from "@/screens/Composer";
import { getStore } from "@/server/store";

export const metadata: Metadata = {
  title: "Create a bouquet · Bouquet Cipher",
  description: "Type a message and watch it grow into a bouquet, then wrap it up and send it.",
};

export default async function CreatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { to, reply } = await searchParams;
  let initialTo = typeof to === "string" ? to.slice(0, 60) : "";
  const user = await currentUser();
  const store = getStore();
  const me = user ? await store.profile(user.id) : null;

  // Replying: the bouquet goes to the original sender's inbox, so it needs an account.
  let replyTo: string | null = null;
  if (typeof reply === "string" && ID_PATTERN.test(reply)) {
    const original = await store.get(reply);
    if (original?.senderId) {
      if (!user) redirect(`/login?next=${encodeURIComponent(`/create?reply=${reply}`)}`);
      replyTo = original.id;
      initialTo = original.fromName ?? initialTo;
    }
  }

  // a fresh key for every visit (this page is rendered per request)
  return (
    <Composer
      initialTo={initialTo}
      initialKey={newCipherKey()}
      account={me ? { seal: me.seal, name: me.displayName, sealStyle: me.sealStyle } : null}
      replyTo={replyTo}
    />
  );
}
