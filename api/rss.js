// api/rss.js
export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

  try {
    const targetUrl = new URL(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)',
        'Referer': targetUrl.origin,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });
    clearTimeout(timeout);

    const text = await response.text();
    
    // Jika diblokir (403), Vercel tidak akan error 500, melainkan mengembalikan pesan aslinya
    if (!response.ok) {
      return res.status(response.status).send(text);
    }

    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}