const supabase = require('../../lib/supabase');
const { validateToken, setCorsHeaders } = require('./auth');

async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!validateToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('guestbook')
      .select('id, name, location, message, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ entries: data });
  }

  if (req.method === 'DELETE') {
    const { ids } = req.body || {};
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const { error } = await supabase
      .from('guestbook')
      .delete()
      .in('id', ids);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, deleted: ids.length });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
