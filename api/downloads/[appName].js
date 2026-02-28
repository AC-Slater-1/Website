const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { appName } = req.query;
    const supabase = getSupabase();
    if (!supabase) return res.json({ ok: true, fallback: true });

    const { data: existing } = await supabase
      .from('downloads')
      .select('download_count')
      .eq('app_name', appName)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('downloads')
        .update({
          download_count: existing.download_count + 1,
          last_downloaded_at: new Date().toISOString()
        })
        .eq('app_name', appName);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from('downloads')
        .insert({ app_name: appName, download_count: 1 });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
