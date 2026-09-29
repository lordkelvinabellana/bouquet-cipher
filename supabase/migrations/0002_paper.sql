-- The wrapping paper chosen for a bouquet (0 kraft, 1 blush, 2 sage, 3 midnight).
alter table public.bouquets
  add column paper smallint not null default 0 check (paper between 0 and 3);
