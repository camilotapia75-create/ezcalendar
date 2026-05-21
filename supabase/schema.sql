-- Run this in your Supabase SQL editor

create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  title text,
  location text,
  time_str text,
  image_url text,
  created_at timestamp with time zone default now()
);

alter table events enable row level security;

create policy "Users can manage their own events" on events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
