// api/og.js — ambil og:image dari halaman artikel, ringan tanpa Readability
import axios from 'axios';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ image: null });

  const UAS = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)',
  ];

  let response = null;
  for (const ua of UAS) {
    try {
      response = await axios.get(url, {
        timeout: 7000,
        responseType: 'text',
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        maxRedirects: 3,
        // Batasi ukuran response — cukup untuk baca <head> saja
        maxContentLength: 150000,
      });
      if (response.status === 200) break;
    } catch { response = null; }
  }

  try {
    if (!response || response.status !== 200) return res.json({ image: null });

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