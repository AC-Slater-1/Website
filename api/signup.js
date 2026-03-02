const supabase = require('../lib/supabase');

const VALID_PLANS = ['free', 'pro', 'scale'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, plan, source } = req.body || {};

  // Validate email
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (email.length > 255) {
    return res.status(400).json({ error: 'Email must be 255 chars or less' });
  }

  const cleanEmail = email.replace(/<[^>]*>/g, '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Validate plan
  const cleanPlan = (plan && typeof plan === 'string')
    ? plan.replace(/<[^>]*>/g, '').trim().toLowerCase()
    : 'free';
  const finalPlan = VALID_PLANS.includes(cleanPlan) ? cleanPlan : 'free';

  // Validate source
  const cleanSource = (source && typeof source === 'string' && source.length <= 50)
    ? source.replace(/<[^>]*>/g, '').trim()
    : null;

  if (!supabase) return res.json({ ok: true, fallback: true });

  // Check for duplicate email + plan combo
  const { data: existing } = await supabase
    .from('signups')
    .select('id')
    .eq('email', cleanEmail)
    .eq('plan', finalPlan)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.json({ ok: true, message: 'Already registered' });
  }

  const { data, error } = await supabase
    .from('signups')
    .insert({ email: cleanEmail, plan: finalPlan, source: cleanSource })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
}

module.exports = handler;
