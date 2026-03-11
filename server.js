import express from 'express';
import axios from 'axios';
import cors from 'cors';
const app = express();

app.use(cors({ origin: '*' }));

const FEEDAPI_KEY = "69aec5f773dca1197d08df52.yyUs97SBONqeb3Y";

// ── HTML Entity Decoder lengkap ───────────────────────────────────────────────
const HTML_ENTITIES = {
  '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ',
  '&iexcl;':'¡','&cent;':'¢','&pound;':'£','&curren;':'¤','&yen;':'¥',
  '&brvbar;':'¦','&sect;':'§','&uml;':'¨','&copy;':'©','&ordf;':'ª',
  '&laquo;':'«','&not;':'¬','&shy;':'­','&reg;':'®','&macr;':'¯',
  '&deg;':'°','&plusmn;':'±','&sup2;':'²','&sup3;':'³','&acute;':'´',
  '&micro;':'µ','&para;':'¶','&middot;':'·','&cedil;':'¸','&sup1;':'¹',
  '&ordm;':'º','&raquo;':'»','&frac14;':'¼','&frac12;':'½','&frac34;':'¾',
  '&iquest;':'¿','&Agrave;':'À','&Aacute;':'Á','&Acirc;':'Â','&Atilde;':'Ã',
  '&Auml;':'Ä','&Aring;':'Å','&AElig;':'Æ','&Ccedil;':'Ç','&Egrave;':'È',
  '&Eacute;':'É','&Ecirc;':'Ê','&Euml;':'Ë','&Igrave;':'Ì','&Iacute;':'Í',
  '&Icirc;':'Î','&Iuml;':'Ï','&ETH;':'Ð','&Ntilde;':'Ñ','&Ograve;':'Ò',
  '&Oacute;':'Ó','&Ocirc;':'Ô','&Otilde;':'Õ','&Ouml;':'Ö','&times;':'×',
  '&Oslash;':'Ø','&Ugrave;':'Ù','&Uacute;':'Ú','&Ucirc;':'Û','&Uuml;':'Ü',
  '&Yacute;':'Ý','&THORN;':'Þ','&szlig;':'ß','&agrave;':'à','&aacute;':'á',
  '&acirc;':'â','&atilde;':'ã','&auml;':'ä','&aring;':'å','&aelig;':'æ',
  '&ccedil;':'ç','&egrave;':'è','&eacute;':'é','&ecirc;':'ê','&euml;':'ë',
  '&igrave;':'ì','&iacute;':'í','&icirc;':'î','&iuml;':'ï','&eth;':'ð',
  '&ntilde;':'ñ','&ograve;':'ò','&oacute;':'ó','&ocirc;':'ô','&otilde;':'õ',
  '&ouml;':'ö','&divide;':'÷','&oslash;':'ø','&ugrave;':'ù','&uacute;':'ú',
  '&ucirc;':'û','&uuml;':'ü','&yacute;':'ý','&thorn;':'þ','&yuml;':'ÿ',
  '&Alpha;':'Α','&Beta;':'Β','&Gamma;':'Γ','&Delta;':'Δ','&Epsilon;':'Ε',
  '&alpha;':'α','&beta;':'β','&gamma;':'γ','&delta;':'δ','&epsilon;':'ε',
  '&ndash;':'–','&mdash;':'—','&lsquo;':'\u2018','&rsquo;':'\u2019','&sbquo;':'\u201A',
  '&ldquo;':'\u201C','&rdquo;':'\u201D','&bdquo;':'\u201E','&dagger;':'†','&Dagger;':'‡',
  '&permil;':'‰','&lsaquo;':'\u2039','&rsaquo;':'\u203A','&euro;':'€','&trade;':'™',
  '&larr;':'←','&uarr;':'↑','&rarr;':'→','&darr;':'↓','&harr;':'↔',
  '&bull;':'•','&hellip;':'…','&prime;':'′','&Prime;':'″','&frasl;':'⁄',
};

