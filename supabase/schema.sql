-- Run this in your Supabase SQL editor

create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  title text,
  location text,
  time_str text,
  image_url text,
  source_url text,
  created_at timestamp with time zone default now()
);

alter table events enable row level security;

create policy "Users can manage their own events" on events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Migration: add source_url to existing tables
-- alter table events add column if not exists source_url text;

-- ============================================================
-- Shared Calendar: invite codes + friend connections
-- ============================================================

-- One permanent invite code per user
create table if not exists calendar_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null unique,
  invite_code text unique not null default encode(gen_random_bytes(8), 'hex'),
  created_at timestamptz default now()
);

alter table calendar_invites enable row level security;

-- Anyone logged in can look up an invite code (needed for join flow)
create policy "Anyone can look up invite codes" on calendar_invites
  for select using (auth.uid() is not null);

-- Users can create their own invite row
create policy "Owner can insert own invite" on calendar_invites
  for insert with check (auth.uid() = owner_id);

-- Bidirectional friend connections (one row per pair, user_a_id < user_b_id)
create table if not exists calendar_connections (
  user_a_id uuid references auth.users(id) on delete cascade not null,
  user_b_id uuid references auth.users(id) on delete cascade not null,
  connected_at timestamptz default now(),
  primary key (user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);

alter table calendar_connections enable row level security;

-- Each user can see connections they are part of
create policy "Users can see own connections" on calendar_connections
  for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Either party can create a connection
create policy "Users can create connections" on calendar_connections
  for insert with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Either party can remove a connection
create policy "Users can delete own connections" on calendar_connections
  for delete using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Allow users to see events from friends they are connected to
-- (works alongside the existing "Users can manage their own events" policy)
create policy "Connected users can see shared events" on events
  for select using (
    exists (
      select 1 from calendar_connections
      where (user_a_id = auth.uid() and user_b_id = events.user_id)
         or (user_b_id = auth.uid() and user_a_id = events.user_id)
    )
  );

-- ─── Day notes (handwritten / drawn notes per calendar day) ──────────────────
create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  text_note text,
  drawing_data text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table day_notes enable row level security;

create policy "Users can manage their own notes" on day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
