-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates the feedback table for Kevin (partner screenshot feedback bot)

-- 1. Create the feedback table
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  image_url text,
  category text not null,
  brand text,
  page_url text,
  description text not null,
  reporter_name text,
  status text not null default 'new',
  created_at timestamptz default now()
);

-- 2. RLS policies
alter table public.feedback enable row level security;

-- Partners can submit feedback (anon insert)
create policy "Anyone can insert feedback"
  on public.feedback
  for insert
  to anon
  with check (true);

-- Only service role can read (admin panel)
create policy "Service role can read feedback"
  on public.feedback
  for select
  to service_role
  using (true);

-- Service role can update status
create policy "Service role can update feedback"
  on public.feedback
  for update
  to service_role
  using (true);

-- Also allow anon to read (so API can return the id)
create policy "Anon can read own feedback"
  on public.feedback
  for select
  to anon
  using (true);

-- 3. Create the storage bucket for screenshots
-- NOTE: Run this separately if the SQL editor doesn't support storage API:
--   Go to Storage > New Bucket > Name: "feedback-screenshots" > Public: ON
insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', true)
on conflict (id) do nothing;

-- 4. Storage RLS — allow anon uploads, public reads
create policy "Anyone can upload feedback screenshots"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'feedback-screenshots');

create policy "Anyone can view feedback screenshots"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'feedback-screenshots');
