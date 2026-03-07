/**
 * conversions.js — Server-Side Conversion API (CAPI)
 * Receives conversion events from ab-pixels.js and forwards to:
 *   1. Meta Conversions API (bypasses ad blockers)
 *   2. Google Ads Offline Conversions (future)
 *
 * Environment variables required:
 *   META_PIXEL_ID          — Meta Pixel ID
 *   META_CAPI_TOKEN        — Meta Conversions API access token (server-side)
 *   GOOGLE_ADS_CONVERSION_ID    — Google Ads conversion ID (AW-xxx)
 *   GOOGLE_ADS_CONVERSION_LABEL — Google Ads conversion label
 *
 * Events are deduplicated with client-side pixels via event_id.
 */

const https = require('https');

// ── Rate Limiter ──────────────────────────────
// Max 100 conversion events per minute (server-wide)
var eventTimestamps = [];
function isRateLimited() {
  var now = Date.now();
  while (eventTimestamps.length && eventTimestamps[0] < now - 60000) {
    eventTimestamps.shift();
  }
  if (eventTimestamps.length >= 100) return true;
  eventTimestamps.push(now);
  return false;
}

// ── Meta CAPI ─────────────────────────────────
// https://developers.facebook.com/docs/marketing-api/conversions-api/
var META_EVENT_MAP = {
  signup:    'CompleteRegistration',
  cta_click: 'Lead',
  download:  'Lead'
};

function sendToMetaCAPI(event, callback) {
  var pixelId = (process.env.META_PIXEL_ID || '').trim();
  var token = (process.env.META_CAPI_TOKEN || '').trim();
  if (!pixelId || !token) return callback(null, 'meta_skipped');

  var metaEvent = META_EVENT_MAP[event.event_name];
  if (!metaEvent) return callback(null, 'meta_unmapped');

  var payload = {
    data: [{
      event_name: metaEvent,
      event_time: event.timestamp || Math.floor(Date.now() / 1000),
      event_id: event.event_id, // For dedup with browser pixel
      event_source_url: event.page_url,
      action_source: 'website',
      user_data: {
        client_user_agent: event.user_agent || null
        // Add hashed email, phone, etc. when available
      }
    }]
  };

  var body = JSON.stringify(payload);
  var options = {
    hostname: 'graph.facebook.com',
    port: 443,
    path: '/v21.0/' + pixelId + '/events?access_token=' + encodeURIComponent(token),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: 5000
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      callback(null, { status: res.statusCode, body: data });
    });
  });

  req.on('error', function(err) { callback(err); });
  req.on('timeout', function() { req.destroy(); callback(new Error('Meta CAPI timeout')); });
  req.write(body);
  req.end();
}

// ── Validation ────────────────────────────────
var VALID_CONVERSION_EVENTS = ['signup', 'cta_click', 'download'];

function validate(body) {
  if (!body || typeof body !== 'object') return 'Invalid body';
  if (!body.event_name || VALID_CONVERSION_EVENTS.indexOf(body.event_name) === -1) {
    return 'Invalid event_name: ' + body.event_name;
  }
  if (!body.event_id || typeof body.event_id !== 'string') return 'Missing event_id';
  return null;
}

// ── Handler ───────────────────────────────────
async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isRateLimited()) {
    return res.status(429).json({ error: 'Rate limited' });
  }

  // Parse body (sendBeacon sends as text/plain)
  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  var error = validate(body);
  if (error) {
    return res.status(400).json({ error: error });
  }

  // Fire to all configured platforms in parallel
  var results = {};

  // Meta CAPI
  await new Promise(function(resolve) {
    sendToMetaCAPI(body, function(err, result) {
      results.meta = err ? { error: err.message } : result;
      resolve();
    });
  });

  // Google Ads Offline Conversions — placeholder for future
  // Requires google-ads-api SDK or REST API with OAuth
  // Will be implemented when Google Ads MCP credentials are provided
  results.google = 'not_configured';

  return res.status(200).json({ ok: true, results: results });
}

module.exports = handler;
