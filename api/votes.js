const supabase = require('../lib/supabase');

// Validate software_name: alphanumeric, spaces, dots, common punctuation. Max 100 chars.
function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length > 100) return false;
  return /^[a-zA-Z0-9\s.\-()&+\/]+$/.test(name);
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();


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
    const { software_name } = req.body || {};
    if (!isValidName(software_name)) {
      return res.status(400).json({ error: 'Invalid software_name' });
    }
    if (!supabase) return res.json({ ok: true, fallback: true });

    // Always increment by 1 — bonus vote is cosmetic client-side only
    const increment = 1;

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
