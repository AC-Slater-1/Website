/**
 * ab-split.js — Lightweight A/B Split Test Engine
 *
 * Assigns visitors to experiment variants using localStorage for persistence.
 * Sets ab_experiments cookie so ab-tracker.js automatically includes variant
 * in every event payload (pageview, signup, click, etc.).
 *
 * Usage:
 *   1. Define experiments in EXPERIMENTS below
 *   2. Add data-ab-experiment="exp_id" and data-ab-target="selector" to elements
 *   3. The script auto-swaps text content on DOMContentLoaded
 *
 * Cookie format: ab_experiments={"badge_text_v1":"sold_out"}
 */
(function() {
  'use strict';

  // ── Experiment Definitions ────────────────────
  // Each experiment has an ID, variants with weights, and a default
  var EXPERIMENTS = {
    badge_text_v1: {
      variants: {
        control:     { text: 'Coming Soon',  sub: '',                  weight: 34 },
        sold_out:    { text: 'Sold Out',     sub: 'Join Waitlist →',   weight: 33 },
        invite_only: { text: 'Invite Only',  sub: 'Request Invite →',  weight: 33 }
      },
      default: 'control'
    }
  };

  // ── Persistent Visitor ID ─────────────────────
  // Deterministic assignment: same visitor always gets same variant
  var VID_KEY = 'ab_visitor_id';
  var visitorId = localStorage.getItem(VID_KEY);
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VID_KEY, visitorId);
  }

  // ── Simple Hash ───────────────────────────────
  // djb2 hash — fast, good distribution for variant bucketing
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h & h; // Convert to 32-bit integer
    }
    return Math.abs(h);
  }

  // ── Assign Variant ────────────────────────────
  function assignVariant(experimentId, experiment) {
    // Check localStorage for existing assignment
    var storageKey = 'ab_' + experimentId;
    var existing = localStorage.getItem(storageKey);
    if (existing && experiment.variants[existing]) {
      return existing;
    }

    // URL override: ?ab_badge_text_v1=sold_out forces a variant (for testing)
    var params = new URLSearchParams(window.location.search);
    var override = params.get('ab_' + experimentId);
    if (override && experiment.variants[override]) {
      localStorage.setItem(storageKey, override);
      return override;
    }

    // Hash-based assignment using visitor ID + experiment ID
    var bucket = hash(visitorId + ':' + experimentId) % 100;
    var cumulative = 0;
    var variantNames = Object.keys(experiment.variants);
    for (var i = 0; i < variantNames.length; i++) {
      cumulative += experiment.variants[variantNames[i]].weight;
      if (bucket < cumulative) {
        localStorage.setItem(storageKey, variantNames[i]);
        return variantNames[i];
      }
    }

    // Fallback (rounding edge case)
    localStorage.setItem(storageKey, experiment.default);
    return experiment.default;
  }

  // ── Run All Experiments ───────────────────────
  var assignments = {};
  for (var expId in EXPERIMENTS) {
    assignments[expId] = assignVariant(expId, EXPERIMENTS[expId]);
  }

  // ── Set Cookie for ab-tracker.js ──────────────
  // ab-tracker.js reads this cookie and includes experiment_id + variant in events
  var cookieVal = encodeURIComponent(JSON.stringify(assignments));
  document.cookie = 'ab_experiments=' + cookieVal + ';path=/;max-age=7776000;SameSite=Lax'; // 90 days

  // ── DOM Swap ──────────────────────────────────
  // Finds elements with data-ab-experiment attribute and swaps text
  function applyVariants() {
    for (var expId in assignments) {
      var variant = assignments[expId];
      var experiment = EXPERIMENTS[expId];
      if (!experiment || !experiment.variants[variant]) continue;

      var variantData = experiment.variants[variant];

      // Badge text swap
      var targets = document.querySelectorAll('[data-ab-experiment="' + expId + '"]');
      for (var i = 0; i < targets.length; i++) {
        targets[i].textContent = variantData.text;
      }

      // Sub-text swap (e.g., "Join Waitlist →" below the badge)
      var subTargets = document.querySelectorAll('[data-ab-sub="' + expId + '"]');
      for (var j = 0; j < subTargets.length; j++) {
        subTargets[j].textContent = variantData.sub || '';
      }
    }
  }

  // Run on DOMContentLoaded (or immediately if already loaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyVariants);
  } else {
    applyVariants();
  }

  // ── Public API ────────────────────────────────
  window.ABSplit = {
    getVariant: function(expId) { return assignments[expId] || null; },
    getAll: function() { return assignments; },
    // Force a specific variant (for QA/testing) — reloads page
    force: function(expId, variant) {
      localStorage.setItem('ab_' + expId, variant);
      location.reload();
    }
  };

})();
