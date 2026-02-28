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

app.all('/api/votes', votesHandler);
app.all('/api/guestbook', guestbookHandler);
app.get('/api/downloads', downloadsListHandler);
app.post('/api/downloads/:appName', (req, res) => {
  // Vercel uses req.query for dynamic params, Express uses req.params
  req.query.appName = req.params.appName;
  downloadsIncrHandler(req, res);
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — serve index.html for unmatched routes (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AppBuster dev server running at http://localhost:${PORT}`);
});
