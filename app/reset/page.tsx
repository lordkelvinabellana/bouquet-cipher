import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { NewPassword } from "@/screens/NewPassword";

export const metadata: Metadata = { title: "Choose a new password · Bouquet Cipher", robots: { index: false } };

/** Reached from a password-reset email (which has already signed the person in). */
export default async function ResetPage() {
  if (!(await currentUser())) redirect("/login?error=link");
  return <NewPassword />;
}
