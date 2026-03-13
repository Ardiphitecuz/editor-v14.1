// api/rss.js — Vercel & Netlify compatible
export const config = { maxDuration: 15 };

// ── Core logic ────────────────────────────────────────────────────────────────
async function handle(req, res) {
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
    if (!response.ok) return res.status(response.status).send(text);

    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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
    let isBase64 = false;

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
    return { statusCode, headers, body, isBase64Encoded: isBase64 };
  };
}
