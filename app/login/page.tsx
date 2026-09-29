import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/redirect";
import { authEnabled, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";
import { SignIn } from "@/screens/SignIn";

export const metadata: Metadata = { title: "Sign in · Bouquet Cipher", robots: { index: false } };

/** Is this sign-in provider switched on in Supabase (Authentication → Providers)? */
async function providerOn(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLIC_KEY }, next: { revalidate: 300 } });
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.[name] === true;
  } catch {
    return false;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  if (!authEnabled()) {
    return (
      <main style={{ padding: "48px 16px", textAlign: "center" }}>
        <p>Accounts aren’t set up here yet. You can still make and read bouquets without one.</p>
        <Link href="/create">Make a bouquet</Link>
      </main>
    );
  }
  if (await currentUser()) redirect(target);
  return <SignIn next={target} google={await providerOn("google")} error={error} />;
}
