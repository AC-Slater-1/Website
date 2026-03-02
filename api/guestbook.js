const supabase = require('../lib/supabase');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    if (!supabase) return res.json({ entries: [] });

    const { data, error } = await supabase
      .from('guestbook')
      .select('id, name, location, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ entries: data });
  }

  if (req.method === 'POST') {
    const { name, location, message } = req.body || {};
    if (!name || !message) return res.status(400).json({ error: 'name and message required' });

    // Input length limits
    if (typeof name !== 'string' || name.length > 100) return res.status(400).json({ error: 'name must be 100 chars or less' });
    if (typeof message !== 'string' || message.length > 500) return res.status(400).json({ error: 'message must be 500 chars or less' });
    if (location && (typeof location !== 'string' || location.length > 100)) return res.status(400).json({ error: 'location must be 100 chars or less' });

    // Strip any HTML tags as basic sanitization
    const cleanName = name.replace(/<[^>]*>/g, '').trim();
    const cleanMessage = message.replace(/<[^>]*>/g, '').trim();
    const cleanLocation = location ? location.replace(/<[^>]*>/g, '').trim() : null;

    if (!cleanName || !cleanMessage) return res.status(400).json({ error: 'name and message cannot be empty' });

    if (!supabase) return res.json({ ok: true, fallback: true });

    const { data, error } = await supabase
      .from('guestbook')
      .insert({ name: cleanName, location: cleanLocation, message: cleanMessage })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, entry: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
