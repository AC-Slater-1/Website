const crypto = require('crypto');
const supabase = require('../../lib/supabase');

// ── Auth helpers ──────────────────────────────────────────
function generateToken() {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) return null;
  const ts = Date.now().toString();
  const hmac = crypto.createHmac('sha256', secret).update(ts).digest('hex');
  return ts + '.' + hmac;
}

function validateToken(req) {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const ts = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const age = Date.now() - parseInt(ts, 10);
  if (isNaN(age) || age < 0 || age > 86400000) return false;
  const expected = crypto.createHmac('sha256', secret).update(ts).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch { return false; }
}

function setCorsHeaders(res, req) {
  const origin = req && req.headers && req.headers.origin;
  const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Rate limiter (login) ──────────────────────────────────
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getRateLimitKey(req) {
  return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}
function checkRateLimit(key) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record) return true;
  if (now - record.firstAttempt > WINDOW_MS) { attempts.delete(key); return true; }
  return record.count < MAX_ATTEMPTS;
}
function recordAttempt(key) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now });
  } else { record.count++; }
}
setInterval(function() {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAttempt > WINDOW_MS) attempts.delete(key);
  }
}, 30 * 60 * 1000).unref?.();

// ── Route handlers ────────────────────────────────────────
async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit(clientKey)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Build list of valid credentials: ADMIN_USERS (user:pass|user:pass) + legacy single-user env vars
  var validUsers = [];
  var usersStr = process.env.ADMIN_USERS;
  if (usersStr) {
    usersStr.split('|').forEach(function(entry) {
      var sep = entry.indexOf(':');
      if (sep > 0) validUsers.push({ username: entry.slice(0, sep), password: entry.slice(sep + 1) });
    });
  }
  var legacyUser = process.env.ADMIN_USERNAME;
  var legacyPass = process.env.ADMIN_PASSWORD;
  if (legacyUser && legacyPass) {
    validUsers.push({ username: legacyUser, password: legacyPass });
  }
  if (validUsers.length === 0) return res.status(500).json({ error: 'Admin not configured' });

  // Timing-safe check against all users
  var matched = false;
  var userBuf = Buffer.from(username.toLowerCase());
  var passBuf = Buffer.from(password);
  for (var i = 0; i < validUsers.length; i++) {
    var eu = Buffer.from(validUsers[i].username.toLowerCase());
    var ep = Buffer.from(validUsers[i].password);
    var uOk = userBuf.length === eu.length && crypto.timingSafeEqual(userBuf, eu);
    var pOk = passBuf.length === ep.length && crypto.timingSafeEqual(passBuf, ep);
    if (uOk && pOk) { matched = true; break; }
  }
  if (!matched) { recordAttempt(clientKey); return res.status(401).json({ error: 'Invalid username or password' }); }
  const token = generateToken();
  if (!token) return res.status(500).json({ error: 'Token generation failed' });
  res.json({ ok: true, token });
}

async function handleStats(req, res) {
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

async function handleGuestbook(req, res) {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('guestbook').select('id, name, location, message, created_at').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ entries: data });
  }
  if (req.method === 'DELETE') {
    const { ids } = req.body || {};
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const { error } = await supabase.from('guestbook').delete().in('id', ids);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, deleted: ids.length });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function handleDownloads(req, res) {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('downloads').select('app_name, download_count, last_downloaded_at').order('download_count', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ downloads: data });
  }
  if (req.method === 'PUT') {
    const { app_name, download_count } = req.body || {};
    if (!app_name || download_count === undefined) return res.status(400).json({ error: 'app_name and download_count required' });
    const { error } = await supabase.from('downloads').update({ download_count: parseInt(download_count, 10) }).eq('app_name', app_name);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function handleVotes(req, res) {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('votes').select('software_name, vote_count').order('vote_count', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ votes: data });
  }
  if (req.method === 'PUT') {
    const { software_name, vote_count } = req.body || {};
    if (!software_name || vote_count === undefined) return res.status(400).json({ error: 'software_name and vote_count required' });
    const { error } = await supabase.from('votes').update({ vote_count: parseInt(vote_count, 10) }).eq('software_name', software_name);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { software_name, reset } = req.body || {};
    if (reset) {
      const { error } = await supabase.from('votes').delete().neq('software_name', '');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, reset: true });
    }
    if (!software_name) return res.status(400).json({ error: 'software_name or reset:true required' });
    const { error } = await supabase.from('votes').delete().eq('software_name', software_name);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

async function handleSignups(req, res) {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

  var [allRows, todayCount, weekCount] = await Promise.all([
    supabase.from('signups').select('id, email, plan, source, created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('signups').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('signups').select('id', { count: 'exact', head: true }).gte('created_at', weekStart)
  ]);

  if (allRows.error) return res.status(500).json({ error: allRows.error.message });

  var signups = allRows.data || [];
  var total = signups.length;
  var today = todayCount.count || 0;
  var week = weekCount.count || 0;

  // Compute breakdowns
  var byPlan = { free: 0, pro: 0, scale: 0 };
  var bySource = {};
  for (var i = 0; i < signups.length; i++) {
    var s = signups[i];
    if (byPlan[s.plan] !== undefined) byPlan[s.plan]++;
    var src = s.source || 'direct';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  // Days since first signup for avg/day calc
  var firstDate = signups.length > 0 ? new Date(signups[signups.length - 1].created_at) : now;
  var daySpan = Math.max(1, Math.ceil((now - firstDate) / 86400000));
  var avgPerDay = total > 0 ? (total / daySpan).toFixed(1) : '0';

  res.json({
    signups: signups,
    stats: { total: total, today: today, this_week: week, avg_per_day: avgPerDay, by_plan: byPlan, by_source: bySource }
  });
}

// ── Main router ───────────────────────────────────────────
async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract the sub-route from the catch-all path
  // Vercel sets query key as "[...path]" for [[...path]].js; Express uses "path"
  const rawPath = req.query.path || req.query['[...path]'];
  const pathSegments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const route = pathSegments[0] || '';

  // Login doesn't require auth token
  if (route === 'login') return handleLogin(req, res);

  // Everything else requires auth
  if (!validateToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  switch (route) {
    case 'stats': return handleStats(req, res);
    case 'guestbook': return handleGuestbook(req, res);
    case 'downloads': return handleDownloads(req, res);
    case 'votes': return handleVotes(req, res);
    case 'signups': return handleSignups(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}

module.exports = handler;
