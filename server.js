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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    
    // Extract image
    let image = null;
    const ogImg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/.exec(html);
    if (ogImg) image = ogImg[1];

    const paragraphs = [];
    
    // Strategy 1: Find article/content container and extract all paragraphs
    const articleMatch = html.match(/<article[^>]*>[\s\S]*?<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>[\s\S]*?<\/main>/i);
    const contentDivMatch = html.match(/<div[^>]*class=["\']([^"]*content[^"]*)["\'][^>]*>[\s\S]{100,}<\/div>/i);
    
    let contentHtml = articleMatch?.[0] || mainMatch?.[0] || contentDivMatch?.[0] || html;

    // Extract all <p> tags with content
    const pMatches = contentHtml.match(/<p[^>]*>([^<]+(?:<[^/>][^>]*>[^<]*)*)<\/p>/gi) || [];
    pMatches.forEach(tag => {
      const text = tag
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 15) paragraphs.push(text);
    });

    // Strategy 2: If still low content, try extracting from other elements
    if (paragraphs.length < 3) {
      // Extract from divs, blockquotes, etc.
      const otherMatches = contentHtml.match(/<(div|blockquote|section)[^>]*>([^<]{50,}(?:<[^/>][^>]*>[^<]*)*)<\/(div|blockquote|section)>/gi) || [];
      otherMatches.forEach(tag => {
        const text = tag
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        // Only add if not already in paragraphs and long enough
        if (text.length > 40 && !paragraphs.some(p => p.includes(text.substring(0, 30)))) {
          paragraphs.push(text);
        }
      });
    }

    // Strategy 3: Fallback - split by common content delimiters
    if (paragraphs.length < 3) {
      // Remove script, style, nav, etc noise
      const cleanHtml = contentHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, '\n');
      
      const lines = cleanHtml
        .split(/\n+/)
        .map(l => l.trim())
        .filter(l => l.length > 30 && l.length < 1000 && !/^(var|function|if|else|return)/.test(l));
      
      paragraphs.push(...lines.slice(0, 12 - paragraphs.length));
    }

    // Limit to 12 paragraphs max
    const content = paragraphs.slice(0, 12);

    return res.json({ 
      success: content.length > 0, 
      items: [{
        title: '',
        description: content.join('\n\n'),
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