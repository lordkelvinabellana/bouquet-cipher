/**
 * Feature flags, set per deployment with environment variables (so the same code can be
 * a public site or a private one). "off", "0", "false" or "no" turns a feature off.
 *
 *   NEXT_PUBLIC_FEATURE_ACCOUNTS  sign-in, galleries, inbox replies     (default on)
 *   NEXT_PUBLIC_FEATURE_STATS     the owner's /stats dashboard            (default on)
 *   NEXT_PUBLIC_FEATURE_GARDEN    "Our garden": every bouquet, by month   (default off)
 *   NEXT_PUBLIC_FEATURE_PHOTOS    a photo tucked in with the letter       (default off)
 *   NEXT_PUBLIC_FEATURE_LOCKS     lock a bouquet with a secret question   (default off)
 *
 * The private site itself is switched on by setting SITE_PASSPHRASE (server only).
 */
const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined || value.trim() === "" ? fallback : !/^(0|off|false|no)$/i.test(value.trim());

export const FLAGS = {
  accounts: flag(process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS, true),
  stats: flag(process.env.NEXT_PUBLIC_FEATURE_STATS, true),
  garden: flag(process.env.NEXT_PUBLIC_FEATURE_GARDEN, false),
  photos: flag(process.env.NEXT_PUBLIC_FEATURE_PHOTOS, false),
  locks: flag(process.env.NEXT_PUBLIC_FEATURE_LOCKS, false),
} as const;
