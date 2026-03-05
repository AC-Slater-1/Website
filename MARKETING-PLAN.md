# AppBuster Marketing Infrastructure Plan

**Date:** March 2, 2026
**From:** Archie (Build Partner)
**To:** Ari (Builder — transitioning to Marketing Engineering)
**Status:** Ready for execution

---

## Where We Are Now

AppBuster runs **12 brands** (SaaS Buster, iSeeQ, 16kb, LimeWare, Model T, No Catch, Plain Label, Same But Free, Compare To, Vanilla Labs, SassBuster, plus AppBuster root) across **288 static HTML pages** deployed on a single Vercel project.

**What exists:**
- Static site generator (`build-brands.js`) that themes 4 templates across 12 brands
- Supabase backend with tables: `signups`, `feedback`, `guestbook`, `votes`, `downloads`
- Signup API that already captures `email`, `plan`, and a `source` field (unused)
- Download tracking per app (9 apps, with counts + timestamps)
- Admin panel with multi-user auth
- Kevin feedback widget on every page
- Brand domains defined in `brand.json` files (saasbuster.ai, iseeq.ai, 16kb.ai, etc.) but not wired up

**What doesn't exist:**
- Zero analytics (no page views, no session tracking, no scroll depth)
- Zero ad pixels (no Google Ads tag, no Meta Pixel, no TikTok)
- Zero UTM parameter capture
- Zero split testing
- Zero conversion tracking
- No robots.txt, no sitemap.xml
- No middleware for domain routing
- Brand domains not connected to Vercel

---

## The Plan: 7 Phases

Each phase builds on the previous one. Don't skip ahead.

---

### Phase 1: Analytics Foundation
**Goal:** See what's happening on the site before spending a dollar on ads.
**Effort:** ~2 hours
**Depends on:** Nothing

#### What to build:

**1a. Create `public/ab-tracker.js` — lightweight event tracker**

This is a small (~2KB) JavaScript file that loads on every page. It does three things:
- Fires a `pageview` event on load (with page URL, referrer, brand, timestamp)
- Captures UTM parameters from the URL and stores them in `sessionStorage`
- Exposes a global `ABTrack.event(name, data)` function for custom events

Events get sent to a new Supabase table via a new API endpoint.

Why build our own instead of using Plausible/PostHog? Because:
- We already have Supabase (free tier, no new vendor)
- We need to tie events to our own signup/download data
- We control the schema — can add experiment variants, brand attribution, ad click IDs
- No cookie banners needed (first-party, no PII, no cross-site tracking)

**1b. Create Supabase migration `003_analytics_events.sql`**

```sql
CREATE TABLE public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id text NOT NULL,        -- random ID per browser session
  event_name text NOT NULL,        -- 'pageview', 'cta_click', 'signup', 'download'
  page_url text,
  referrer text,
  brand text,                      -- auto-detected from URL path or domain
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,                      -- Google Ads click ID
  fbclid text,                     -- Meta click ID
  experiment_id text,              -- for split tests (Phase 4)
  variant text,                    -- 'control', 'variant_a', etc.
  metadata jsonb DEFAULT '{}',     -- flexible extra data
  created_at timestamptz DEFAULT now()
);

-- RLS: anon can INSERT only, service_role can SELECT
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.analytics_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "service_select" ON public.analytics_events FOR SELECT TO service_role USING (true);

-- Index for dashboard queries
CREATE INDEX idx_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX idx_events_name ON public.analytics_events (event_name);
CREATE INDEX idx_events_brand ON public.analytics_events (brand);
CREATE INDEX idx_events_campaign ON public.analytics_events (utm_campaign) WHERE utm_campaign IS NOT NULL;
```

**1c. Create `api/events.js` — event ingestion endpoint**

Simple POST endpoint. Accepts `{ session_id, event_name, page_url, referrer, brand, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, experiment_id, variant, metadata }`. Writes to `analytics_events` table. No auth required (anon insert).

Rate limit: 20 events per session per minute (prevents abuse).

**1d. Inject `ab-tracker.js` into all templates**

Add `<script src="/ab-tracker.js"></script>` before `</body>` in all 4 templates + root `index.html`. Same pattern as kevin-widget.js.

