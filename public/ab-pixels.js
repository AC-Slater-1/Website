/**
 * ab-pixels.js — Ad Platform Pixel Loader
 * Loads Google Ads (gtag.js) + Meta Pixel, fires conversion events.
 * Integrates with ab-tracker.js via ABTrack hooks.
 *
 * Pixel IDs are fetched from /api/pixel-config (backed by Vercel env vars).
 * If no IDs configured, this script is a silent no-op.
 *
 * Events fired:
 *   pageview    → Google: page_view, Meta: PageView
 *   cta_click   → Google: generate_lead, Meta: Lead
 *   signup      → Google: sign_up (conversion), Meta: CompleteRegistration
 *   form_start  → Google: begin_checkout, Meta: InitiateCheckout
 */
(function() {
  'use strict';

  var config = null;
  var gtagReady = false;
  var fbqReady = false;

  // ── Fetch Pixel Config ──────────────────────
  // Reads pixel IDs from server (Vercel env vars)
  function loadConfig(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/pixel-config', true);
    xhr.timeout = 3000; // Don't block page if config endpoint is slow
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          config = JSON.parse(xhr.responseText);
          callback(config);
        } catch(e) { /* Silent fail — no pixels loaded */ }
      }
    };
    xhr.onerror = xhr.ontimeout = function() { /* Silent — pixels are enhancement, not critical */ };
    xhr.send();
  }

  // ── Google Ads (gtag.js) ────────────────────
  function loadGtag(conversionId) {
    if (!conversionId) return;

    // Load gtag.js script
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + conversionId;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', conversionId, {
      send_page_view: false // We fire pageview manually via ABTrack
    });

    gtagReady = true;
  }

  // ── Meta Pixel (fbevents.js) ────────────────
  function loadMetaPixel(pixelId) {
    if (!pixelId) return;

    // Standard Meta Pixel snippet (minified)
    !function(f,b,e,v,n,t,s) {
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s);
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    // Don't auto-fire PageView — we fire it via ABTrack hook
    fbqReady = true;
  }

  // ── Event ID Generator ──────────────────────
  // Shared between client-side pixel and server-side CAPI for deduplication
  function generateEventId() {
    return 'ev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ── Event Mapping ───────────────────────────
  // Maps ABTrack event names → ad platform events
  var EVENT_MAP = {
    pageview: {
      gtag: function() { window.gtag('event', 'page_view'); },
      fbq:  function() { window.fbq('track', 'PageView'); }
    },
    cta_click: {
      gtag: function(meta) {
        window.gtag('event', 'generate_lead', {
          value: 0,
          currency: 'USD',
          event_label: meta && meta.text ? meta.text : 'cta'
        });
      },
      fbq: function(meta) {
        window.fbq('track', 'Lead', {
          content_name: meta && meta.text ? meta.text : 'cta'
        });
      }
    },
    signup: {
      gtag: function(meta) {
        // This is the actual conversion event for Google Ads
        if (config && config.google_conversion_label) {
          window.gtag('event', 'conversion', {
            send_to: config.google_conversion_id + '/' + config.google_conversion_label,
            value: 1.0,
            currency: 'USD'
          });
        }
        window.gtag('event', 'sign_up', { method: 'website' });
      },
      fbq: function(meta) {
        window.fbq('track', 'CompleteRegistration', {
          content_name: 'signup',
          status: true
        });
      }
    },
    form_start: {
      gtag: function() { window.gtag('event', 'begin_checkout'); },
      fbq:  function() { window.fbq('track', 'InitiateCheckout'); }
    },
    download: {
      gtag: function(meta) {
        window.gtag('event', 'generate_lead', {
          value: 0.5,
          currency: 'USD',
          event_label: meta && meta.app ? meta.app : 'download'
        });
      },
      fbq: function(meta) {
        window.fbq('track', 'Lead', {
          content_name: meta && meta.app ? meta.app : 'download',
          content_category: 'download'
        });
      }
    }
  };

  // ── Fire Pixel Event ────────────────────────
  function firePixelEvent(eventName, metadata) {
    var mapping = EVENT_MAP[eventName];
    if (!mapping) return;

    if (gtagReady && mapping.gtag) {
      try { mapping.gtag(metadata); } catch(e) { /* Silent */ }
    }
    if (fbqReady && mapping.fbq) {
      try { mapping.fbq(metadata); } catch(e) { /* Silent */ }
    }

    // Also send server-side for ad blocker resilience
    // Only for high-value events (signup, download, cta_click)
    if (eventName === 'signup' || eventName === 'download' || eventName === 'cta_click') {
      sendServerConversion(eventName, metadata);
    }
  }

  // ── Server-Side Conversion (CAPI) ──────────
  // Sends conversion event to our server, which forwards to Meta CAPI + Google
  function sendServerConversion(eventName, metadata) {
    var eventId = generateEventId();
    var payload = {
      event_name: eventName,
      event_id: eventId, // For deduplication with client-side pixel
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: Math.floor(Date.now() / 1000),
      metadata: metadata || {}
    };

    // Use sendBeacon for reliability (survives page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/conversions', JSON.stringify(payload));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/conversions', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  // ── ABTrack Integration ─────────────────────
  // Hook into existing ABTrack.event() to automatically fire pixel events
  function hookIntoABTrack() {
    if (!window.ABTrack || !window.ABTrack.event) return;

    var originalEvent = window.ABTrack.event;
    window.ABTrack.event = function(name, extra) {
      // Call original analytics tracker first
      originalEvent(name, extra);
      // Then fire pixel events
      firePixelEvent(name, extra);
    };
  }

  // ── Public API ──────────────────────────────
  window.ABPixels = {
    track: firePixelEvent,
    getConfig: function() { return config; },
    isReady: function() { return gtagReady || fbqReady; }
  };

  // ── Initialize ──────────────────────────────
  // Load config, then load pixels, then hook into ABTrack
  loadConfig(function(cfg) {
    if (cfg.google_conversion_id) {
      loadGtag(cfg.google_conversion_id);
    }
    if (cfg.meta_pixel_id) {
      loadMetaPixel(cfg.meta_pixel_id);
    }
    // Hook after pixels are initialized
    hookIntoABTrack();

    // Fire initial pageview through pixels if page already loaded
    if (document.readyState === 'complete') {
      firePixelEvent('pageview');
    } else {
      window.addEventListener('load', function() {
        firePixelEvent('pageview');
      });
    }
  });

})();
