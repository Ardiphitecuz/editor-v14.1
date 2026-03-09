import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

// IZINKAN SEMUA ORIGIN (Supaya tidak error CORS saat deploy)
app.use(cors({ origin: '*' }));

const FEEDAPI_KEY = "69aec5f773dca1197d08df52.yyUs97SBONqeb3Y";

app.get('/', (req, res) => {
  res.send('Server Berjalan!');
});

// FeedAPI endpoint for RSS Generator
app.get('/api/feedapi', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Make request to FeedAPI to extract articles
    const response = await axios.post(
      'https://api.feedapi.io/v1/analyze.json',
      { url },
      {
        params: { key: FEEDAPI_KEY },
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.data && response.data.items) {
      const items = response.data.items.map((item) => ({
        title: item.title || '',
        link: item.link || '',
        image: item.image || item.imageUrl || '',
        description: item.description || item.summary || '',
        pubDate: item.pubDate || item.date || new Date().toISOString(),
      }));

      return res.json({ success: true, items });
    }

    res.json({ success: false, items: [] });
  } catch (error) {
    console.error('FeedAPI Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'FeedAPI request failed',
      items: []
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));