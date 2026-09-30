-- For the private garden: bouquets planted in "Our garden", a photo tucked in with the
-- letter, and a secret question a bouquet waits behind (only a salted hash of the answer
-- is kept, never the answer).
alter table public.bouquets
  add column garden boolean not null default false,
  add column photo text check (photo is null or photo ~ '^[a-z0-9]{24}\.jpg$'),
  add column lock_question text check (lock_question is null or char_length(lock_question) between 1 and 160),
  add column lock_hash text check (lock_hash is null or lock_hash ~ '^[0-9a-f]{24}\$[0-9a-f]{64}$'),
  add constraint bouquets_lock_complete check ((lock_question is null) = (lock_hash is null));

create index bouquets_garden_created_at on public.bouquets (created_at) where garden;

-- Photos live in a private bucket; only the server (service role) reads or writes them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
