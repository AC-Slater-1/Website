const https = require('https');
const supabase = require('../lib/supabase');

const VALID_PLANS = ['free', 'pro', 'scale'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Plan display names ──────────────────────
var PLAN_NAMES = { free: 'Free', pro: 'Pro', scale: 'Scale' };

// ── Welcome Email (Resend API) ──────────────
function sendWelcomeEmail(email, plan) {
  var apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return; // Silent no-op if not configured

  var planName = PLAN_NAMES[plan] || 'Free';

  var html = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>',
    '<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">',
    '<tr><td align="center">',
    '<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">',

    // Logo
    '<tr><td align="center" style="padding-bottom:32px;">',
    '<span style="font-family:\'Arial Black\',Impact,sans-serif;font-size:22px;letter-spacing:1.5px;">',
    '<span style="color:#ffd700;">APP</span><span style="color:#fafafa;">BUSTER</span></span>',
    '</td></tr>',

    // Card
    '<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;">',

    // Checkmark
    '<div style="text-align:center;margin-bottom:28px;">',
    '<div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);font-size:32px;text-align:center;">&#10003;</div>',
    '</div>',

    // Heading
    '<h1 style="color:#fafafa;font-size:24px;font-weight:800;text-align:center;margin:0 0 12px;">You\'re on the list!</h1>',
    '<p style="color:#a1a1aa;font-size:15px;line-height:1.7;text-align:center;margin:0 0 8px;">',
    'Thanks for signing up for the <strong style="color:#fafafa;">' + planName + '</strong> plan.',
    '</p>',
    '<p style="color:#a1a1aa;font-size:15px;line-height:1.7;text-align:center;margin:0 0 28px;">',
    'We\'re building something special and you\'ll be among the first to try it.',
    '</p>',

    // Divider
    '<div style="height:1px;background:#27272a;margin:0 0 28px;"></div>',

    // What happens next
    '<p style="color:#a1a1aa;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;text-align:center;margin:0 0 20px;">What happens next</p>',

    // Step 1
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">',
    '<tr>',
    '<td width="48" valign="top"><div style="width:36px;height:36px;line-height:36px;background:rgba(255,215,0,0.15);border-radius:10px;text-align:center;font-size:16px;">&#128640;</div></td>',
    '<td valign="top"><p style="margin:0;color:#fafafa;font-size:14px;font-weight:600;">Early access invite</p>',
    '<p style="margin:2px 0 0;color:#a1a1aa;font-size:13px;">We\'ll email you as soon as your spot opens up.</p></td>',
    '</tr></table>',

    // Step 2
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">',
    '<tr>',
    '<td width="48" valign="top"><div style="width:36px;height:36px;line-height:36px;background:rgba(255,215,0,0.15);border-radius:10px;text-align:center;font-size:16px;">&#127919;</div></td>',
    '<td valign="top"><p style="margin:0;color:#fafafa;font-size:14px;font-weight:600;">Curated for you</p>',
    '<p style="margin:2px 0 0;color:#a1a1aa;font-size:13px;">We\'ll match you with the best tools for your workflow.</p></td>',
    '</tr></table>',

    // Step 3
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">',
    '<tr>',
    '<td width="48" valign="top"><div style="width:36px;height:36px;line-height:36px;background:rgba(255,215,0,0.15);border-radius:10px;text-align:center;font-size:16px;">&#128176;</div></td>',
    '<td valign="top"><p style="margin:0;color:#fafafa;font-size:14px;font-weight:600;">Save from day one</p>',
    '<p style="margin:2px 0 0;color:#a1a1aa;font-size:13px;">Premium tools at a fraction of the cost. No commitments.</p></td>',
    '</tr></table>',

    // CTA Button
    '<div style="text-align:center;margin-top:28px;">',
    '<a href="https://appbuster.com/#tools" style="display:inline-block;padding:14px 32px;background:#ffd700;color:#09090b;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">Browse Free Tools</a>',
    '</div>',

    '</td></tr>',

    // Footer
    '<tr><td style="padding-top:32px;text-align:center;">',
    '<p style="color:#52525b;font-size:12px;margin:0;">AppBuster &copy; 2026</p>',
    '<p style="color:#52525b;font-size:11px;margin:8px 0 0;">',
    'You received this because you signed up at appbuster.com.<br>',
    '<a href="https://appbuster.com" style="color:#52525b;">appbuster.com</a>',
    '</p>',
    '</td></tr>',

    '</table>',
    '</td></tr></table>',
    '</body></html>'
  ].join('\n');

  var payload = JSON.stringify({
    from: 'AppBuster <noreply@send.appbuster.com>',
    to: [email],
    subject: 'Welcome to AppBuster — You\'re on the list!',
    html: html
  });

  var options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 5000
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      if (res.statusCode >= 400) {
        console.error('Resend error:', res.statusCode, data);
      }
    });
  });

  req.on('error', function(err) {
    console.error('Resend request failed:', err.message);
  });
  req.on('timeout', function() {
    req.destroy();
    console.error('Resend request timed out');
  });

  req.write(payload);
  req.end();
}

// ── Handler ─────────────────────────────────
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

  // Fire welcome email (non-blocking — don't await)
  sendWelcomeEmail(cleanEmail, finalPlan);

  return res.json({ ok: true });
}

module.exports = handler;
