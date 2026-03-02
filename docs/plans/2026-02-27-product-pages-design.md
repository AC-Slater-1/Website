# Design: Individual Product Pages

> Approved by Alex on 2026-02-27

## Summary

Add 9 standalone HTML product pages (one per app) to give visitors detailed info before downloading.

## URL Structure

```
public/apps/nexrank.html
public/apps/bulkpipe.html
public/apps/bulkmail.html
public/apps/bulkboard.html
public/apps/bulktrack.html
public/apps/bulkdesk.html
public/apps/bulkdocs.html
public/apps/bulkdesign.html
public/apps/bulkschedule.html
```

## Page Sections

1. Title bar (XP-style, back button)
2. Hero (icon, name, category, tagline, rating)
3. Feature grid (6 features, 2-col, icons + descriptions)
4. Comparison table (App vs Competitor, 8 rows + pricing)
5. What's included (bullet list)
6. Use cases (3 persona cards)
7. Pricing CTA (savings callout + download button)
8. Back to all apps link

## Style

Same retro Win95/XP CSS as homepage. Inlined per page (static HTML approach).

## Homepage Changes

Add "Learn More" link to each card pointing to `/apps/[name].html`.

## Files

- 9 new: `public/apps/*.html`
- 1 modified: `public/index.html` (add Learn More links)
- No server.js changes needed (Express static serves public/)
- vercel.json: may need `/apps/*` handling
