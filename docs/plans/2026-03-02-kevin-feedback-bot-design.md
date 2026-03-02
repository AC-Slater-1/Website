# Kevin — Partner Feedback Bot

**Date:** 2026-03-02
**Status:** Approved

## Overview

Kevin is a screenshot-based feedback form for partners to report bugs, cosmetic issues, and suggestions across all 12 brands. Partners upload a screenshot, pick a category, describe the issue, and submit. Submissions land in a Supabase table + storage bucket, reviewable via the admin panel.

## Architecture

- **Frontend:** `public/feedback.html` — standalone static page, dark zinc theme (matches admin.html)
- **API:** `api/feedback.js` — Vercel serverless function, handles multipart upload
- **Storage:** Supabase Storage bucket `feedback-screenshots` for images
- **Database:** Supabase `feedback` table for metadata
- **Admin:** New "Feedback" tab added to `admin.html`

## Page Design (`/feedback.html`)

Dark zinc theme, centered card layout. Header: "Kevin" with subtitle "Screenshot it. Describe it. Done."

1. **Image upload zone** — Drag & drop or click. Thumbnail preview. Accepts .png/.jpg/.webp, max 5MB
2. **Category pills** (single-select):
   - Bug | Cosmetic | Mobile | Copy/Text | Suggestion
3. **Brand dropdown** — All 12 brands + "Homepage / General"
4. **URL field** — Optional page URL
5. **Description textarea** — "What's wrong? What did you expect?"
6. **Name field** — Partner name (persisted in localStorage)
7. **Submit** — Uploads image, inserts row, shows success toast

## API (`POST /api/feedback`)

Receives multipart/form-data. Uploads image to Supabase Storage bucket, inserts metadata row, returns `{ ok: true, id }`.

## Database Schema

```sql
create table public.feedback (
  id bigint generated always as identity primary key,
  image_url text,
  category text not null,
  brand text,
  page_url text,
  description text not null,
  reporter_name text,
  status text default 'new',
  created_at timestamptz default now()
);
```

RLS: anon can insert, service_role can read/update. Status values: new | reviewed | fixed | wontfix.

## Admin Panel

New "Feedback" tab in admin.html — table with image thumbnails, category badges, status pills (clickable to change), reporter name, timestamp. Sorted newest-first.

## Excluded (YAGNI)

- No auth (security by obscurity — /feedback.html not linked)
- No email notifications
- No comments/threading
- No multi-image upload
