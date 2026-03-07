/**
 * refer.js — Referral invite endpoint
 * Sends an invite email to a friend via Resend and logs the referral.
 *
 * POST { friend_email, referrer_email }
 * Returns { ok: true } on success
 */

const https = require('https');
const supabase = require('../lib/supabase');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Rate Limiter ──────────────────────────────
// Max 10 referral emails per minute (server-wide)
var referTimestamps = [];
function isRateLimited() {
  var now = Date.now();
  while (referTimestamps.length && referTimestamps[0] < now - 60000) {
    referTimestamps.shift();
  }
  if (referTimestamps.length >= 10) return true;
  referTimestamps.push(now);
  return false;
}

// ── Send Invite Email ─────────────────────────
function sendInviteEmail(friendEmail, referrerEmail, callback) {
  var apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return callback(null, 'skipped');

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
    '<tr><td style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:48px 40px;text-align:center;">',

    // Envelope icon
    '<div style="margin-bottom:24px;">',
    '<div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:50%;background:rgba(255,215,0,0.15);font-size:32px;text-align:center;">&#9993;</div>',
    '</div>',

    // Heading
    '<h1 style="color:#fafafa;font-size:24px;font-weight:800;margin:0 0 16px;">You\'ve been invited!</h1>',
    '<p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 24px;">',
    'A friend thinks you\'d love AppBuster \u2014 premium SaaS tools at a fraction of the cost.',
    '</p>',

    // Value props
    '<div style="text-align:left;margin-bottom:24px;">',
    '<p style="color:#fafafa;font-size:14px;margin:0 0 8px;">\u2713 <span style="color:#a1a1aa;">Top tools like Notion, Slack, and Canva \u2014 bundled</span></p>',
    '<p style="color:#fafafa;font-size:14px;margin:0 0 8px;">\u2713 <span style="color:#a1a1aa;">Save up to 80% vs buying separately</span></p>',
    '<p style="color:#fafafa;font-size:14px;margin:0;">\u2713 <span style="color:#a1a1aa;">Free tier available \u2014 no credit card needed</span></p>',
    '</div>',

    // CTA Button
    '<div style="margin-top:28px;">',
    '<a href="https://appbuster.com/signup.html?source=referral" style="display:inline-block;padding:16px 40px;background:#ffd700;color:#09090b;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;">Join the Waitlist</a>',
    '</div>',

    '</td></tr>',

    // Footer
    '<tr><td style="padding-top:32px;text-align:center;">',
    '<p style="color:#52525b;font-size:12px;margin:0;">AppBuster &copy; 2026</p>',
    '<p style="color:#52525b;font-size:11px;margin:8px 0 0;">',
    'You received this because a friend invited you to AppBuster.<br>',
    '<a href="https://appbuster.com" style="color:#52525b;">appbuster.com</a>',
    '</p>',
    '</td></tr>',

    '</table>',
    '</td></tr></table>',
    '</body></html>'
  ].join('\n');

  var payload = JSON.stringify({
    from: 'AppBuster <noreply@send.appbuster.com>',
    to: [friendEmail],
    subject: 'You\'ve been invited to AppBuster',
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
        callback(new Error('Resend ' + res.statusCode + ': ' + data));
      } else {
        callback(null, 'sent');
      }
    });
  });

  req.on('error', function(err) { callback(err); });
  req.on('timeout', function() { req.destroy(); callback(new Error('timeout')); });
  req.write(payload);
  req.end();
}

// ── Handler ───────────────────────────────────
async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isRateLimited()) {
    return res.status(429).json({ error: 'Too many invites. Try again in a minute.' });
  }

  var body = req.body || {};
  var friendEmail = (body.friend_email || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
  var referrerEmail = (body.referrer_email || '').replace(/<[^>]*>/g, '').trim().toLowerCase();

  // Validate friend email
  if (!friendEmail || !EMAIL_REGEX.test(friendEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (friendEmail.length > 255) {
    return res.status(400).json({ error: 'Email too long.' });
  }

  // Don't let people invite themselves
  if (friendEmail === referrerEmail) {
    return res.status(400).json({ error: 'You can\'t invite yourself!' });
  }

  // Log referral to Supabase (best-effort — don't block on failure)
  if (supabase) {
    try {
      await supabase.from('referrals').insert({
        referrer_email: referrerEmail || null,
        friend_email: friendEmail
      });
    } catch (e) {
      // Table might not exist yet — that's fine, email still sends
      console.error('Referral log failed:', e.message);
    }
  }

  // Send invite email
  await new Promise(function(resolve) {
    sendInviteEmail(friendEmail, referrerEmail, function(err, result) {
      if (err) {
        console.error('Invite email failed:', err.message);
      }
      resolve();
    });
  });

  return res.status(200).json({ ok: true });
}

module.exports = handler;