function decodeHtmlEntities(str) {
  if (!str) return str;
  str = str.replace(/&[a-zA-Z]+;/g, e => HTML_ENTITIES[e] ?? e);
  str = str.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return str;
}

app.get('/', (req, res) => {
  res.send('Server Berjalan!');
});

// ── Article Content Fetcher (Readability + Strict Allowlist) ──────────────────
app.get('/api/fetch-content', async (req, res) => {
  try {
    const { JSDOM } = await import('jsdom');
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const pageUrl = new URL(url);
    const baseUrl = pageUrl.origin;
    const isJapaneseSite = /\.jp(\/|$)/.test(url) || /[\u3040-\u30ff\u4e00-\u9faf]/.test(url);

    // ── Multi-attempt fetch dengan berbagai User-Agent ────────────────────────
    const fetchWithFallback = async (targetUrl) => {
      const baseHeaders = {
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      };
      const attempts = [
        {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9' : 'es-ES,es;q=0.9,en;q=0.8',
          'Referer': baseUrl,
        },
        {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        },
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

    // ── Deteksi charset ───────────────────────────────────────────────────────
    const contentTypeHeader = response.headers['content-type'] ?? '';
    let charsetMatch = contentTypeHeader.match(/charset=([^\s;]+)/i);

    let html;
    if (charsetMatch) {
      const charset = charsetMatch[1].toLowerCase();
      try { html = new TextDecoder(charset).decode(response.data); }
      catch { html = new TextDecoder('utf-8').decode(response.data); }
    } else {
      const preliminary = new TextDecoder('utf-8', { fatal: false }).decode(response.data.slice(0, 2000));
      const metaCharset = preliminary.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i);
      if (metaCharset) {
        const charset = metaCharset[1].toLowerCase().replace('_', '-');
        try { html = new TextDecoder(charset).decode(response.data); }
        catch { html = preliminary + new TextDecoder('utf-8', { fatal: false }).decode(response.data.slice(2000)); }
      } else {
        html = new TextDecoder('utf-8', { fatal: false }).decode(response.data);
      }
    }

    // ── Helper: resolve URL relatif → absolut ─────────────────────────────────
    function resolveUrl(src) {
      if (!src) return src;
      src = src.trim();
      if (src.startsWith('data:') || src.startsWith('http')) return src;
      if (src.startsWith('//')) return pageUrl.protocol + src;
      if (src.startsWith('/')) return baseUrl + src;
      return baseUrl + '/' + src;
    }

    // ── Ambil og:image / twitter:image sebagai hero fallback ─────────────────
    let ogImage = null;
    const ogImgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImgMatch) ogImage = resolveUrl(ogImgMatch[1]);

    // ── FASE 1: Pre-process lazy-load images SEBELUM Readability ─────────────
    // Readability akan buang <img> yang src-nya kosong/placeholder.
    // Kita pindahkan data-src → src lebih dulu agar Readability tidak membuang gambar.
    const { Readability } = await import('@mozilla/readability');
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Pindahkan semua varian lazy-load attribute ke src
    doc.querySelectorAll('img').forEach(img => {
      const lazySrc =
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-original-src') ||
        img.getAttribute('data-actualsrc') ||
        img.getAttribute('data-full-src') ||
        img.getAttribute('data-image') ||
        img.getAttribute('data-url');
      if (lazySrc && !lazySrc.startsWith('data:')) {
        img.setAttribute('src', lazySrc);
      }
      // Juga pindahkan data-srcset → srcset agar resolusi tinggi tersedia
      const lazySrcset = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');
      if (lazySrcset) img.setAttribute('srcset', lazySrcset);
    });

    // ── FASE 2: Mozilla Readability ───────────────────────────────────────────
    const article = new Readability(doc, {
      charThreshold: 100,
      keepClasses: false,
    }).parse();

    if (!article || !article.content || article.textContent.trim().length < 100) {
      return res.json({ success: false, error: 'Readability could not extract content', items: [] });
    }

    // ── FASE 3: Strict HTML Allowlist Sanitization ────────────────────────────
    const contentDom = new JSDOM(article.content, { url });
    const cleanDoc = contentDom.window.document;

    // Tag yang diizinkan
    const ALLOWED_TAGS = new Set([
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'img', 'figure', 'figcaption',
      'a', 'strong', 'em', 'b', 'i', 'br',
      'table', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot',
    ]);

    // Pattern noise: teks editorial yang tidak perlu
    const NOISE_TEXT = /^(advertisement|iklan|sponsored|promo|share(?: this)?|follow us|subscribe(?: now)?|sign up|comment[s]?|related|recommend|trending|tag|kategori|baca juga|lihat juga|artikel terkait|rekomendasi|back to top|load more|see more|click here|続きを読む|もっと見る)[\s.:!]*$/i;

    // Pattern noise: URL gambar tracker / ikon / placeholder
    const NOISE_IMG = /logo|icon|avatar|pixel|1x1|2x1|3x1|spinner|loading|\.gif(\?|$)|\/ads\/|\/ad\/|adserver|stat\.|tracking|placeholder|feedburner|share\.|doubleclick|google-analytics|googletagmanager|scorecardresearch|quantserve|omniture|chartbeat/i;

    function sanitizeNode(node) {
      // Hapus komentar HTML
      if (node.nodeType === 8) { node.remove(); return; }

      if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();

        // Tag berbahaya: hapus beserta seluruh isinya
        if (['script', 'style', 'noscript', 'iframe', 'object', 'embed',
             'form', 'input', 'button', 'select', 'textarea',
             'nav', 'header', 'footer', 'aside', 'svg', 'canvas',
             'video', 'audio'].includes(tag)) {
          node.remove();
          return;
        }

        // Tag tidak di allowlist: unwrap (pertahankan isi, buang tag-nya)
        if (!ALLOWED_TAGS.has(tag)) {
          const children = Array.from(node.childNodes);
          children.forEach(child => node.parentNode.insertBefore(child, node));
          node.remove();
          return;
        }

        // Hapus SEMUA atribut kecuali yang aman
        const attrs = Array.from(node.attributes);
        for (const attr of attrs) {
          if (!['src', 'href', 'alt', 'title'].includes(attr.name)) {
            node.removeAttribute(attr.name);
          }
        }

        // Hapus teks noise dari paragraf / heading / list item
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tag)) {
          const text = node.textContent.trim();
          if (NOISE_TEXT.test(text) || text.length === 0) {
            node.remove();
            return;
          }
        }

        // ── Sanitasi khusus <img> ─────────────────────────────────────────────
        if (tag === 'img') {
          // Ambil src terbaik (lazy-load sudah dipindahkan ke src di pre-process,
          // tapi tetap cek ulang untuk jaga-jaga jika Readability memindahkannya)
          const src =
            node.getAttribute('data-lazy-src') ||
            node.getAttribute('data-src') ||
            node.getAttribute('data-original') ||
            node.getAttribute('data-original-src') ||
            node.getAttribute('data-actualsrc') ||
            node.getAttribute('data-full-src') ||
            node.getAttribute('src') ||
            '';

          // Buang gambar tracking / placeholder / data URI
          if (!src || src.startsWith('data:') || NOISE_IMG.test(src)) {
            node.remove();
            return;
          }

          // Buang tracking pixel berdasarkan dimensi (1×1 atau 2×2)
          const w = parseInt(node.getAttribute('width') ?? '0');
          const h = parseInt(node.getAttribute('height') ?? '0');
          if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) {
            node.remove();
            return;
          }

          const resolved = resolveUrl(src);
          if (!resolved) { node.remove(); return; }

          // Ambil srcset jika ada (untuk gambar responsif)
          const rawSrcset = node.getAttribute('srcset') || '';
          const cleanSrcset = rawSrcset
            ? rawSrcset.split(',').map(part => {
                const t = part.trim();
                const sp = t.search(/\s/);
                if (sp === -1) return resolveUrl(t) || null;
                const r = resolveUrl(t.slice(0, sp));
                return r ? r + t.slice(sp) : null;
              }).filter(Boolean).join(', ')
            : '';

          // Bersihkan semua atribut, set hanya yang diperlukan
          const alt = node.getAttribute('alt') ?? '';
          Array.from(node.attributes).forEach(a => node.removeAttribute(a.name));
          node.setAttribute('src', resolved);
          node.setAttribute('alt', alt);
          node.setAttribute('loading', 'lazy');
          node.setAttribute('decoding', 'async');
          if (cleanSrcset) node.setAttribute('srcset', cleanSrcset);
          return;
        }

        // ── Sanitasi khusus <a> ───────────────────────────────────────────────
        if (tag === 'a') {
          const href = node.getAttribute('href') ?? '';
          // Buang link javascript: atau kosong
          if (!href || href.startsWith('javascript:')) {
            // Unwrap: pertahankan teks link
            const children = Array.from(node.childNodes);
            children.forEach(child => node.parentNode.insertBefore(child, node));
            node.remove();
            return;
          }
          const resolved = resolveUrl(href);
          Array.from(node.attributes).forEach(a => node.removeAttribute(a.name));
          node.setAttribute('href', resolved);
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }

        // Proses anak-anak secara rekursif
        Array.from(node.childNodes).forEach(sanitizeNode);
      }
    }

    Array.from(cleanDoc.body.childNodes).forEach(sanitizeNode);

    // Post-pass: hapus elemen kosong yang tersisa
    cleanDoc.body.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6').forEach(el => {
      if (!el.querySelector('img') && !el.textContent.trim()) el.remove();
    });

    // Post-pass: hapus figure kosong
    cleanDoc.body.querySelectorAll('figure').forEach(el => {
      if (!el.querySelector('img') && !el.textContent.trim()) el.remove();
    });

    const finalCleanHtml = cleanDoc.body.innerHTML.trim();

    return res.json({
      success: true,
      items: [{
        title:       decodeHtmlEntities(article.title ?? ''),
        description: article.excerpt ?? '',
        image:       ogImage,
        summary:     article.excerpt ?? '',
        contentHtml: finalCleanHtml,
      }],
    });

  } catch (error) {
    const msg = error.message ?? String(error);
    const status = error.response?.status;
    res.status(500).json({ success: false, error: msg, status, items: [] });
  }
});

