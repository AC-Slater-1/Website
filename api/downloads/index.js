const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const supabase = getSupabase();
    if (!supabase) return res.json({ downloads: [] });

    const { data, error } = await supabase
      .from('downloads')
      .select('app_name, download_count')
      .order('download_count', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ downloads: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