**1e. Wire up conversion events**

Modify existing code to fire tracking events at key moments:
- Signup form submit → `ABTrack.event('signup', { plan, email_hash })`
- Download button click → `ABTrack.event('download', { app_name })`
- CTA click (Browse Free Tools, See Agentic Plans) → `ABTrack.event('cta_click', { cta_label })`

#### How to verify:
After deploying, visit any page. Open browser devtools → Network tab. You should see a POST to `/api/events` with the pageview data. Check Supabase table — rows should appear.

---

### Phase 2: Admin Analytics Dashboard
**Goal:** See the data without querying Supabase directly.
**Effort:** ~3 hours
**Depends on:** Phase 1

#### What to build:

**2a. New "Analytics" tab in admin.html**

Add a 6th tab to the admin panel (next to Brands, Votes, Roadmap, Pitch, Kevin). Shows:

- **Traffic overview:** Page views per day (last 30 days), line chart or simple bar
- **Top pages:** Most visited pages, grouped by brand
- **Traffic sources:** Breakdown by utm_source (google, meta, direct, organic)
- **Conversion funnel:** Pageviews → CTA clicks → Signups → Downloads (with rates)
- **Campaign performance:** Table showing utm_campaign, impressions, clicks, signups, cost-per-signup (cost entered manually or from ad platform)

**2b. Add admin API routes**

New routes on the admin handler:
- `GET /api/admin/analytics?range=7d` — aggregated stats
- `GET /api/admin/analytics/funnel?brand=saasbuster` — per-brand funnel
- `GET /api/admin/analytics/campaigns` — campaign performance table

All behind existing admin auth token.

#### How to verify:
Log into admin panel. Click "Analytics" tab. Should see charts populated with real data from Phase 1 tracking. If no traffic yet, generate some by visiting pages yourself.

---

### Phase 3: Domain Routing
**Goal:** Each brand gets its own domain. saasbuster.ai serves the SaaS Buster homepage, not /saasbuster/.
**Effort:** ~1 hour code, variable DNS time
**Depends on:** Nothing (can run parallel with Phase 1-2)

#### What to build:

**3a. Create `middleware.js` at project root**

Vercel Edge Middleware runs BEFORE the request hits your static files. It reads the `Host` header and rewrites the URL path.

```
Incoming: https://saasbuster.ai/analytics.html
Host header: saasbuster.ai
Middleware: rewrites to /saasbuster/analytics.html
Vercel serves: public/saasbuster/analytics.html
User sees: https://saasbuster.ai/analytics.html (clean URL)
```

The middleware needs a domain→brand map. Read it from the brand.json files at build time and bake it into the middleware as a static lookup:

```javascript
const DOMAIN_MAP = {
  'saasbuster.ai': '/saasbuster',
  'iseeq.ai': '/iseeq',
  '16kb.ai': '/16kb',
  'limeware.ai': '/limeware',
  'modelt.ai': '/modelt',
  'nocatch.ai': '/nocatch',
  'plainlabel.ai': '/plainlabel',
  'samebutfree.ai': '/samebutfree',
  'compareto.ai': '/compareto',
  'vanillalabs.ai': '/vanillalabs',
  'sassbuster.ai': '/sassbuster',
  'appbuster.com': ''  // root brand, no rewrite
};
```

Important: DON'T rewrite `/api/*` paths or `/kevin-widget.js` or `/ab-tracker.js`. Those are shared across all brands.

**3b. Add domains to Vercel**

```bash
vercel domains add saasbuster.ai
vercel domains add iseeq.ai
vercel domains add 16kb.ai
# ... etc for each brand
```

**3c. Configure DNS**

