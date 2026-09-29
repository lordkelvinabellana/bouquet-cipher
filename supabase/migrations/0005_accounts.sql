-- Accounts: profiles, who sent a bouquet and who it's for, replies, and the bouquets
-- people keep. As before, only server code (the service role) reads or writes these
-- tables; row-level security is on with no policies, so the public keys can't.

-- One profile per account, made when the account is.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  -- the account's signature: the wax seal on every bouquet it sends
  seal         bigint not null check (seal between 0 and 4294967295),
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, seal)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 40),
    floor(random() * 4294967296)::bigint
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bouquets (and cards) now know who sent them, whose inbox they're in, and what they
-- answer. Anonymous bouquets keep working: every new column is optional.
alter table public.bouquets
  add column sender_id    uuid references auth.users (id) on delete set null,
  add column recipient_id uuid references auth.users (id) on delete set null,
  add column reply_to     text references public.bouquets (id) on delete set null,
  add column kind         text not null default 'bouquet' check (kind in ('bouquet', 'card')),
  add column read_at      timestamptz;

create index bouquets_sender_idx on public.bouquets (sender_id, created_at desc) where sender_id is not null;
create index bouquets_recipient_idx on public.bouquets (recipient_id, created_at desc) where recipient_id is not null;

-- Bouquets opened from a link while signed in, kept in that person's Received gallery.
create table public.kept (
  user_id    uuid not null references auth.users (id) on delete cascade,
  bouquet_id text not null references public.bouquets (id) on delete cascade,
  kept_at    timestamptz not null default now(),
  primary key (user_id, bouquet_id)
);
create index kept_user_idx on public.kept (user_id, kept_at desc);
alter table public.kept enable row level security;
