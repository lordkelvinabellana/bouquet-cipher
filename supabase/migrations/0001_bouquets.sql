-- Bouquets: one row per shared bouquet. The link itself is the only way in.
create table public.bouquets (
  id          text primary key check (id ~ '^[0-9A-Za-z]{10}$'),        -- random base62 slug (unguessable)
  message     text not null check (char_length(message) between 1 and 400), -- exact 80-grapheme rule is enforced in the API
  salt        integer  not null default 0 check (salt >= 0),
  alphabet_v  smallint not null default 1,
  to_name     text check (char_length(to_name)   <= 80),
  from_name   text check (char_length(from_name) <= 80),
  created_at  timestamptz not null default now()
);

-- No policies: the anon and authenticated roles can't read or write anything.
-- Only server code using the service role key touches this table.
alter table public.bouquets enable row level security;

-- Per-IP creation counter for rate limiting (IPs are stored hashed, never raw).
create table public.bouquet_rate (
  ip_hash     text not null,
  window_start timestamptz not null,
  count       integer not null default 0,
  primary key (ip_hash, window_start)
);
alter table public.bouquet_rate enable row level security;

-- Atomically count one creation for this IP in the current 10-minute window.
-- Returns the new count so the API can refuse when it's over the limit.
create or replace function public.bump_bouquet_rate(p_ip_hash text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.bouquet_rate as r (ip_hash, window_start, count)
  values (p_ip_hash, date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes', 1)
  on conflict (ip_hash, window_start) do update set count = r.count + 1
  returning count;
$$;

revoke all on function public.bump_bouquet_rate(text) from public, anon, authenticated;
