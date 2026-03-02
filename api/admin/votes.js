const supabase = require('../../lib/supabase');
const { validateToken, setCorsHeaders } = require('./auth');

async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!validateToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('votes')
      .select('software_name, vote_count')
      .order('vote_count', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ votes: data });
  }

  if (req.method === 'PUT') {
    const { software_name, vote_count } = req.body || {};
    if (!software_name || vote_count === undefined) {
      return res.status(400).json({ error: 'software_name and vote_count required' });
    }

    const { error } = await supabase
      .from('votes')
      .update({ vote_count: parseInt(vote_count, 10) })
      .eq('software_name', software_name);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { software_name, reset } = req.body || {};

    if (reset) {
      const { error } = await supabase
        .from('votes')
        .delete()
        .neq('software_name', '');

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, reset: true });
    }

    if (!software_name) {
      return res.status(400).json({ error: 'software_name or reset:true required' });
    }

    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('software_name', software_name);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
