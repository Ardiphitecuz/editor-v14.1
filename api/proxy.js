// api/proxy.js — Vercel & Netlify compatible
import axios from 'axios';

export const config = { maxDuration: 15 };

// ── Core logic ────────────────────────────────────────────────────────────────
async function handle(req, res) {
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
