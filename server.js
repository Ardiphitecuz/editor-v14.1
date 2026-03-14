import express from 'express';
import axios from 'axios';
import cors from 'cors';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { handleFeedsRequest } from './backend/newsroom-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// IZINKAN SEMUA ORIGIN (Supaya tidak error CORS saat deploy)
app.use(cors({ origin: '*' }));

// JSON body parser (untuk POST /api/feeds)
app.use(express.json({ limit: '1mb' }));

// FFmpeg requirements
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// ── Serve React build (dist/) di production ───────────────────────────────────
const distPath = join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1d' }));
}

// ── HTTPS Agent: abaikan sertifikat lemah (EE certificate key too weak) ────────
// Banyak situs berita lama pakai sertifikat SSL 1024-bit yang ditolak Node.js modern
const httpsAgentRelaxed = new https.Agent({ rejectUnauthorized: false });

// Helper: buat axios config dengan SSL relaxed untuk domain yang bermasalah
function axiosConfig(url, extra = {}) {
  const isHttps = url.startsWith('https://');
  return {
    ...extra,
    ...(isHttps ? { httpsAgent: httpsAgentRelaxed } : {}),
  };
}

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
  '&weierp;':'℘','&image;':'ℑ','&real;':'ℜ','&alefsym;':'ℵ',
  '&spades;':'♠','&clubs;':'♣','&hearts;':'♥','&diams;':'♦',
};

function decodeHtmlEntities(str) {
  if (!str) return str;
  // Named entities
  str = str.replace(/&[a-zA-Z]+;/g, e => HTML_ENTITIES[e] ?? e);
  // Decimal numeric: &#233;
  str = str.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  // Hex numeric: &#xE9;
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return str;
}

// Route '/' ditangani oleh express.static (dist/index.html)

