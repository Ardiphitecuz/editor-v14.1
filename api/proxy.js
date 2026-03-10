// api/proxy.js — Vercel Serverless Function: raw HTML proxy
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8,ja;q=0.7',
      },
      maxRedirects: 5,
    });
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(response.data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}