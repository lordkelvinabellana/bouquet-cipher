import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authEnabled, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/** A Supabase client acting as the signed-in visitor (their session lives in cookies). */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Server Components can't set cookies; proxy.ts keeps sessions fresh instead.
        }
      },
    },
  });
}

/** The signed-in user, checked with the auth server (null when signed out, or without Supabase). */
export async function currentUser(): Promise<User | null> {
  if (!authEnabled()) return null;
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user ?? null;
}
