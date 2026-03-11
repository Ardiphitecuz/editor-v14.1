import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

  try {
    const targetUrl = new URL(url);
    const response = await axios.get(url, {
      timeout: 10000,
      responseType: 'text',
      headers: {
        // Menyamar sebagai Browser Chrome versi terbaru dari Windows
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Referer': targetUrl.origin, // Pura-pura datang dari halaman depan situs mereka sendiri
        'Cache-Control': 'no-cache'
      },
      maxRedirects: 5,
    });
    
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'text/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(response.data);

  } catch (error) {
    // Tangani error jika tetap diblokir Cloudflare agar tidak menyebabkan 500 Internal Server Error
    const statusCode = error.response?.status || 400;
    console.error(`RSS Fetch Error (${url}):`, error.message);
    
    return res.status(statusCode).json({ 
      success: false, 
      error: `Diblokir oleh sumber (HTTP ${statusCode}): ${error.message}` 
    });
  }
}