// ── Bersihkan teks dari noise iklan ──────────────────────────────────────────
function cleanText(s) {
  if (!s) return s;
  return s
    .replace(/^\s*(?:ADS?|ADVERTISEMENT|SPONSORED|IKLAN|PROMO)\s+/i, '')
    .replace(/\[(?:ADS?|ADVERTISEMENT|SPONSORED)\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Article Content Fetcher — konten lengkap + gambar di posisi asli ──────────
app.get('/api/fetch-content', async (req, res) => {
  try {
    // Gunakan linkedom (sudah ada di package.json) alih-alih jsdom
    const { parseHTML } = await import('linkedom');
    const JSDOM = (html, opts = {}) => {
      const parsed = parseHTML(typeof html === 'string' ? html : String(html));
      return { window: { document: parsed.document } };
    };
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const pageUrl = new URL(url);
    const baseUrl = pageUrl.origin;
    const isJapaneseSite = /\.jp(\/|$)/.test(url) || /[\u3040-\u30ff\u4e00-\u9faf]/.test(url);

    const fetchWithFallback = async (targetUrl) => {
      const baseHeaders = {
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      };
      const attempts = [
        // Attempt 1: Chrome desktop
        { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9' : 'es-ES,es;q=0.9,en;q=0.8', 'Referer': baseUrl },
        // Attempt 2: tanpa Referer, pakai Accept-Language berbeda
        { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'en-US,en;q=0.9' },
        // Attempt 3: Googlebot
        { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      ];
      for (const extraHeaders of attempts) {
        try {
          const r = await axios.get(targetUrl, axiosConfig(targetUrl, {
            timeout: 15000,
            responseType: 'arraybuffer',
            headers: { ...baseHeaders, ...extraHeaders },
            maxRedirects: 5,
          }));
          if (r.status === 200) return r;
        } catch (e) {
          const s = e.response?.status;
          if (s === 403 || s === 429 || s === 503) continue; // coba attempt berikutnya
          throw e; // error lain langsung throw
        }
      }
      throw new Error(`Semua attempt gagal untuk ${targetUrl}`);
    };

    const response = await fetchWithFallback(url);

    // Detect charset dari Content-Type header atau meta tag
    const contentTypeHeader = response.headers['content-type'] ?? '';
    let charsetMatch = contentTypeHeader.match(/charset=([^\s;]+)/i);
    
    // Decode buffer
    let html;
    if (charsetMatch) {
      const charset = charsetMatch[1].toLowerCase();
      try {
        html = new TextDecoder(charset).decode(response.data);
      } catch {
        html = new TextDecoder('utf-8').decode(response.data);
      }
    } else {
      // Coba deteksi charset dari meta tag dengan decode UTF-8 dulu
      const preliminary = new TextDecoder('utf-8', { fatal: false }).decode(response.data.slice(0, 2000));
      const metaCharset = preliminary.match(/<meta[^>]+charset=["']?([^"';\s>]+)/i);
      if (metaCharset) {
        const charset = metaCharset[1].toLowerCase().replace('_', '-');
        try {
          html = new TextDecoder(charset).decode(response.data);
        } catch {
          html = preliminary + new TextDecoder('utf-8', { fatal: false }).decode(response.data.slice(2000));
        }
      } else {
        html = new TextDecoder('utf-8', { fatal: false }).decode(response.data);
      }
    }

    // ── Resolusi URL relatif ke absolut ───────────────────────────────────────
    function resolveUrl(src) {
      if (!src) return src;
      src = src.trim();
      if (src.startsWith('data:') || src.startsWith('https://')) return src;
      if (src.startsWith('http://')) return src.replace('http://', 'https://'); // upgrade HTTP→HTTPS
      if (src.startsWith('//')) return 'https:' + src;
      if (src.startsWith('/')) return baseUrl + src;
      return baseUrl + '/' + src;
    }

    // ── og:image ──────────────────────────────────────────────────────────────
    let ogImage = null;
    const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      ?? html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImgMatch) ogImage = resolveUrl(ogImgMatch[1]);

    // ── Parse HTML dengan jsdom ───────────────────────────────────────────────
    const { Readability } = await import('@mozilla/readability');
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // ── FASE 1: Hapus noise SEBELUM Readability ───────────────────────────────
    // Hapus berdasarkan tag semantik
    ['script','style','noscript','iframe','ins','form','nav','header','footer','aside']
      .forEach(tag => doc.querySelectorAll(tag).forEach(el => el.remove()));

    // ── FASE 1.5: Pre-process lazy-load images SEBELUM Readability ─────────────
    // Readability membuang <img> dengan src="placeholder.gif" atau data URI.
    // Pindahkan data-lazy-src / data-src → src agar Readability melihat gambar asli.
    doc.querySelectorAll('img').forEach(img => {
      const lazySrc =
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-original-src') ||
        img.getAttribute('data-actualsrc') ||
        img.getAttribute('data-full-src') ||
        img.getAttribute('data-image') ||
        img.getAttribute('data-url') ||
        img.getAttribute('data-hi-res-src') ||
        img.getAttribute('data-img-url');
      if (lazySrc && lazySrc.trim() && !lazySrc.startsWith('data:')) {
        img.setAttribute('src', lazySrc.trim());
      }
      const lazySrcset = img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset');
      if (lazySrcset) img.setAttribute('srcset', lazySrcset);
    });

    // Beberapa situs pakai <source> di dalam <picture> — ambil srcset-nya ke <img>
    doc.querySelectorAll('picture').forEach(pic => {
      const sources = pic.querySelectorAll('source');
      const img = pic.querySelector('img');
      if (img && sources.length > 0) {
        // Ambil source pertama yang bukan WebP (lebih kompatibel) atau pertama saja
        const best = Array.from(sources).find(s => !s.getAttribute('type')?.includes('webp'))
          ?? sources[0];
        const srcset = best.getAttribute('srcset') || best.getAttribute('data-srcset');
        if (srcset && !img.getAttribute('src')?.startsWith('http')) {
          // Ambil URL pertama dari srcset
          const firstUrl = srcset.trim().split(/[\s,]+/)[0];
          if (firstUrl && firstUrl.startsWith('http')) {
            img.setAttribute('src', firstUrl);
          }
        }
      }
    });

    // Hapus berdasarkan class/id yang mengandung kata noise
    // Strategi: cek SETIAP elemen, kalau class/id-nya noise → hapus
    const NOISE_PATTERN = /\b(sidebar|widget|related|recommend|rekomendasi|artikel[\s_-]terkait|baca[\s_-]juga|lihat[\s_-]juga|more[\s_-]post|also[\s_-]read|you[\s_-]may|share|social|comment|disqus|newsletter|subscribe|advertisement|sponsor|banner|promo|popular|trending|tag[\s_-]list|breadcrumb|pagination|post[\s_-]nav|author[\s_-]box|author[\s_-]bio|byline|related[\s_-]post|more[\s_-]from|read[\s_-]next|next[\s_-]article|prev[\s_-]article|floating|sticky[\s_-]bar|cookie|gdpr|popup|modal|overlay|entry[\s_-]meta|entry[\s_-]header|post[\s_-]meta|post[\s_-]header|post[\s_-]info|post[\s_-]category|cat[\s_-]links|post[\s_-]author|entry[\s_-]author|article[\s_-]header|article[\s_-]meta|article[\s_-]info|sharedaddy|jetpack|addtoany)\b/i;

    doc.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });

    // ── FASE 2: Jalankan Readability ─────────────────────────────────────────
    const article = new Readability(doc, {
      charThreshold: 50,   // Diturunkan dari 100 — supaya まとめ blog pendek tetap bisa diekstrak
      keepClasses: false,
    }).parse();

    if (!article || !article.content || article.textContent.trim().length < 30) {
      return res.json({ success: false, error: 'Readability could not extract content', items: [] });
    }

    // ── FASE 2.5: Hapus noise dari output Readability ────────────────────────
    const contentDomPre = new JSDOM(article.content, { url });
    const contentDocPre = contentDomPre.window.document;
    contentDocPre.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });
    article.content = contentDocPre.body.innerHTML;

    // ── FASE 3: Sanitasi dengan pendekatan ALLOWLIST (Inoreader-style) ─────────
    // Prinsip: hapus SEMUA class/id/style, hanya izinkan tag tipografi editorial
    // Ini jauh lebih robust dari blocklist — iklan tidak bisa bersembunyi di nama class baru

    const ALLOWED_TAGS = new Set([
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'strong', 'em', 'b', 'i', 's', 'u', 'br', 'hr',
      'a', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ]);

    const REMOVE_WITH_CONTENT = new Set([
      'script', 'style', 'noscript', 'iframe', 'object', 'embed',
      'form', 'input', 'button', 'select', 'textarea',
      'nav', 'header', 'footer', 'aside', 'menu', 'svg', 'canvas',
    ]);

    // URL pola tracking pixel & iklan — lebih agresif dari nama class
    const TRACKING_IMG = /feedburner\.com|doubleclick\.net|google-analytics|googletagmanager|pixel\.|1x1\.|2x1\.|tracking|analytics|stat\.|adserver|pagead|adsystem|scorecardresearch|quantserve|omniture|chartbeat|\/ads\/|\/ad\//i;
    const NOISE_TEXT_EXACT = /^(advertisement|iklan|sponsored|promo|share(?: this)?|follow us|subscribe(?: now)?|sign up|comments?|related|read more|selengkapnya|baca juga|lihat juga|artikel terkait|rekomendasi|back to top|load more|see more|click here)\.?$/i;

    const contentDom = new JSDOM(article.content, { url });
    const contentDoc = contentDom.window.document;
    const articleTitle = (article.title ?? '').trim().toLowerCase();

    function sanitizeNode(node) {
      if (node.nodeType === 8) { // COMMENT
        node.parentNode?.removeChild(node);
        return;
      }
      if (node.nodeType !== 1) return; // bukan ELEMENT

      const el = node;
      const tag = el.tagName?.toLowerCase();
      if (!tag) return;

      // Buang tag beserta isinya
      if (REMOVE_WITH_CONTENT.has(tag)) { el.remove(); return; }

      // Tag tidak dalam allowlist → unwrap (angkat children ke parent)
      if (!ALLOWED_TAGS.has(tag)) {
        Array.from(el.childNodes).forEach(sanitizeNode);
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }

      // ── Tag dalam allowlist: bersihkan atribut ──

      // HAPUS semua class/id/style — selalu, tanpa pengecualian
      el.removeAttribute('class');
      el.removeAttribute('id');
      el.removeAttribute('style');

      if (tag === 'img') {
        const src = el.getAttribute('src') || el.getAttribute('data-lazy-src')
          || el.getAttribute('data-original') || el.getAttribute('data-src') || '';
        // Buang tracking pixel berdasarkan URL
        if (!src || src.startsWith('data:') || TRACKING_IMG.test(src)) { el.remove(); return; }
        // Buang gambar 1×1 / 2×1 pixel
        const w = parseInt(el.getAttribute('width') ?? '0');
        const h = parseInt(el.getAttribute('height') ?? '0');
        if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) { el.remove(); return; }
        const resolved = resolveUrl(src);
        if (!resolved) { el.remove(); return; }
        // Set atribut bersih
        Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
        el.setAttribute('src', resolved);
        el.setAttribute('loading', 'lazy');
        el.setAttribute('alt', '');
        return; // img tidak punya children
      }

      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
        if (href) {
          el.setAttribute('href', resolveUrl(href) || href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
        Array.from(el.childNodes).forEach(sanitizeNode);
        return;
      }

      // Heading: skip jika duplikasi judul artikel
      if (/^h[1-6]$/.test(tag)) {
        const text = (el.textContent ?? '').trim();
        if (text.toLowerCase() === articleTitle) { el.remove(); return; }
        if (NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
        // Downgrade h1 → h2 (judul sudah di atas)
        if (tag === 'h1') {
          const h2 = contentDoc.createElement('h2');
          while (el.firstChild) h2.appendChild(el.firstChild);
          el.parentNode?.insertBefore(h2, el);
          el.remove();
          return;
        }
      }

      // Paragraf: buang noise
      if (tag === 'p' || tag === 'li') {
        const text = (el.textContent ?? '').trim();
        if (NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
      }

      // Hapus atribut lain yang tersisa (kecuali untuk tag khusus)
      if (!['img', 'a'].includes(tag)) {
        Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      }

      // Rekursif ke children
      Array.from(el.childNodes).forEach(sanitizeNode);
    }

    // Log gambar sebelum sanitasi (untuk debug)
    const imgBeforeSanitize = Array.from(contentDoc.body.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || '(no src)');
    if (imgBeforeSanitize.length > 0) {
      console.log(`[fetch-content] ${pageUrl.hostname} → ${imgBeforeSanitize.length} gambar sebelum sanitasi`);
    }

    Array.from(contentDoc.body.childNodes).forEach(sanitizeNode);

    // Post-pass: hapus elemen kosong
    contentDoc.body.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6').forEach(el => {
      if (!el.querySelector('img') && !(el.textContent ?? '').trim()) el.remove();
    });

    // Post-pass: hapus elemen navigasi berdasarkan link density
    contentDoc.body.querySelectorAll('ul,ol,p,div').forEach(el => {
      const totalText = (el.textContent ?? '').replace(/\s+/g, '').length;
      if (!totalText) { el.remove(); return; }
      let linkText = 0;
      el.querySelectorAll('a').forEach(a => { linkText += (a.textContent ?? '').replace(/\s+/g, '').length; });
      const density = linkText / totalText;
      const threshold = (el.tagName === 'P' || el.tagName === 'DIV') ? 0.9 : 0.75;
      if (density >= threshold && !el.querySelector('img')) el.remove();
    });

    // Post-pass: hapus <p> yang isinya HANYA satu link (baca juga / artikel lain)
    contentDoc.body.querySelectorAll('p').forEach(p => {
      const anchors = p.querySelectorAll('a');
      if (anchors.length >= 1) {
        let linkTotal = 0;
        anchors.forEach(a => linkTotal += (a.textContent ?? '').trim().length);
        const outside = (p.textContent ?? '').trim().length - linkTotal;
        if (outside <= 15) p.remove();
      }
    });

    const contentHtml = contentDoc.body.innerHTML.trim();

    if (!contentHtml) {
      return res.json({ success: false, error: 'No content after sanitization', items: [] });
    }

    // Extract plain text untuk summary
    const plainText = (contentDoc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    const firstText = plainText.slice(0, 200);

    const imgCount = contentDoc.body.querySelectorAll('img').length;
    const txtCount = contentDoc.body.querySelectorAll('p, h2, h3, h4').length;
    console.log(`[fetch-content] ${pageUrl.hostname} → ${txtCount} paragraf, ${imgCount} gambar`);

    return res.json({
      success: true,
      items: [{
        title: article.title ?? '',
        description: firstText,
        image: ogImage,
        summary: article.excerpt ?? firstText,
        contentHtml,
      }]
    });

  } catch (error) {
    const msg = error.message ?? String(error);
    const status = error.response?.status;
    const detail = error.response?.data ? String(error.response.data).slice(0, 200) : '';
    console.error(`[fetch-content ERROR] ${error.config?.url?.slice(0,80) ?? 'unknown'}`);
    console.error(`  status: ${status ?? 'no response'}, msg: ${msg}`);
    if (detail) console.error(`  detail: ${detail}`);
    res.status(500).json({ success: false, error: msg, status, items: [] });
  }
});

// ── og:image extractor — ringan, hanya fetch 50KB pertama untuk baca meta tag ──
// Frontend memanggil: GET /api/og?url=https://example.com/article
app.get('/api/og', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.query;
  if (!url) return res.status(400).json({ image: null });

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'text/html,*/*;q=0.8',
        // Hanya 50KB pertama — cukup untuk meta tags di <head>
        'Range': 'bytes=0-51200',
      },
      maxRedirects: 3,
    });

    const html = response.data ?? '';
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (!match) return res.json({ image: null });

    let image = match[1].trim();
    if (image.startsWith('http://')) image = 'https://' + image.slice(7);
    if (image.startsWith('//')) image = 'https:' + image;
    if (image.startsWith('/')) {
      try { image = new URL(url).origin + image; } catch {}
    }

    return res.json({ image: image.startsWith('https://') ? image : null });
  } catch {
    return res.json({ image: null });
  }
});

