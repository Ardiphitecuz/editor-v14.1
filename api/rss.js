// api/rss.js — Vercel Serverless Function: RSS/XML proxy
import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSAggregator/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      maxRedirects: 5,
    });
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'text/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(response.data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}