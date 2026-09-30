-- A letter can be planted in a particular month of the garden ("for our 12th Monthsarudle"),
-- whenever it's written. Months are counted from TOGETHER_SINCE: 0 is the first month.
alter table public.bouquets
  add column month smallint check (month is null or month between 0 and 1200);