// FeedAPI endpoint for RSS Generator
app.get('/api/feedapi', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Make request to FeedAPI to extract articles
    const response = await axios.post(
      'https://api.feedapi.io/v1/analyze.json',
      { url },
      {
        params: { key: FEEDAPI_KEY },
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.data && response.data.items) {
      const items = response.data.items.map((item) => ({
        title: item.title || '',
        link: item.link || '',
        image: item.image || item.imageUrl || '',
        description: item.description || item.summary || '',
        pubDate: item.pubDate || item.date || new Date().toISOString(),
      }));

      return res.json({ success: true, items });
    }

    res.json({ success: false, items: [] });
  } catch (error) {
    console.error('FeedAPI Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'FeedAPI request failed',
      items: []
    });
  }
});

// ── RSS / XML Proxy ───────────────────────────────────────────────────────────
// Menggantikan proxy publik (corsproxy, allorigins, dll) yang sering tidak stabil.
// Frontend memanggil: GET /api/rss?url=https://example.com/feed
app.get('/api/rss', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await axios.get(url, axiosConfig(url, {
        timeout: 25000,
        responseType: 'text',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Cache-Control': 'no-cache',
        },
        maxRedirects: 5,
      }));
      clearTimeout(timer);
      const contentType = response.headers['content-type'] ?? 'text/xml';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(response.data);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error('RSS proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Raw URL Proxy (untuk artikel / website biasa) ─────────────────────────────
// Frontend memanggil: GET /api/proxy?url=https://example.com/article
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    const response = await axios.get(url, axiosConfig(url, {
      timeout: 15000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      maxRedirects: 5,
    }));

    const contentType = response.headers['content-type'] ?? 'text/html';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Image Proxy — bypass COEP/CORS untuk gambar cross-origin ─────────────────
// Frontend memanggil: GET /api/img?url=https://cdn.example.com/image.jpg
app.get('/api/img', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL required');

    const parsed = new URL(url);
    const isHttps = url.startsWith('https://');
    const agent = isHttps ? httpsAgent : undefined;

    // Coba berbagai Referer agar tidak diblokir hotlink protection
    const attempts = [
      { 'Referer': parsed.origin, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      { 'Referer': url, 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    ];

    let lastError;
    for (const headers of attempts) {
      try {
        const response = await axios.get(url, {
          timeout: 8000,
          responseType: 'stream',
          headers: {
            'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
            ...headers,
          },
          maxRedirects: 5,
          ...(agent ? { httpsAgent: agent } : {}),
        });

        const ct = response.headers['content-type'] ?? 'image/jpeg';
        if (!ct.includes('image') && !ct.includes('octet')) {
          // Bukan gambar, skip
          continue;
        }
        res.setHeader('Content-Type', ct);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        response.data.pipe(res);
        return;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        if (status !== 403 && status !== 429 && status !== 401) throw err;
      }
    }
    throw lastError;
  } catch (error) {
    console.error('[img proxy]', error.message);
    res.status(404).send('Image not available');
  }
});

// ── Newsroom RSS Engine — /api/feeds ─────────────────────────────────────────
// Port penuh dari the-newsroom-rss (https://github.com/royalgarter/the-newsroom-rss)
// Mendukung GET dan POST, kompatibel dengan newsroom frontend API contract
app.get('/api/feeds', handleFeedsRequest);
app.post('/api/feeds', handleFeedsRequest);
app.options('/api/feeds', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

// ── Video Downloader API — /api/video-dl ─────────────────────────────────────
// Sinkron dengan folder api/video-dl.js untuk testing frontend (npm run dev)
app.post('/api/video-dl', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const isTikTok = url.includes('tiktok.com');
    if (isTikTok) {
      const tikwmRes = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url: url, hd: 1 })
      });
      const data = await tikwmRes.json();
      if (data.code === 0 && data.data && data.data.play) {
        return res.status(200).json({ url: data.data.play });
      } else {
        return res.status(400).json({ error: data.msg || 'Gagal mengambil video dari TikTok.' });
      }
    } else {
      return res.status(400).json({ error: 'Saat ini pengambilan otomatis hanya mendukung link TikTok. Untuk platform lain, gunakan downloader pihak ketiga lalu upload videonya secara manual.' });
    }
  } catch (error) {
    console.error("Video DL Error:", error);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem internal saat memproses video.' });
  }
});


// SPA fallback — semua route non-/api/* → index.html
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

export default app;