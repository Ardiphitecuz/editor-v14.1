// server-rss.js
// Proxy RSS fetcher for Vercel/production
const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');

const app = express();
const parser = new Parser();
app.use(cors());

app.get('/api/rss', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing RSS url' });
  try {
    const feed = await parser.parseURL(url);
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RSS', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('RSS proxy server running on port', PORT);
});

// Usage: fetch('/api/rss?url=https://somoskudasai.com/feed')
