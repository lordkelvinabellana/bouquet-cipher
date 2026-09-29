/**
 * Supabase settings the browser may see: the project URL and its public (anon or
 * publishable) key. Sign-in is available only when both are set; without them the app
 * still works, anonymously.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function authEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
}
