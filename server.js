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

// Direct content fetcher endpoint
app.get('/api/fetch-content', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    
    // Extract image
    let image = null;
    const ogImg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/.exec(html);
    if (ogImg) image = ogImg[1];

    // Extract content paragraphs
    const pTags = html.match(/<p[^>]*>([^<]+)<\/p>/g) || [];
    const content = pTags
      .slice(0, 12)
      .map(tag => tag.replace(/<[^>]+>/g, '').trim())
      .filter(text => text.length > 15);

    return res.json({ 
      success: content.length > 0, 
      items: [{
        title: '',
        description: content.join('\n'),
        image: image,
        summary: content[0] || ''
      }]
    });
  } catch (error) {
    console.error('Content fetch error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      items: []
    });
  }
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