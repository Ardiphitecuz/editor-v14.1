// api/img.js — Vercel Serverless Function untuk Proxy Gambar
export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL is required');

  try {
    const targetUrl = new URL(url);
    
    // Gunakan native fetch agar lebih stabil di Vercel
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl.origin, // Kunci utama untuk menembus Hotlink Protection!
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('Image blocked by source');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 1 hari
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).send('Failed to proxy image');
  }
}