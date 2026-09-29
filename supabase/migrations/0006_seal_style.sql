-- A custom wax seal for accounts: the wax colour and the emblem, e.g. 'gold/heart' or
-- 'navy/i:KA' (see src/core/art/seal.ts). Bouquets keep the style they were sent with.
alter table public.profiles
  add column seal_style text check (seal_style is null or seal_style ~ '^(red|rose|gold|forest|navy|plum)/(rosette|heart|star|moon|leaf|flower|i:[A-Z]{1,2})$');
alter table public.bouquets
  add column seal_style text check (seal_style is null or seal_style ~ '^(red|rose|gold|forest|navy|plum)/(rosette|heart|star|moon|leaf|flower|i:[A-Z]{1,2})$');
