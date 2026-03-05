const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Import Vercel-style handlers and mount for Express
const votesHandler = require('./api/votes');
const guestbookHandler = require('./api/guestbook');
const downloadsListHandler = require('./api/downloads/index');
const downloadsIncrHandler = require('./api/downloads/[appName]');
const adminHandler = require('./api/admin/[[...path]]');
const signupHandler = require('./api/signup');
const eventsHandler = require('./api/events');
const feedbackHandler = require('./api/feedback');

// Admin catch-all — extract sub-route into req.query.path for the handler
// Express 5 makes req.query read-only (getter), so use defineProperty to override
app.all('/api/admin/:route', (req, res) => {
  Object.defineProperty(req, 'query', { value: { path: [req.params.route] }, writable: true });
  adminHandler(req, res);
});

app.all('/api/votes', votesHandler);
app.all('/api/guestbook', guestbookHandler);
app.all('/api/signup', signupHandler);
app.all('/api/events', express.text({ type: '*/*' }), eventsHandler);
app.all('/api/feedback', feedbackHandler);
app.get('/api/downloads', downloadsListHandler);
app.post('/api/downloads/:appName', (req, res) => {
  // Vercel uses req.query for dynamic params, Express 5 makes req.query read-only
  Object.defineProperty(req, 'query', { value: { appName: req.params.appName }, writable: true });
  downloadsIncrHandler(req, res);
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// 404 for unmatched API routes (don't let SPA fallback mask missing endpoints)
app.all('/api/{*splat}', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA fallback — serve index.html for unmatched non-API routes
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AppBuster dev server running at http://localhost:${PORT}`);
});
