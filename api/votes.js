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
    if (!supabase) return res.json({ votes: [], total: 0 });

    const { data, error } = await supabase
      .from('votes')
      .select('software_name, vote_count')
      .order('vote_count', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    const total = data.reduce((sum, v) => sum + v.vote_count, 0);
    return res.json({ votes: data, total });
  }

  if (req.method === 'POST') {
    const { software_name, bonus } = req.body || {};
    if (!software_name) return res.status(400).json({ error: 'software_name required' });
    if (!supabase) return res.json({ ok: true, fallback: true });

    const increment = bonus ? 2 : 1;

    const { data: existing } = await supabase
      .from('votes')
      .select('vote_count')
      .eq('software_name', software_name)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('votes')
        .update({ vote_count: existing.vote_count + increment })
        .eq('software_name', software_name);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from('votes')
        .insert({ software_name, vote_count: increment });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
