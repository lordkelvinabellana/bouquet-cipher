import "server-only";
import { cache } from "react";
import { ID_PATTERN, normaliseCode } from "@/core/code";
import { getStore, type StoredBouquet } from "./store";

/**
 * Load a bouquet once per request (shared by the page, its metadata and its preview
 * image). Codes typed into a link by hand (lowercase, O for 0…) are normalised too.
 */
export const loadBouquet = cache(async (id: string): Promise<StoredBouquet | null> => {
  if (!ID_PATTERN.test(id)) return null;
  const store = getStore();
  const exact = await store.get(id);
  if (exact) return exact;
  const normal = normaliseCode(id);
  return normal && normal !== id ? store.get(normal) : null;
});
