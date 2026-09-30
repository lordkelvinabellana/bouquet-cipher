/**
 * Supabase settings the browser may see: the project URL and its public (anon or
 * publishable) key. Sign-in is available only when both are set; without them the app
 * still works, anonymously.
 */
import { FLAGS } from "../flags";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sign-in is on: Supabase is set up, and the accounts feature isn't switched off. */
export function authEnabled(): boolean {
  return FLAGS.accounts && Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
}
