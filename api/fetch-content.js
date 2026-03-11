// api/fetch-content.js — Vercel Serverless Function
// Menggunakan linkedom (ESM-native, ringan ~3MB) sebagai pengganti jsdom (~30MB)
// Referensi: https://github.com/mozilla/readability (Node.js usage)
// linkedom: https://github.com/WebReflection/linkedom

import axios from 'axios';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

export const config = { maxDuration: 30 };

// ── Konstanta di scope module ─────────────────────────────────────────────────
const NOISE_PATTERN = /\b(sidebar|widget|related|recommend|rekomendasi|artikel[\s_-]terkait|baca[\s_-]juga|lihat[\s_-]juga|more[\s_-]post|also[\s_-]read|you[\s_-]may|share|social|comment|disqus|newsletter|subscribe|advertisement|sponsor|banner|promo|popular|trending|tag[\s_-]list|breadcrumb|pagination|post[\s_-]nav|author[\s_-]box|author[\s_-]bio|byline|related[\s_-]post|more[\s_-]from|read[\s_-]next|next[\s_-]article|prev[\s_-]article|floating|sticky[\s_-]bar|cookie|gdpr|popup|modal|overlay|entry[\s_-]meta|entry[\s_-]header|post[\s_-]meta|post[\s_-]header|post[\s_-]info|post[\s_-]category|cat[\s_-]links|post[\s_-]author|entry[\s_-]author|article[\s_-]header|article[\s_-]meta|article[\s_-]info|sharedaddy|jetpack|addtoany)\b/i;

const ALLOWED_TAGS = new Set([
  'p','h1','h2','h3','h4','h5','h6',
  'ul','ol','li','blockquote','pre','code',
  'strong','em','b','i','s','u','br','hr',
  'a','img','figure','figcaption',
  'table','thead','tbody','tfoot','tr','th','td',
]);

const REMOVE_WITH_CONTENT = new Set([
  'script','style','noscript','iframe','object','embed',
  'form','input','button','select','textarea',
  'nav','header','footer','aside','menu','svg','canvas',
]);

const TRACKING_IMG = /feedburner\.com|doubleclick\.net|google-analytics|googletagmanager|pixel\.|1x1\.|2x1\.|tracking|analytics|stat\.|adserver|pagead|adsystem|scorecardresearch|quantserve|omniture|chartbeat|\/ads\/|\/ad\//i;

const NOISE_TEXT_EXACT = /^(advertisement|iklan|sponsored|promo|share(?: this)?|follow us|subscribe(?: now)?|sign up|comments?|related|read more|selengkapnya|baca juga|lihat juga|artikel terkait|rekomendasi|back to top|load more|see more|click here)\.?$/i;

const PUBLIC_PROXY_PREFIXES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

// ── Helper: resolve URL relatif ke absolut ────────────────────────────────────
function resolveUrl(src, baseUrl, pageUrl) {
  if (!src) return '';
  src = src.trim();
  if (src.startsWith('data:')) return '';
  if (src.startsWith('https://')) return src;
  if (src.startsWith('http://')) return src.replace('http://', 'https://');
  if (src.startsWith('//')) return 'https:' + src;
  if (src.startsWith('/')) return baseUrl + src;
  try { return new URL(src, pageUrl).href; } catch { return src; }
}

