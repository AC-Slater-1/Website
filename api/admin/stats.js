const supabase = require('../../lib/supabase');
const { validateToken, setCorsHeaders } = require('./auth');

async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!validateToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const [gb, vt, dl] = await Promise.all([
    supabase.from('guestbook').select('id', { count: 'exact', head: true }),
    supabase.from('votes').select('vote_count'),
    supabase.from('downloads').select('download_count')
  ]);

  const guestbookCount = gb.count || 0;
  const votesTotal = (vt.data || []).reduce((s, r) => s + (r.vote_count || 0), 0);
  const downloadsTotal = (dl.data || []).reduce((s, r) => s + (r.download_count || 0), 0);

  res.json({ guestbook_count: guestbookCount, votes_total: votesTotal, downloads_total: downloadsTotal });
}

module.exports = handler;
