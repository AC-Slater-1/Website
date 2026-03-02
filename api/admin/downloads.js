const supabase = require('../../lib/supabase');
const { validateToken, setCorsHeaders } = require('./auth');

async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!validateToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('downloads')
      .select('app_name, download_count, last_downloaded_at')
      .order('download_count', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ downloads: data });
  }

  if (req.method === 'PUT') {
    const { app_name, download_count } = req.body || {};
    if (!app_name || download_count === undefined) {
      return res.status(400).json({ error: 'app_name and download_count required' });
    }

    const { error } = await supabase
      .from('downloads')
      .update({ download_count: parseInt(download_count, 10) })
      .eq('app_name', app_name);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
