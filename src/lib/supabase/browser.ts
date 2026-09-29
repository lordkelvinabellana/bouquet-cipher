"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/** A Supabase client for sign-in in the browser (it keeps the session in cookies). */
export function supabaseBrowser() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
}
