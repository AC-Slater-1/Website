const crypto = require('crypto');

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

  // Check expiry (24 hours)
  const age = Date.now() - parseInt(ts, 10);
  if (isNaN(age) || age < 0 || age > 86400000) return false;

  // Recompute HMAC and compare
  const expected = crypto.createHmac('sha256', secret).update(ts).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

function setCorsHeaders(res, req) {
  // Admin routes: restrict to same-origin only
  // In production, admin.html is served from the same domain — no CORS needed.
  // For local dev, allow localhost origins explicitly.
  const origin = req && req.headers && req.headers.origin;
  const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // If no origin or not allowed, omit CORS header (same-origin works without it)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { generateToken, validateToken, setCorsHeaders };
