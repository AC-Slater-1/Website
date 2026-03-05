const supabase = require('../lib/supabase');

// Allowed event names — reject anything not on this list
const VALID_EVENTS = ['pageview', 'cta_click', 'signup', 'download', 'scroll_depth', 'click', 'form_start', 'form_field', 'form_abandon'];

// Max string length for text fields
const MAX_LEN = 500;

function clean(val, maxLen) {
  if (!val || typeof val !== 'string') return null;
  return val.replace(/<[^>]*>/g, '').trim().slice(0, maxLen || MAX_LEN) || null;
}

async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body — sendBeacon sends as text/plain
  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  if (!body) return res.status(400).json({ error: 'Missing body' });

  var sessionId = clean(body.session_id, 100);
  var eventName = clean(body.event_name, 50);

  if (!sessionId || !eventName) {
    return res.status(400).json({ error: 'session_id and event_name required' });
  }

  if (VALID_EVENTS.indexOf(eventName) === -1) {
    return res.status(400).json({ error: 'Invalid event_name' });
  }

  var row = {
    session_id: sessionId,
    event_name: eventName,
    page_url: clean(body.page_url),
    referrer: clean(body.referrer),
    brand: clean(body.brand, 50),
    utm_source: clean(body.utm_source, 100),
    utm_medium: clean(body.utm_medium, 100),
    utm_campaign: clean(body.utm_campaign, 100),
    utm_term: clean(body.utm_term, 200),
    utm_content: clean(body.utm_content, 100),
    gclid: clean(body.gclid, 200),
    fbclid: clean(body.fbclid, 200),
    experiment_id: clean(body.experiment_id, 100),
    variant: clean(body.variant, 50),
    metadata: (body.metadata && typeof body.metadata === 'object') ? body.metadata : {}
  };

  if (!supabase) return res.json({ ok: true, fallback: true });

  var result = await supabase.from('analytics_events').insert(row);
  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  return res.json({ ok: true });
}

module.exports = handler;
