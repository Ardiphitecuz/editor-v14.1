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
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl.origin,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

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