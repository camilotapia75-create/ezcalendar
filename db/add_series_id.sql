-- Enables recurring events ("every Thursday") to be deleted as a group.
-- Run once in Supabase → SQL Editor. Safe/additive; no data change.

alter table events add column if not exists series_id text;
create index if not exists events_series_id_idx on events (series_id);

-- RLS: existing per-user policies on `events` already scope every row by
-- user_id, so deleting by series_id stays gated to the owner. No policy change.
