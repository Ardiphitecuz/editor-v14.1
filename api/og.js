// api/og.js — Vercel & Netlify compatible
import axios from 'axios';

export const config = { maxDuration: 10 };

// ── Core logic ────────────────────────────────────────────────────────────────
async function handle(req, res) {
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
        'Range': 'bytes=0-51200',
      },
      maxRedirects: 3,
    });

    const html = response.data ?? '';
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{10,})["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']{10,})["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+name=["']twitter:image["']/i);

    if (!match) return res.json({ image: null });

    let image = match[1].trim();
    if (image.startsWith('http://')) image = 'https://' + image.slice(7);
    if (image.startsWith('//')) image = 'https:' + image;
    if (image.startsWith('/')) {
      try { image = new URL(url).origin + image; } catch {}
    }

    return res.json({ image });
  } catch {
    return res.json({ image: null });
  }
}

// ── Vercel export ─────────────────────────────────────────────────────────────
export default handle;

// ── Netlify adapter ───────────────────────────────────────────────────────────
export const handler = netlifyAdapter(handle);

function netlifyAdapter(fn) {
  return async (event) => {
    let statusCode = 200;
    const headers = {};
    let body = '';

    const req = {
      method: event.httpMethod,
      query: event.queryStringParameters || {},
      headers: event.headers,
      body: event.body,
    };
    const res = {
      status(c) { statusCode = c; return this; },
      setHeader(k, v) { headers[k] = v; return this; },
      json(d) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(d); return this; },
      send(d) { body = typeof d === 'string' ? d : JSON.stringify(d); return this; },
      end() { return this; },
    };

    await fn(req, res);
    return { statusCode, headers, body };
  };
}