// ── FeedAPI endpoint ──────────────────────────────────────────────────────────
app.get('/api/feedapi', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const response = await axios.post(
      'https://api.feedapi.io/v1/analyze.json',
      { url },
      {
        params: { key: FEEDAPI_KEY },
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (response.data && response.data.items) {
      const items = response.data.items.map((item) => ({
        title:       item.title || '',
        link:        item.link || '',
        image:       item.image || item.imageUrl || '',
        description: item.description || item.summary || '',
        pubDate:     item.pubDate || item.date || new Date().toISOString(),
      }));
      return res.json({ success: true, items });
    }
    res.json({ success: false, items: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── RSS Proxy ─────────────────────────────────────────────────────────────────
app.get('/api/rss', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const response = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      maxRedirects: 5,
    });
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'text/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Proxy Raw URL ─────────────────────────────────────────────────────────────
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const response = await axios.get(url, {
      timeout: 15000,
      responseType: 'text',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      maxRedirects: 5,
    });
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Image Proxy (Bypass COEP) ─────────────────────────────────────────────────
app.get('/api/img', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL required');
    const parsed = new URL(url);
    const response = await axios.get(url, {
      timeout: 10000,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': parsed.origin,
        'Accept': 'image/*',
      },
      maxRedirects: 5,
    });
    res.setHeader('Content-Type', response.headers['content-type'] ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send('Image fetch failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));