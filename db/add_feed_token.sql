-- Per-user secret token for the subscribable calendar feed
-- (webcal://<domain>/api/calendar/<feed_token>.ics).
-- Run once in Supabase → SQL Editor. Safe/additive.

alter table calendar_invites add column if not exists feed_token uuid default gen_random_uuid();

-- Give any existing rows a token
update calendar_invites set feed_token = gen_random_uuid() where feed_token is null;

create index if not exists calendar_invites_feed_token_idx on calendar_invites (feed_token);
