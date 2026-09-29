-- Every bouquet's secret key (it shuffles which flower means which letter, and picks the
-- colours), and the sender's signature seal. Older rows keep null: they use the open
-- alphabet (alphabet_v 1).
alter table public.bouquets
  add column cipher_key text check (cipher_key is null or cipher_key ~ '^[A-Za-z0-9_-]{21}[AQgw]$'),
  add column seal bigint check (seal is null or seal between 0 and 4294967295);
