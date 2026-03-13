// api/feeds.js — Vercel & Netlify compatible
import { handleFeedsRequest } from '../backend/newsroom-engine.js';

export const config = { maxDuration: 30 };

// ── Netlify adapter ───────────────────────────────────────────────────────────
function netlifyAdapter(fn) {
  return async (event) => {
    let statusCode = 200;
    const headers = {};
    let body = '';

    let parsedBody = event.body;
    if (parsedBody && typeof parsedBody === 'string') {
      try { parsedBody = JSON.parse(parsedBody); } catch {}
    }

    const req = {
      method: event.httpMethod,
      query: event.queryStringParameters || {},
      headers: event.headers,
      body: parsedBody,
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

// ── Core logic ────────────────────────────────────────────────────────────────
async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST or GET.' });
  }

  return handleFeedsRequest(req, res);
}

// ── Vercel export ─────────────────────────────────────────────────────────────
export default handle;

// ── Netlify export ─────────────────────────────────────────────────────────────
export const handler = netlifyAdapter(handle);