For each domain, set DNS records:
- A record: `76.76.21.21` (Vercel's IP)
- Or CNAME: `cname.vercel-dns.com`

If domains are on Cloudflare, Namecheap, GoDaddy, etc. — update the DNS panel there.

**3d. Update internal links in templates**

Currently brand pages link to `/saasbuster/analytics.html`. When served from `saasbuster.ai`, those should just be `/analytics.html`. The middleware handles this on the server side, but links IN the HTML need updating too.

Option A: Build step strips the brand prefix from links when generating for custom domains.
Option B: Middleware also handles link resolution (less ideal, more complex).

Recommend Option A — add a `stripBaseUrl` flag to `build-brands.js`.

#### How to verify:
Visit `https://saasbuster.ai` in a browser. Should see the SaaS Buster homepage (dark theme, blue accent). Visit `https://saasbuster.ai/analytics.html` — should show the analytics product page. All internal navigation should work without `/saasbuster/` prefix showing in the URL bar.

---

### Phase 4: Split Testing Infrastructure
**Goal:** Test different headlines, CTAs, and page layouts. Measure which version converts better.
**Effort:** ~3 hours
**Depends on:** Phase 1 (analytics) + Phase 3 (middleware)

#### What to build:

**4a. Experiment config file: `experiments.json`**

```json
{
  "hero-headline-test": {
    "id": "hero-headline-test",
    "status": "active",
    "brands": ["appbuster", "saasbuster"],
    "pages": ["/", "/index.html"],
    "variants": {
      "control": { "weight": 50 },
      "variant_a": { "weight": 50 }
    }
  }
}
```

**4b. Extend middleware.js for variant bucketing**

When a request comes in:
1. Check if any active experiment matches this page
2. Look for existing `ab_experiments` cookie
3. If no cookie, randomly assign to a variant based on weights
4. Set cookie (persistent, 30 days)
5. Rewrite URL to variant path: `/index.html` → `/index.variant_a.html`

The cookie stores experiment assignments as JSON: `{"hero-headline-test":"variant_a","pricing-test":"control"}`

**4c. Build variant pages**

Extend `build-brands.js` to generate variant pages. For each active experiment, generate alternate versions of the target pages.

Variants can be defined as template overrides:
```
templates/variants/hero-headline-test/
  variant_a/
    homepage.html.tpl  (only the parts that differ — merged with base template)
```

Or simpler: use a token replacement approach. Define variant-specific tokens in experiments.json, replace at build time.

**4d. Track variant in analytics**

The `ab-tracker.js` reads the `ab_experiments` cookie and includes `experiment_id` + `variant` in every event. This automatically ties pageviews, clicks, and signups to their experiment variants.

**4e. Add experiment results to admin dashboard**

New section in the Analytics tab: experiment performance table showing conversion rate per variant, statistical significance indicator (simple z-test), and a "winner" badge when significance > 95%.

#### How to verify:
Open the site in two different browsers (or one incognito). Each should see a different variant. Check the `ab_experiments` cookie — should contain the assignment. Check Supabase `analytics_events` — events should include `experiment_id` and `variant` fields. Admin dashboard should show split data.

---

### Phase 5: Ad Pixel Infrastructure
**Goal:** Tell Google and Meta when someone converts so their algorithms can optimize ad delivery.
**Effort:** ~2 hours
**Depends on:** Phase 1 (analytics foundation)

#### What to build:

**5a. Create `public/ab-pixels.js` — pixel loader**

A single JS file that loads and configures all ad platform pixels. Controlled by a config object so pixels can be enabled/disabled per brand.

```javascript
// Config — set pixel IDs per brand or globally
const PIXEL_CONFIG = {
  google: {
    id: 'AW-XXXXXXXXXX',           // Google Ads conversion ID
    conversionLabel: 'XXXXXXXXX',  // For signup conversion
    enabled: true
  },
  meta: {
    id: 'XXXXXXXXXXXXXXX',         // Meta Pixel ID
    enabled: true
  },
  tiktok: {
    id: 'XXXXXXXXXX',
    enabled: false                  // Enable when ready
  }
};
```

This file:
- Loads `gtag.js` for Google Ads (async, non-blocking)
- Loads Meta Pixel base code
- Loads TikTok pixel if enabled
- Exposes `ABPixels.trackConversion(type, data)` that fires platform-specific events

**5b. Map conversion events to pixel events**

| Our Event | Google Ads | Meta Pixel | TikTok |
|-----------|-----------|------------|--------|
| `signup` | `conversion` (AW-XXX/label) | `Lead` | `SubmitForm` |
| `download` | `conversion` (AW-XXX/label2) | `InitiateCheckout` | `Download` |
| `cta_click` | (not sent) | `ViewContent` | (not sent) |
| `pageview` | auto via gtag | `PageView` | `Pageview` |

**5c. Wire pixels into ab-tracker.js**

When `ABTrack.event()` fires, it also calls `ABPixels.trackConversion()` if pixels are loaded. This keeps tracking centralized — one call tracks to Supabase AND fires pixels.

**5d. Add pixel IDs to Vercel env vars**

```
GOOGLE_ADS_ID=AW-XXXXXXXXXX
GOOGLE_ADS_SIGNUP_LABEL=XXXXXXXXX
GOOGLE_ADS_DOWNLOAD_LABEL=XXXXXXXXX
META_PIXEL_ID=XXXXXXXXXXXXXXX
```

These get baked into the pixel config at build time (or loaded dynamically).

**5e. Server-side Conversions API (CAPI) — optional but recommended**

Ad blockers block client-side pixels ~30% of the time. Server-side reporting is more reliable.

Create `api/conversions.js` that:
- Receives conversion events from `ab-tracker.js` (same POST as analytics, with a flag)
- Forwards to Meta Conversions API and Google Ads API server-side
- Uses hashed email (SHA256) for identity matching

This runs in Vercel serverless — no ad blocker can stop it.

#### How to verify:
1. Install "Meta Pixel Helper" Chrome extension — visit any page, should show pixel firing
2. Install "Google Tag Assistant" extension — should show gtag loading and pageview
3. Submit a signup form — check Google Ads and Meta Events Manager for conversion events
4. For CAPI: check Vercel function logs for successful API responses from Meta/Google

---

### Phase 6: Campaign Landing Pages
**Goal:** Custom pages optimized for specific ad campaigns. Higher relevance = lower CPC = more signups per dollar.
**Effort:** ~2 hours per campaign
**Depends on:** Phase 3 (domains) + Phase 5 (pixels)

#### What to build:

**6a. Landing page template: `templates/landing.html.tpl`**

Stripped-down page optimized for ad traffic:
- No navigation (reduces bounce from distraction)
- Hero with campaign-specific headline (token: `{{CAMPAIGN_HEADLINE}}`)
- Single CTA (signup or download)
- Social proof section (testimonials, brand logos, stats)
- FAQ section addressing objections
- Footer with legal links only

**6b. Campaign config files**

```
campaigns/
  google-crm-free/
    config.json       # headline, CTA, target brand, product
    landing.html      # generated from template
  meta-saas-savings/
    config.json
    landing.html
```

Each campaign config specifies:
- `headline`: "Stop Paying $50/mo for CRM"
- `subheadline`: "AppBuster CRM does everything HubSpot does. Free forever."
- `cta_text`: "Get Free CRM"
- `cta_url`: "/signup.html?plan=free&source=google-crm-free"
- `brand`: "appbuster" (which brand theme to use)
- `product`: "crm" (which product to feature)
- `utm_campaign`: "google-crm-free" (for tracking attribution)

**6c. Build step for campaigns**

Extend `build-brands.js` (or create `build-campaigns.js`) to generate landing pages from campaign configs. Output goes to `public/lp/google-crm-free/index.html`.

Ad URL: `https://appbuster.com/lp/google-crm-free/?utm_source=google&utm_medium=cpc&utm_campaign=crm-free`

#### How to verify:
Visit the landing page URL. Should see a focused page with campaign-specific copy, no nav bar, single CTA. Click CTA — should go to signup with `source` pre-filled. Check analytics for the utm parameters showing up.

---

### Phase 7: Review & Iterate Loop
**Goal:** Weekly cycle of reviewing ad performance and making data-driven changes.
**Effort:** Ongoing (~1 hour/week)
**Depends on:** All previous phases

#### The weekly loop:

**Monday — Pull numbers**
1. Open admin dashboard → Analytics tab
2. Check: traffic by source, conversion rates by campaign, cost per signup (manually entered from ad platforms)
3. Check: experiment results — any winners to promote?

**Tuesday — Identify winners and losers**
- Campaigns with CPA (cost per acquisition) below target → increase budget
- Campaigns with CPA above target → pause or revise
- Experiments with 95%+ significance → promote winner to default, start new test
- Pages with high bounce → investigate (slow load? wrong message? broken layout?)

**Wednesday — Build iterations**
- Update losing campaign landing pages with new headlines/CTAs
- Create new experiment variants based on winner insights
- Build new campaign landing pages for untested audiences

**Thursday — Deploy & launch**
- Deploy updated pages
- Update ad campaigns with new landing page URLs
- Start new experiments

**Friday — Monitor**
- Check for broken pages, pixel firing issues, tracking gaps
- Verify new experiments are bucketing correctly
- Check Supabase table sizes (analytics_events can grow fast — add cleanup job if needed)

#### What to automate over time:
- **Daily email digest:** Supabase Edge Function that queries analytics, sends summary email
- **Auto-pause campaigns:** If CPA exceeds 3x target, API call to pause the campaign
- **Auto-promote winners:** When experiment reaches significance, auto-swap default page
- **Anomaly alerts:** If conversion rate drops >50% from baseline, alert immediately

---

## Execution Order

```
Week 1:  Phase 1 (analytics) + Phase 3 (domain routing) — in parallel
Week 2:  Phase 2 (admin dashboard) + Phase 5 (ad pixels) — in parallel
Week 3:  Phase 4 (split testing)
Week 4:  Phase 6 (campaign landing pages)
Week 5+: Phase 7 (review loop — ongoing)
```

## Tech Stack Summary

| Layer | Tool | Why |
|-------|------|-----|
| Analytics storage | Supabase (existing) | Already have it, free tier, own our data |
| Event tracking | Custom `ab-tracker.js` | No vendor lock-in, ties to our schema |
| Split testing | Vercel Edge Middleware | Runs at CDN edge, no flicker, cookie-based |
| Ad pixels | Google Ads + Meta Pixel | Where the ad spend goes |
| Server-side tracking | Vercel Serverless (CAPI) | Beats ad blockers |
| Domain routing | Vercel Middleware | One project, many domains |
| Landing pages | Static HTML (build step) | Fast, cached at edge, no server cost |
| Dashboard | Admin panel (existing) | Already built, just add tabs |

## Files That Will Be Created

```
public/ab-tracker.js           — Analytics event tracker (Phase 1)
public/ab-pixels.js            — Ad pixel loader (Phase 5)
api/events.js                  — Event ingestion endpoint (Phase 1)
api/conversions.js             — Server-side pixel relay (Phase 5)
middleware.js                  — Domain routing + split test bucketing (Phase 3+4)
experiments.json               — Split test config (Phase 4)
supabase/003_analytics.sql     — Analytics events table (Phase 1)
templates/landing.html.tpl     — Campaign landing page template (Phase 6)
campaigns/*/config.json        — Per-campaign configuration (Phase 6)
```

## Files That Will Be Modified

```
templates/homepage.html.tpl    — Add ab-tracker.js + ab-pixels.js script tags
templates/product-page.html.tpl — Same
templates/signup.html.tpl      — Same + fire signup conversion event
templates/app.html.tpl         — Same
public/index.html              — Same
public/admin.html              — Add Analytics tab (Phase 2)
api/admin/[[...path]].js       — Add analytics query routes (Phase 2)
build-brands.js                — Add campaign builds + variant page generation
vercel.json                    — Add middleware config if needed
```

## Environment Variables to Add (when ready)

```
GOOGLE_ADS_ID=AW-XXXXXXXXXX
GOOGLE_ADS_SIGNUP_LABEL=XXXXXXXXX
META_PIXEL_ID=XXXXXXXXXXXXXXX
META_CONVERSIONS_API_TOKEN=XXXXXXX    (for CAPI)
```

---

## Key Principle

**Measure before you spend.** Phase 1 (analytics) must be live and collecting data before any ad dollar goes out. You need baseline conversion rates to know if ads are working. Running ads without tracking is burning money.

Second principle: **One brand at a time.** Don't launch all 12 brands on ads simultaneously. Pick the strongest brand (probably AppBuster or SaaS Buster), prove the funnel works, then replicate to others.
