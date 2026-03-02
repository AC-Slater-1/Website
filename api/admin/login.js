const crypto = require('crypto');
const { generateToken, setCorsHeaders } = require('./auth');

// In-memory rate limiter: max 5 attempts per IP per 15 minutes
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getRateLimitKey(req) {
  return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(key) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record) return true;

  // Clean up expired entries
  if (now - record.firstAttempt > WINDOW_MS) {
    attempts.delete(key);
    return true;
  }

  return record.count < MAX_ATTEMPTS;
}

function recordAttempt(key) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

// Periodic cleanup to prevent memory leak (every 30 min)
setInterval(function() {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAttempt > WINDOW_MS) attempts.delete(key);
  }
}, 30 * 60 * 1000).unref?.();

async function handler(req, res) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit check
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit(clientKey)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return res.status(500).json({ error: 'Admin not configured' });

  // Constant-time comparison for both fields
  const userBuf = Buffer.from(username);
  const passBuf = Buffer.from(password);
  const expectedUserBuf = Buffer.from(expectedUser);
  const expectedPassBuf = Buffer.from(expectedPass);

  const userMatch = userBuf.length === expectedUserBuf.length &&
    crypto.timingSafeEqual(userBuf, expectedUserBuf);
  const passMatch = passBuf.length === expectedPassBuf.length &&
    crypto.timingSafeEqual(passBuf, expectedPassBuf);

  if (!userMatch || !passMatch) {
    recordAttempt(clientKey);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = generateToken();
  if (!token) return res.status(500).json({ error: 'Token generation failed' });

  res.json({ ok: true, token });
}

module.exports = handler;