// ── Sanitize node (recursive) ─────────────────────────────────────────────────
function sanitizeNode(node, contentDoc, baseUrl, pageUrl, articleTitle) {
  if (node.nodeType === 8) { node.parentNode?.removeChild(node); return; }
  if (node.nodeType !== 1) return;

  const el = node;
  const tag = el.tagName?.toLowerCase();
  if (!tag) return;

  if (REMOVE_WITH_CONTENT.has(tag)) { el.remove(); return; }

  if (!ALLOWED_TAGS.has(tag)) {
    const children = Array.from(el.childNodes);
    children.forEach(c => sanitizeNode(c, contentDoc, baseUrl, pageUrl, articleTitle));
    while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
    el.remove();
    return;
  }

  el.removeAttribute('class');
  el.removeAttribute('id');
  el.removeAttribute('style');

  if (tag === 'img') {
    // Prioritas: data-lazy-src > data-src > data-original > src
    // Banyak situs lazy load menyimpan URL asli di data-* dan src berisi placeholder data:
    const lazySrc = el.getAttribute('data-lazy-src')
      || el.getAttribute('data-src')
      || el.getAttribute('data-original')
      || el.getAttribute('data-original-src')
      || el.getAttribute('data-hi-res-src');
    const rawSrc = el.getAttribute('src') || '';
    // Gunakan lazySrc jika ada, fallback ke src hanya jika bukan data URI placeholder
    const src = lazySrc || (rawSrc.startsWith('data:') ? '' : rawSrc);
    if (!src || TRACKING_IMG.test(src)) { el.remove(); return; }
    const w = parseInt(el.getAttribute('width') ?? '0');
    const h = parseInt(el.getAttribute('height') ?? '0');
    if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) { el.remove(); return; }
    const resolved = resolveUrl(src, baseUrl, pageUrl);
    if (!resolved) { el.remove(); return; }
    Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
    el.setAttribute('src', resolved);
    el.setAttribute('loading', 'lazy');
    el.setAttribute('alt', '');
    return;
  }

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
    const resolved = resolveUrl(href, baseUrl, pageUrl);
    if (resolved) {
      el.setAttribute('href', resolved);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    Array.from(el.childNodes).forEach(c => sanitizeNode(c, contentDoc, baseUrl, pageUrl, articleTitle));
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const text = (el.textContent ?? '').trim();
    if (text.toLowerCase() === articleTitle || NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
    if (tag === 'h1') {
      const h2 = contentDoc.createElement('h2');
      while (el.firstChild) h2.appendChild(el.firstChild);
      el.parentNode?.insertBefore(h2, el);
      el.remove();
      return;
    }
  }

  if (tag === 'p' || tag === 'li') {
    const text = (el.textContent ?? '').trim();
    if (NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
  }

  if (!['img', 'a'].includes(tag)) {
    Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
  }

  Array.from(el.childNodes).forEach(c => sanitizeNode(c, contentDoc, baseUrl, pageUrl, articleTitle));
}

// ── Main handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const pageUrl = new URL(url);
    const baseUrl = pageUrl.origin;
    const isJapaneseSite = /\.jp(\/|$)/.test(url) || /[\u3040-\u30ff\u4e00-\u9faf]/.test(url);

    // ── Fetch HTML ─────────────────────────────────────────────────────────────
    const fetchWithFallback = async (targetUrl) => {
      const baseHeaders = {
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      };
      const directAttempts = [
        { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9' : 'id-ID,id;q=0.9,en;q=0.8', 'Referer': baseUrl },
        { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'en-US,en;q=0.9' },
        { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      ];
      for (const extraHeaders of directAttempts) {
        try {
          const r = await axios.get(targetUrl, {
            timeout: 12000,
            responseType: 'arraybuffer',
            headers: { ...baseHeaders, ...extraHeaders },
            maxRedirects: 5,
          });
          if (r.status === 200) return r;
        } catch (e) {
          const s = e.response?.status;
          if (s === 403 || s === 429 || s === 503 || s === 401) continue;
        }
      }

      console.log(`[fetch-content] Direct blocked for ${targetUrl}, trying public proxies...`);
      for (const prefix of PUBLIC_PROXY_PREFIXES) {
        try {
          const proxyUrl = prefix + encodeURIComponent(targetUrl);
          const r = await axios.get(proxyUrl, {
            timeout: 15000,
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,*/*;q=0.8',
            },
            maxRedirects: 3,
          });
          if (r.status === 200) {
            const preview = new TextDecoder('utf-8', { fatal: false }).decode(r.data.slice(0, 100));
            if (preview.trimStart().startsWith('{') && prefix.includes('allorigins')) {
              const json = JSON.parse(new TextDecoder('utf-8').decode(r.data));
              r.data = new TextEncoder().encode(json.contents ?? '');
            }
            return r;
          }
        } catch { continue; }
      }

      throw new Error(`Semua fetch attempt gagal untuk ${targetUrl}`);
    };

    const response = await fetchWithFallback(url);

    // ── Decode charset ─────────────────────────────────────────────────────────
    const contentTypeHeader = response.headers['content-type'] ?? '';
    const charsetMatch = contentTypeHeader.match(/charset=([\w-]+)/i);
    let html;
    if (charsetMatch) {
      try { html = new TextDecoder(charsetMatch[1]).decode(response.data); }
      catch { html = new TextDecoder('utf-8').decode(response.data); }
    } else {
      const preliminary = new TextDecoder('utf-8', { fatal: false }).decode(response.data.slice(0, 2000));
      const metaCharset = preliminary.match(/<meta[^>]+charset=["']?([\w-]+)/i);
      if (metaCharset) {
        try { html = new TextDecoder(metaCharset[1]).decode(response.data); }
        catch { html = new TextDecoder('utf-8', { fatal: false }).decode(response.data); }
      } else {
        html = new TextDecoder('utf-8', { fatal: false }).decode(response.data);
      }
    }

    // ── og:image dari raw HTML ─────────────────────────────────────────────────
    let ogImage = null;
    const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      ?? html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImgMatch) ogImage = resolveUrl(ogImgMatch[1], baseUrl, url);

    // ── Parse HTML dengan linkedom (ESM-native, pengganti jsdom) ──────────────
    // linkedom: parseHTML(html) → { document }
    // WAJIB: Readability membutuhkan document.URL — set via baseURI trick
    const { document } = parseHTML(html);

    // Set baseURI agar Readability bisa resolve relative URL
    // linkedom memakai document.baseURI dari <base href> atau bisa di-set manual
    const baseTag = document.createElement('base');
    baseTag.setAttribute('href', url);
    document.head?.appendChild(baseTag);

    // ── FASE 1: Hapus noise SEBELUM Readability ───────────────────────────────
    // PENTING: noscript TIDAK dihapus di sini — banyak situs WordPress menyimpan
    // gambar asli di dalam <noscript> sebagai fallback lazy load.
    // Readability akan membongkar isinya, lalu sanitizeNode akan proses hasilnya.
    ['script','style','iframe','ins','form','nav','header','footer','aside']
      .forEach(tag => document.querySelectorAll(tag).forEach(el => el.remove()));

    document.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });

    // ── FASE 2: Readability dengan cloneNode + serializer DOM ─────────────────
    // Sesuai docs Mozilla: pass document.cloneNode(true) agar DOM asli tidak dimodifikasi
    // serializer: el => el → dapat DOM Element langsung (bukan string innerHTML)
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone, {
      charThreshold: 50,
      keepClasses: false,
      serializer: el => el,
    });
    const article = reader.parse();

    if (!article?.content || article.textContent.trim().length < 30) {
      return res.json({ success: false, error: 'Readability could not extract content', items: [] });
    }

    // article.content = DOM Element (karena serializer: el => el)
    const contentElement = article.content;
    const contentDoc = contentElement.ownerDocument;

    // ── FASE 3: Bersihkan noise dari output Readability ───────────────────────
    contentElement.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });

    // ── FASE 4: Allowlist sanitizer ───────────────────────────────────────────
    const articleTitle = (article.title ?? '').trim().toLowerCase();
    Array.from(contentElement.childNodes).forEach(node =>
      sanitizeNode(node, contentDoc, baseUrl, url, articleTitle)
    );

    // ── Post-pass: hapus elemen kosong ────────────────────────────────────────
    contentElement.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6').forEach(el => {
      if (!el.querySelector('img') && !(el.textContent ?? '').trim()) el.remove();
    });

    // Post-pass: link density
    contentElement.querySelectorAll('ul,ol,p,div').forEach(el => {
      const totalText = (el.textContent ?? '').replace(/\s+/g, '').length;
      if (!totalText) { el.remove(); return; }
      let linkText = 0;
      el.querySelectorAll('a').forEach(a => { linkText += (a.textContent ?? '').replace(/\s+/g, '').length; });
      const density = linkText / totalText;
      const threshold = (el.tagName === 'P' || el.tagName === 'DIV') ? 0.9 : 0.75;
      if (density >= threshold && !el.querySelector('img')) el.remove();
    });

    // Post-pass: hapus <p> yang isinya hanya satu link
    contentElement.querySelectorAll('p').forEach(p => {
      const anchors = p.querySelectorAll('a');
      if (anchors.length >= 1) {
        let linkTotal = 0;
        anchors.forEach(a => linkTotal += (a.textContent ?? '').trim().length);
        const outside = (p.textContent ?? '').trim().length - linkTotal;
        if (outside <= 15) p.remove();
      }
    });

    const contentHtml = contentElement.innerHTML.trim();
    if (!contentHtml) {
      return res.json({ success: false, error: 'No content after sanitization', items: [] });
    }

    const plainText = (contentElement.textContent ?? '').replace(/\s+/g, ' ').trim();
    const imgCount = contentElement.querySelectorAll('img').length;
    const txtCount = contentElement.querySelectorAll('p,h2,h3,h4').length;
    console.log(`[fetch-content] ${pageUrl.hostname} → ${txtCount} paragraf, ${imgCount} gambar`);

    return res.json({
      success: true,
      items: [{
        title: article.title ?? '',
        description: plainText.slice(0, 200),
        image: ogImage,
        summary: article.excerpt ?? plainText.slice(0, 200),
        contentHtml,
      }]
    });

  } catch (error) {
    const msg = error.message ?? String(error);
    console.error(`[fetch-content ERROR] ${msg}`);
    return res.status(500).json({ success: false, error: msg, items: [] });
  }
}