const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

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
    if (!supabase) return res.json({ ok: true, fallback: true });

    const { data, error } = await supabase
      .from('guestbook')
      .insert({ name, location: location || null, message })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, entry: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
