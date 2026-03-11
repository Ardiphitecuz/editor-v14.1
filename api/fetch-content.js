// api/fetch-content.js — Vercel Serverless Function
// Fetch artikel penuh + Readability + allowlist sanitizer
// Ini adalah endpoint PALING PENTING — menentukan kualitas konten artikel
import axios from 'axios';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { JSDOM } = await import('jsdom');
    const { Readability } = await import('@mozilla/readability');

    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const pageUrl = new URL(url);
    const baseUrl = pageUrl.origin;
    const isJapaneseSite = /\.jp(\/|$)/.test(url) || /[\u3040-\u30ff\u4e00-\u9faf]/.test(url);

    // ── Fetch HTML dengan beberapa User-Agent fallback ─────────────────────────
    const fetchWithFallback = async (targetUrl) => {
      const baseHeaders = {
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      };
      const attempts = [
        { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9' : 'es-ES,es;q=0.9,en;q=0.8', 'Referer': baseUrl },
        { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'en-US,en;q=0.9' },
        { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      ];
      for (const extraHeaders of attempts) {
        try {
          const r = await axios.get(targetUrl, {
            timeout: 15000,
            responseType: 'arraybuffer',
            headers: { ...baseHeaders, ...extraHeaders },
            maxRedirects: 5,
          });
          if (r.status === 200) return r;
        } catch (e) {
          const s = e.response?.status;
          if (s === 403 || s === 429 || s === 503) continue;
          throw e;
        }
      }
      throw new Error(`Semua attempt gagal untuk ${targetUrl}`);
    };

    const response = await fetchWithFallback(url);

    // ── Decode charset ─────────────────────────────────────────────────────────
    const contentTypeHeader = response.headers['content-type'] ?? '';
    let charsetMatch = contentTypeHeader.match(/charset=([\w-]+)/i);
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

    // ── Helper: upgrade http → https, resolve URL relatif ─────────────────────
    function resolveUrl(src) {
      if (!src) return '';
      src = src.trim();
      if (src.startsWith('data:')) return '';
      if (src.startsWith('https://')) return src;
      if (src.startsWith('http://')) return src.replace('http://', 'https://');
      if (src.startsWith('//')) return 'https:' + src;
      if (src.startsWith('/')) return baseUrl + src;
      try { return new URL(src, url).href; } catch { return src; }
    }

    // ── og:image ───────────────────────────────────────────────────────────────
    let ogImage = null;
    const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      ?? html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImgMatch) ogImage = resolveUrl(ogImgMatch[1]);

    // ── Parse + FASE 1: hapus noise SEBELUM Readability ───────────────────────
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    ['script','style','noscript','iframe','ins','form','nav','header','footer','aside']
      .forEach(tag => doc.querySelectorAll(tag).forEach(el => el.remove()));

    const NOISE_PATTERN = /\b(sidebar|widget|related|recommend|rekomendasi|artikel[\s_-]terkait|baca[\s_-]juga|lihat[\s_-]juga|more[\s_-]post|also[\s_-]read|you[\s_-]may|share|social|comment|disqus|newsletter|subscribe|advertisement|sponsor|banner|promo|popular|trending|tag[\s_-]list|breadcrumb|pagination|post[\s_-]nav|author[\s_-]box|author[\s_-]bio|byline|related[\s_-]post|more[\s_-]from|read[\s_-]next|next[\s_-]article|prev[\s_-]article|floating|sticky[\s_-]bar|cookie|gdpr|popup|modal|overlay|entry[\s_-]meta|entry[\s_-]header|post[\s_-]meta|post[\s_-]header|post[\s_-]info|post[\s_-]category|cat[\s_-]links|post[\s_-]author|entry[\s_-]author|article[\s_-]header|article[\s_-]meta|article[\s_-]info|sharedaddy|jetpack|addtoany)\b/i;
    doc.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });

    // ── FASE 2: Readability ────────────────────────────────────────────────────
    const article = new Readability(doc, { charThreshold: 50, keepClasses: false }).parse();
    if (!article?.content || article.textContent.trim().length < 30) {
      return res.json({ success: false, error: 'Readability could not extract content', items: [] });
    }

    // ── FASE 2.5: Hapus noise dari output Readability ────────────────────────
    // Readability kadang tetap meloloskan elemen ber-class noise dari dalam konten
    const contentDomPre = new JSDOM(article.content, { url });
    const contentDocPre = contentDomPre.window.document;
    contentDocPre.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });
    // Ganti article.content dengan hasil cleaning
    article.content = contentDocPre.body.innerHTML;

    // ── FASE 3: Allowlist sanitizer ────────────────────────────────────────────
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

    const contentDom = new JSDOM(article.content, { url });
    const contentDoc = contentDom.window.document;
    const articleTitle = (article.title ?? '').trim().toLowerCase();

    function sanitizeNode(node) {
      if (node.nodeType === 8) { node.parentNode?.removeChild(node); return; }
      if (node.nodeType !== 1) return;

      const el = node;
      const tag = el.tagName?.toLowerCase();
      if (!tag) return;

      if (REMOVE_WITH_CONTENT.has(tag)) { el.remove(); return; }

      if (!ALLOWED_TAGS.has(tag)) {
        Array.from(el.childNodes).forEach(sanitizeNode);
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }

      el.removeAttribute('class');
      el.removeAttribute('id');
      el.removeAttribute('style');

      if (tag === 'img') {
        const src = el.getAttribute('src') || el.getAttribute('data-lazy-src')
          || el.getAttribute('data-original') || el.getAttribute('data-src') || '';
        if (!src || src.startsWith('data:') || TRACKING_IMG.test(src)) { el.remove(); return; }
        const w = parseInt(el.getAttribute('width') ?? '0');
        const h = parseInt(el.getAttribute('height') ?? '0');
        if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) { el.remove(); return; }
        const resolved = resolveUrl(src);
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
        const resolved = resolveUrl(href);
        if (resolved) {
          el.setAttribute('href', resolved);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
        Array.from(el.childNodes).forEach(sanitizeNode);
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

      if (!['img','a'].includes(tag)) {
        Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      }

      Array.from(el.childNodes).forEach(sanitizeNode);
    }

    Array.from(contentDoc.body.childNodes).forEach(sanitizeNode);

    // Post-pass: hapus elemen kosong
    contentDoc.body.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6').forEach(el => {
      if (!el.querySelector('img') && !(el.textContent ?? '').trim()) el.remove();
    });

    // Post-pass: hapus elemen navigasi berdasarkan link density
    // Cakupan: ul/ol (nav list), dan juga <p> yang isinya hampir semua link
    contentDoc.body.querySelectorAll('ul,ol,p,div').forEach(el => {
      const totalText = (el.textContent ?? '').replace(/\s+/g, '').length;
      if (!totalText) { el.remove(); return; }
      let linkText = 0;
      el.querySelectorAll('a').forEach(a => { linkText += (a.textContent ?? '').replace(/\s+/g, '').length; });
      const density = linkText / totalText;
      // ul/ol: threshold 0.75 (nav list), p/div: threshold 0.9 (hampir semua link)
      const threshold = (el.tagName === 'P' || el.tagName === 'DIV') ? 0.9 : 0.75;
      if (density >= threshold && !el.querySelector('img')) el.remove();
    });

    // Post-pass: hapus <p> yang isinya HANYA satu link (baca juga / artikel lain)
    contentDoc.body.querySelectorAll('p').forEach(p => {
      const anchors = p.querySelectorAll('a');
      const nonLinkText = (p.textContent ?? '')
        .replace(/<[^>]+>/g, '') // strip tags
        .trim();
      // Jika hanya ada link dan teks di luar link sangat pendek (max 10 char prefix/suffix)
      if (anchors.length >= 1) {
        let linkTotal = 0;
        anchors.forEach(a => linkTotal += (a.textContent ?? '').trim().length);
        const outside = (p.textContent ?? '').trim().length - linkTotal;
        if (outside <= 15) p.remove(); // hanya "Baca juga: " + link
      }
    });

    const contentHtml = contentDoc.body.innerHTML.trim();
    if (!contentHtml) {
      return res.json({ success: false, error: 'No content after sanitization', items: [] });
    }

    const plainText = (contentDoc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    const imgCount = contentDoc.body.querySelectorAll('img').length;
    const txtCount = contentDoc.body.querySelectorAll('p,h2,h3,h4').length;
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