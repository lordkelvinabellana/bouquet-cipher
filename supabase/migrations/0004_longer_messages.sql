-- Messages can now hold 120 characters (graphemes, enforced in the API). One grapheme can
-- be several code points (emoji sequences, stacked accents), so the column allows as many
-- as the API accepts in raw input.
alter table public.bouquets drop constraint bouquets_message_check;
alter table public.bouquets add constraint bouquets_message_check check (char_length(message) between 1 and 2000);
