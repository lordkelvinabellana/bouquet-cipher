-- Bouquets made by local runs, tests and preview deployments share this database with the
-- live site. Mark them, so "Our garden" on the live site only ever shows real bouquets.
alter table public.bouquets add column test boolean not null default false;

-- Everything planted so far came from test runs (the garden is brand new).
update public.bouquets set test = true where garden;

drop index if exists public.bouquets_garden_created_at;
create index bouquets_garden_created_at on public.bouquets (test, created_at) where garden;
