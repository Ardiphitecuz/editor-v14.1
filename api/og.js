// api/og.js — ambil og:image dari halaman artikel, ringan tanpa Readability
import axios from 'axios';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ image: null });

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'text/html,*/*;q=0.8',
        // Hanya minta 50KB pertama — cukup untuk meta tags di <head>
        'Range': 'bytes=0-51200',
      },
      maxRedirects: 3,
    });

    const html = response.data ?? '';
    // Cari og:image, twitter:image, atau <img> pertama
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{10,})["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']{10,})["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+name=["']twitter:image["']/i);

    if (!match) return res.json({ image: null });

    let image = match[1].trim();
    // Upgrade HTTP ke HTTPS
    if (image.startsWith('http://')) image = 'https://' + image.slice(7);
    // Resolve URL relatif
    if (image.startsWith('//')) image = 'https:' + image;
    if (image.startsWith('/')) {
      try {
        const base = new URL(url).origin;
        image = base + image;
      } catch {}
    }

    return res.json({ image });
  } catch {
    return res.json({ image: null });
  }
}