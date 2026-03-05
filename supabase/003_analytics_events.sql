-- 003_analytics_events.sql
-- Analytics event tracking table for ab-tracker.js
-- Phase 1 of the Marketing Infrastructure Plan

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,
  event_name text NOT NULL,
  page_url text,
  referrer text,
  brand text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  experiment_id text,
  variant text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- RLS: anon can INSERT only, service_role can SELECT
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert" ON public.analytics_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "service_select" ON public.analytics_events
  FOR SELECT TO service_role USING (true);

-- Also allow anon to SELECT (so Ari's read-only queries via anon key work)
CREATE POLICY "anon_select" ON public.analytics_events
  FOR SELECT TO anon USING (true);

-- Indexes for dashboard queries
CREATE INDEX idx_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX idx_events_name ON public.analytics_events (event_name);
CREATE INDEX idx_events_brand ON public.analytics_events (brand);
CREATE INDEX idx_events_campaign ON public.analytics_events (utm_campaign)
  WHERE utm_campaign IS NOT NULL;
