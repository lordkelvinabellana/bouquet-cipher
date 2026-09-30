-- First-party analytics: what happened, never what was written. No message text, names,
-- emails or IP addresses; `session` is a random id for one browser tab. Rows from local
-- development and preview deployments are marked `dev` and left out of the numbers.
create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z_]{2,32}$'),
  session text check (session is null or session ~ '^[A-Za-z0-9_-]{8,40}$'),
  bouquet_id text check (bouquet_id is null or bouquet_id ~ '^[0-9A-Z]{10}$'),
  props jsonb check (props is null or (jsonb_typeof(props) = 'object' and pg_column_size(props) < 600)),
  dev boolean not null default false,
  created_at timestamptz not null default now()
);

create index events_created_at on public.events (created_at);
create index events_name_created_at on public.events (name, created_at);

-- Only the server (service role) reads or writes it.
alter table public.events enable row level security;

-- Each event's count, and how many browser tabs it came from, since a moment.
create or replace function public.event_counts(p_since timestamptz, p_dev boolean default false)
returns table (name text, total bigint, sessions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.name, count(*), count(distinct e.session)
  from public.events e
  where e.created_at >= p_since and e.dev = p_dev
  group by e.name;
$$;

-- Daily counts of some events, for the charts.
create or replace function public.event_daily(p_since timestamptz, p_names text[], p_dev boolean default false, p_tz text default 'UTC')
returns table (day date, name text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (e.created_at at time zone p_tz)::date, e.name, count(*)
  from public.events e
  where e.created_at >= p_since and e.dev = p_dev and e.name = any (p_names)
  group by 1, 2
  order by 1;
$$;

-- How one event splits by one of its flags, e.g. sent by kind (bouquet / card).
create or replace function public.event_breakdown(p_since timestamptz, p_name text, p_key text, p_dev boolean default false)
returns table (value text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.props ->> p_key, '(none)'), count(*)
  from public.events e
  where e.created_at >= p_since and e.dev = p_dev and e.name = p_name
  group by 1
  order by 2 desc;
$$;

revoke all on function public.event_counts(timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.event_daily(timestamptz, text[], boolean, text) from public, anon, authenticated;
revoke all on function public.event_breakdown(timestamptz, text, text, boolean) from public, anon, authenticated;
