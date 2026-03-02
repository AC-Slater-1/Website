-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates the signups table for email + plan capture

create table if not exists public.signups (
  id bigint generated always as identity primary key,
  email text not null,
  plan text not null default 'free',
  source text,
  created_at timestamptz default now()
);

-- Allow inserts from anon key (public signup form)
alter table public.signups enable row level security;

create policy "Anyone can insert signups"
  on public.signups
  for insert
  to anon
  with check (true);

-- Only service role can read (admin access only)
create policy "Service role can read signups"
  on public.signups
  for select
  to service_role
  using (true);

-- Also allow anon to read (so the API can check for duplicates)
create policy "Anon can read signups"
  on public.signups
  for select
  to anon
  using (true);
