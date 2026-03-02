const supabase = require('../../lib/supabase');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
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
