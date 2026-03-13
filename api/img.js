// api/img.js — Vercel & Netlify compatible
export const config = { maxDuration: 15 };

// ── Core logic ────────────────────────────────────────────────────────────────
async function handle(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL is required');

  try {
    const targetUrl = new URL(url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl.origin,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) return res.status(response.status).send('Image blocked by source');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch {
    res.status(500).send('Failed to proxy image');
  }
}

// ── Vercel export ─────────────────────────────────────────────────────────────
export default handle;

// ── Netlify adapter (binary-safe) ─────────────────────────────────────────────
export const handler = async (event) => {
  const { url } = event.queryStringParameters || {};
  if (!url) return { statusCode: 400, body: 'URL is required' };

  try {
    const targetUrl = new URL(url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl.origin,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) return { statusCode: response.status, body: 'Image blocked by source' };

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 500, body: 'Failed to proxy image' };
  }
};
