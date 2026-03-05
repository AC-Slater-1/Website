/**
 * ab-tracker.js — AppBuster Analytics Event Tracker
 * Fires pageviews, captures UTMs, tracks scroll depth, click heatmap, signup funnel.
 * Events sent to /api/events → Supabase analytics_events table
 */
(function() {
  'use strict';

  // ── Session ID ────────────────────────────────
  // One random ID per browser tab session. Resets when tab closes.
  var SESSION_KEY = 'ab_sid';
  var sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'ses_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  // ── UTM Capture ───────────────────────────────
  // Read UTM params from URL on first pageview, persist in sessionStorage
  var UTM_KEY = 'ab_utm';
  var utmParams = JSON.parse(sessionStorage.getItem(UTM_KEY) || '{}');
  var params = new URLSearchParams(window.location.search);
  var utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  var hasNew = false;
  for (var i = 0; i < utmFields.length; i++) {
    var val = params.get(utmFields[i]);
    if (val) {
      utmParams[utmFields[i]] = val;
      hasNew = true;
    }
  }
  if (hasNew) {
    sessionStorage.setItem(UTM_KEY, JSON.stringify(utmParams));
  }

  // ── Brand Detection ───────────────────────────
  // Detect brand from URL path or hostname
  var DOMAIN_BRANDS = {
    'saasbuster.ai': 'saasbuster', 'iseeq.ai': 'iseeq', '16kb.ai': '16kb',
    'limeware.ai': 'limeware', 'modelt.ai': 'modelt', 'nocatch.ai': 'nocatch',
    'plainlabel.ai': 'plainlabel', 'samebutfree.ai': 'samebutfree',
    'compareto.ai': 'compareto', 'vanillalabs.ai': 'vanillalabs',
    'sassbuster.ai': 'sassbuster', 'appbusters.ai': 'appbusters'
  };

  function detectBrand() {
    // Check hostname first (custom domains)
    var host = window.location.hostname;
    if (DOMAIN_BRANDS[host]) return DOMAIN_BRANDS[host];
    // Fall back to URL path (e.g., /saasbuster/index.html → saasbuster)
    var path = window.location.pathname;
    var match = path.match(/^\/([a-z0-9]+)\//);
    if (match) return match[1];
    return 'appbuster'; // default
  }

  // ── Experiment Read ───────────────────────────
  // Read A/B test assignments from cookie (set by middleware in Phase 4)
  function getExperiment() {
    var cookie = document.cookie.match(/ab_experiments=([^;]+)/);
    if (!cookie) return {};
    try { return JSON.parse(decodeURIComponent(cookie[1])); } catch(e) { return {}; }
  }

  // ── Rate Limiter ──────────────────────────────
  // Max 20 events per session per minute
  var eventTimestamps = [];
  function isRateLimited() {
    var now = Date.now();
    // Remove timestamps older than 60s
    while (eventTimestamps.length && eventTimestamps[0] < now - 60000) {
      eventTimestamps.shift();
    }
    return eventTimestamps.length >= 20;
  }

  // ── Send Event ────────────────────────────────
  function sendEvent(name, extra) {
    if (isRateLimited()) return;
    eventTimestamps.push(Date.now());

    var experiments = getExperiment();
    // Use first active experiment (Phase 4 will set this)
    var expId = null, variant = null;
    for (var key in experiments) {
      expId = key;
      variant = experiments[key];
      break;
    }

    var payload = {
      session_id: sessionId,
      event_name: name,
      page_url: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      brand: detectBrand(),
      utm_source: utmParams.utm_source || null,
      utm_medium: utmParams.utm_medium || null,
      utm_campaign: utmParams.utm_campaign || null,
      utm_term: utmParams.utm_term || null,
      utm_content: utmParams.utm_content || null,
      gclid: utmParams.gclid || null,
      fbclid: utmParams.fbclid || null,
      experiment_id: expId,
      variant: variant,
      metadata: extra || {}
    };

    // Use sendBeacon for reliability (survives page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/events', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // ── Public API ────────────────────────────────
  window.ABTrack = {
    event: sendEvent,
    sessionId: sessionId
  };

  // ── Auto Pageview ─────────────────────────────
  // Fire pageview on load (deferred to not block rendering)
  if (document.readyState === 'complete') {
    sendEvent('pageview');
  } else {
    window.addEventListener('load', function() {
      sendEvent('pageview');
    });
  }

  // ── Scroll Depth Tracking ─────────────────────
  // Fires scroll_depth events at 25%, 50%, 75%, 100% milestones (once each per page)
  var scrollMilestones = [25, 50, 75, 100];
  var firedMilestones = {};

  function checkScrollDepth() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return; // Page shorter than viewport
    var scrollPct = Math.round((window.scrollY / docHeight) * 100);
    for (var i = 0; i < scrollMilestones.length; i++) {
      var m = scrollMilestones[i];
      if (scrollPct >= m && !firedMilestones[m]) {
        firedMilestones[m] = true;
        sendEvent('scroll_depth', {
          depth: m,
          page_height: document.documentElement.scrollHeight,
          viewport_h: window.innerHeight
        });
      }
    }
  }

  // Throttled scroll listener (fires at most every 250ms)
  var scrollTimer = null;
  window.addEventListener('scroll', function() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function() {
      scrollTimer = null;
      checkScrollDepth();
    }, 250);
  }, { passive: true });

  // Also check on load (short pages might already be at 100%)
  if (document.readyState === 'complete') {
    checkScrollDepth();
  } else {
    window.addEventListener('load', function() {
      checkScrollDepth();
    });
  }

  // ── Click Heatmap ─────────────────────────────
  // Records click coordinates + element info on interactive element clicks
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a, button, [data-track], input[type="submit"]');
    if (!target) return; // Only track interactive elements
    sendEvent('click', {
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      scroll_y: Math.round(window.scrollY),
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      element: target.tagName.toLowerCase(),
      text: (target.textContent || '').trim().slice(0, 50),
      href: target.href || null
    });
  });

  // ── Signup Funnel Tracking ────────────────────
  // Tracks form interactions on signup pages to measure funnel progression:
  // pageview → scroll → CTA click → signup page → form_start → form_field → signup/form_abandon
  var formStarted = false;
  var fieldsInteracted = [];

  function isSignupPage() {
    return window.location.pathname.indexOf('signup') !== -1;
  }

  if (isSignupPage()) {
    // form_start: fires once when user focuses first input
    document.addEventListener('focusin', function(e) {
      if (formStarted) return;
      var el = e.target;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        formStarted = true;
        sendEvent('form_start', {
          first_field: el.name || el.id || el.type || 'unknown'
        });
      }
    });

    // form_field: fires on blur of each field (tracks which fields people fill)
    document.addEventListener('focusout', function(e) {
      var el = e.target;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        var fieldName = el.name || el.id || el.type || 'unknown';
        if (fieldsInteracted.indexOf(fieldName) === -1) {
          fieldsInteracted.push(fieldName);
          sendEvent('form_field', {
            field: fieldName,
            field_type: el.type || 'text',
            has_value: !!el.value,
            fields_filled: fieldsInteracted.length
          });
        }
      }
    });

    // form_abandon: fires on page unload if form was started but not submitted
    var formSubmitted = false;
    document.addEventListener('submit', function() {
      formSubmitted = true;
    });

    window.addEventListener('beforeunload', function() {
      if (formStarted && !formSubmitted) {
        sendEvent('form_abandon', {
          fields_filled: fieldsInteracted.length,
          fields: fieldsInteracted.slice(0, 10) // Cap at 10 fields
        });
      }
    });
  }

})();
