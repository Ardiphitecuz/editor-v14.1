// api/fetch-content.js — Vercel & Netlify compatible
import axios from 'axios';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

export const config = { maxDuration: 30 };

// ── Konstanta di scope module ─────────────────────────────────────────────────
const NOISE_PATTERN = /\b(sidebar|widget|related|recommend|rekomendasi|artikel[\s_-]terkait|baca[\s_-]juga|lihat[\s_-]juga|more[\s_-]post|also[\s_-]read|you[\s_-]may|share|social|comment|disqus|newsletter|subscribe|advertisement|sponsor|banner|promo|popular|trending|tag[\s_-]list|breadcrumb|pagination|post[\s_-]nav|author[\s_-]box|author[\s_-]bio|byline|related[\s_-]post|more[\s_-]from|read[\s_-]next|next[\s_-]article|prev[\s_-]article|floating|sticky[\s_-]bar|cookie|gdpr|popup|modal|overlay|entry[\s_-]meta|entry[\s_-]header|post[\s_-]meta|post[\s_-]header|post[\s_-]info|post[\s_-]category|cat[\s_-]links|post[\s_-]author|entry[\s_-]author|article[\s_-]header|article[\s_-]meta|article[\s_-]info|sharedaddy|jetpack|addtoany|ranking|matome[\s_-]list|pickup|osusume|kanren|tags?[\s_-]box|tag[\s_-]cloud|wp[\s_-]block[\s_-](?:tag|category|archive|latest)|post[\s_-]tags|article[\s_-]tags|after[\s_-]post|below[\s_-]post|post[\s_-]bottom|article[\s_-]bottom|content[\s_-]bottom|single[\s_-]bottom|entry[\s_-]bottom|inner[\s_-]related|yarpp|nrelate|contextly|zergnet|taboola|outbrain|revcontent|mgid|ads?[\s_-](?:area|container|wrapper|box|unit|slot|block)|google[\s_-]ad|dfp|adsbygoogle)\b/i;

const ALLOWED_TAGS = new Set([
  'p','h1','h2','h3','h4','h5','h6',
  'ul','ol','li','blockquote','pre','code',
  'strong','em','b','i','br',
  'a','img','figure','figcaption',
  'table','thead','tbody','tfoot','tr','th','td',
  'div','iframe','video','audio','source'
]);

const REMOVE_WITH_CONTENT = new Set([
  'script','style','noscript',
  'form','input','button','select','textarea',
  'nav','header','footer','aside','menu','svg','canvas',
]);

const TRACKING_IMG = /feedburner|doubleclick|google-analytics|googletagmanager|pixel\.|analytics|share\.|adserver|pagead|adsystem|scorecardresearch|quantserve|omniture|chartbeat|\/ads\/|\/ad\/|fanza|dmm\.co\.jp|a8\.net|valuecommerce|accesstrade|linkshare|affiliate|banner|sponsored|ad\.nicovideo|impress\.jp\/ad|shinobi\.jp|ninja\.co\.jp\/ad/i;
const NOISE_TEXT_EXACT = /^(advertisement|iklan|sponsored|promo|share(?: this)?|follow us|subscribe(?: now)?|sign up|comments?|related|read more|selengkapnya|baca juga|lihat juga|artikel terkait|rekomendasi|back to top|load more|see more|click here|続きを読む|もっと見る)\.?$/i;

const PUBLIC_PROXY_PREFIXES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  el.removeAttribute('class'); el.removeAttribute('id'); el.removeAttribute('style');
  if (tag === 'img') {
    const lazySrc = el.getAttribute('data-lazy-src') || el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-original-src') || el.getAttribute('data-hi-res-src');
    const rawSrc = el.getAttribute('src') || '';
    const src = lazySrc || (rawSrc.startsWith('data:') ? '' : rawSrc);
    if (!src || TRACKING_IMG.test(src)) { el.remove(); return; }
    const w = parseInt(el.getAttribute('width') ?? '0');
    const h = parseInt(el.getAttribute('height') ?? '0');
    if ((w === 1 || w === 2) && (h === 1 || h === 2)) { el.remove(); return; }
    const resolved = resolveUrl(src, baseUrl, pageUrl);
    if (!resolved) { el.remove(); return; }
    Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
    el.setAttribute('src', resolved); el.setAttribute('loading', 'lazy'); el.setAttribute('alt', '');
    return;
  }
  if (['iframe', 'video', 'audio', 'source'].includes(tag)) {
    const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
    const resolved = resolveUrl(src, baseUrl, pageUrl);
    if (resolved) el.setAttribute('src', resolved);
    Array.from(el.attributes).forEach(a => {
      if (!['src','width','height','frameborder','allow','allowfullscreen','controls','poster'].includes(a.name.toLowerCase())) el.removeAttribute(a.name);
    });
    return;
  }
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    const resolved = resolveUrl(href, baseUrl, pageUrl);

    Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
    if (resolved) { el.setAttribute('href', resolved); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
    Array.from(el.childNodes).forEach(c => sanitizeNode(c, contentDoc, baseUrl, pageUrl, articleTitle));
    return;
  }
  if (/^h[1-6]$/.test(tag)) {
    const text = (el.textContent ?? '').trim().toLowerCase();
    if (text === articleTitle || (text.length > 10 && (articleTitle.includes(text) || text.includes(articleTitle))) || NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
    if (tag === 'h1') {
      const h2 = contentDoc.createElement('h2');
      while (el.firstChild) h2.appendChild(el.firstChild);
      el.parentNode?.insertBefore(h2, el); el.remove(); return;
    }
  }
  if (tag === 'p' || tag === 'li') {
    if (NOISE_TEXT_EXACT.test((el.textContent ?? '').trim())) { el.remove(); return; }
  }
  if (!['img','a','iframe','video','audio','source'].includes(tag)) {
    Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
  }
  Array.from(el.childNodes).forEach(c => sanitizeNode(c, contentDoc, baseUrl, pageUrl, articleTitle));
}

// ── Core logic ────────────────────────────────────────────────────────────────
async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const pageUrl = new URL(url);
    const baseUrl = pageUrl.origin;
    const isJapaneseSite = /\.jp(\/|$)/.test(url) || /[\u3040-\u30ff\u4e00-\u9faf]/.test(url);

    const fetchWithFallback = async (targetUrl) => {
      const baseHeaders = { 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', 'Cache-Control': 'no-cache' };
      const directAttempts = [
        { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Accept-Language': isJapaneseSite ? 'ja-JP,ja;q=0.9' : 'id-ID,id;q=0.9,en;q=0.8', 'Referer': baseUrl },
        { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept-Language': 'en-US,en;q=0.9' },
        { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      ];
      for (const extraHeaders of directAttempts) {
        try {
          const r = await axios.get(targetUrl, { timeout: 12000, responseType: 'arraybuffer', headers: { ...baseHeaders, ...extraHeaders }, maxRedirects: 5 });
          if (r.status === 200) return r;
        } catch (e) {
          const s = e.response?.status;
          if (s === 403 || s === 429 || s === 503 || s === 401) continue;
        }
      }
      for (const prefix of PUBLIC_PROXY_PREFIXES) {
        try {
          const r = await axios.get(prefix + encodeURIComponent(targetUrl), { timeout: 15000, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*;q=0.8' }, maxRedirects: 3 });
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
    const contentTypeHeader = response.headers['content-type'] ?? '';
    const charsetMatch = contentTypeHeader.match(/charset=([\w-]+)/i);
    let html;
    if (charsetMatch) {
      try { html = new TextDecoder(charsetMatch[1]).decode(response.data); } catch { html = new TextDecoder('utf-8').decode(response.data); }
    } else {
      const preliminary = new TextDecoder('utf-8', { fatal: false }).decode(response.data.slice(0, 2000));
      const metaCharset = preliminary.match(/<meta[^>]+charset=["']?([\w-]+)/i);
      if (metaCharset) {
        try { html = new TextDecoder(metaCharset[1]).decode(response.data); } catch { html = new TextDecoder('utf-8', { fatal: false }).decode(response.data); }
      } else {
        html = new TextDecoder('utf-8', { fatal: false }).decode(response.data);
      }
    }

    let ogImage = null;
    const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      ?? html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImgMatch) ogImage = resolveUrl(ogImgMatch[1], baseUrl, url);

    const { document } = parseHTML(html);
    const baseTag = document.createElement('base');
    baseTag.setAttribute('href', url);
    document.head?.appendChild(baseTag);

    ['script','style','ins','form','nav','header','footer','aside'].forEach(tag => document.querySelectorAll(tag).forEach(el => el.remove()));
    document.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });

    // Hapus スポンサードリンク + wrapper-nya sebelum Readability
    document.querySelectorAll('p,div,span,b,strong').forEach(el => {
      const t = (el.textContent ?? '').trim();
      if (t === 'スポンサードリンク' || t === 'スポンサーリンク' || /^(sponsored ?link|スポンサー広告)$/i.test(t)) {
        const parent = el.parentElement;
        if (parent && parent.tagName !== 'BODY' && parent.tagName !== 'ARTICLE' &&
            (parent.textContent ?? '').trim().length < 300) {
          parent.remove();
        } else {
          el.remove();
        }
      }
    });

    // Hapus div/p/center yang hanya berisi <a eksternal><img></a> — banner iklan tanpa class
    document.querySelectorAll('div,p,center,figure').forEach(wrapper => {
      const kids = Array.from(wrapper.children);
      if (kids.length !== 1 || kids[0].tagName !== 'A') return;
      const a = kids[0];
      const href = a.getAttribute('href') ?? '';
      if (!href) return;
      try {
        const hrefHost = new URL(href, url).hostname;
        if (hrefHost === pageUrl.hostname) return;
        // Link eksternal yang hanya berisi gambar = banner iklan
        const onlyImg = a.children.length === 1 && a.children[0].tagName === 'IMG';
        const noText = (a.textContent ?? '').replace(/\s+/g, '').length === 0;
        if (onlyImg || noText) wrapper.remove();
      } catch {}
    });

    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone, { charThreshold: 50, keepClasses: false, serializer: el => el });
    const article = reader.parse();

    if (!article?.content || article.textContent.trim().length < 30) {
      return res.json({ success: false, error: 'Readability could not extract content', items: [] });
    }

    const contentElement = article.content;
    const contentDoc = contentElement.ownerDocument;

    contentElement.querySelectorAll('[class],[id]').forEach(el => {
      const cls = el.getAttribute('class') ?? '';
      const id  = el.getAttribute('id') ?? '';
      if (NOISE_PATTERN.test(cls) || NOISE_PATTERN.test(id)) el.remove();
    });

    const articleTitle = (article.title ?? '').trim().toLowerCase();
    Array.from(contentElement.childNodes).forEach(node => sanitizeNode(node, contentDoc, baseUrl, url, articleTitle));

    // ── Strip judul duplikat & thumbnail di awal konten ──────────────────────
    // Judul dan hero image sudah ditampilkan terpisah di atas artikel.

    // Hapus semua heading yang teksnya mirip judul artikel
    contentElement.querySelectorAll('h1,h2,h3').forEach(h => {
      const t = (h.textContent ?? '').trim().toLowerCase();
      const limit = 40;
      if (t.length > 10 && (
        t === articleTitle ||
        articleTitle.slice(0, limit) === t.slice(0, limit) ||
        (articleTitle.length > 20 && t.includes(articleTitle.slice(0, limit))) ||
        (t.length > 20 && articleTitle.includes(t.slice(0, limit)))
      )) h.remove();
    });

    // Hapus <img> pertama jika filename sama dengan ogImage (thumbnail sudah ada di atas)
    if (ogImage) {
      const firstImg = contentElement.querySelector('img');
      if (firstImg) {
        const ogFile = ogImage.split('/').pop()?.split('?')[0] ?? '';
        const srcFile = (firstImg.getAttribute('src') ?? '').split('/').pop()?.split('?')[0] ?? '';
        if (ogFile && srcFile && ogFile === srcFile) firstImg.remove();
      }
    }

    // Hapus gambar dengan dimensi eksplisit kecil (≤200px) — thumbnail artikel terkait
    contentElement.querySelectorAll('img').forEach(img => {
      const w = parseInt(img.getAttribute('width') ?? '0');
      const h = parseInt(img.getAttribute('height') ?? '0');
      if ((w > 0 && w <= 200) || (h > 0 && h <= 200)) img.remove();
    });

    contentElement.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,div').forEach(el => {
      if (!el.querySelector('img,iframe,video') && !(el.textContent ?? '').trim()) el.remove();
    });

    // Post-pass: link density — buang blok navigasi/artikel-terkait
    contentElement.querySelectorAll('ul,ol,p,div,section').forEach(el => {
      const totalText = (el.textContent ?? '').replace(/\s+/g, '').length;
      if (!totalText) { el.remove(); return; }
      let linkText = 0;
      const links = el.querySelectorAll('a');
      links.forEach(a => { linkText += (a.textContent ?? '').replace(/\s+/g, '').length; });
      const density = linkText / totalText;
      // Threshold lebih agresif: div/section 70%, ul/ol/p 60%
      const threshold = (el.tagName === 'UL' || el.tagName === 'OL') ? 0.60
        : (el.tagName === 'P') ? 0.70
        : 0.70; // div, section
      // Jangan hapus jika berisi media atau terlalu sedikit link (bukan nav)
      if (density >= threshold && links.length >= 2 && !el.querySelector('img,iframe,video')) el.remove();
    });

    // Post-pass: hapus blok berisi banyak link artikel (artikel terkait tanpa class)
    // Deteksi: li berisi hanya <a> dengan href ke domain yang sama
    const pageHost = pageUrl.hostname;
    contentElement.querySelectorAll('ul,ol').forEach(list => {
      const items = list.querySelectorAll('li');
      if (items.length < 2) return;
      let internalLinkItems = 0;
      items.forEach(li => {
        const links = li.querySelectorAll('a');
        const text = (li.textContent ?? '').replace(/\s+/g, ' ').trim();
        // Li yang isinya hampir semuanya link internal
        if (links.length >= 1) {
          const linkHrefs = Array.from(links).map(a => a.getAttribute('href') ?? '');
          const hasInternal = linkHrefs.some(h => h.includes(pageHost) || h.startsWith('/'));
          if (hasInternal && text.length < 150) internalLinkItems++;
        }
      });
      // Jika >60% item berisi link internal pendek → artikel terkait
      if (internalLinkItems / items.length > 0.6 && !list.querySelector('img,iframe,video')) {
        list.remove();
      }
    });
    contentElement.querySelectorAll('p').forEach(p => {
      const anchors = p.querySelectorAll('a');
      if (anchors.length >= 1) {
        let linkTotal = 0;
        anchors.forEach(a => linkTotal += (a.textContent ?? '').trim().length);
        if ((p.textContent ?? '').trim().length - linkTotal <= 15 && !p.querySelector('img,iframe,video')) p.remove();
      }
    });

    // Post-pass: hapus blok "judul + tanggal + komentar" khas Yaraon
    // Pattern: <a>judul artikel</a> diikuti tanggal (YYYY.MM.DD) dan "N件のコメント"
    contentElement.querySelectorAll('a').forEach(a => {
      const aText = (a.textContent ?? '').trim().toLowerCase();
      const artText = articleTitle.toLowerCase();
      // Link dengan teks sangat mirip judul artikel (>70% sama)
      if (aText.length > 20 && artText.length > 20) {
        const shorter = Math.min(aText.length, artText.length);
        const common = aText.slice(0, shorter) === artText.slice(0, shorter);
        if (common) {
          // Hapus parent block yang berisi link ini + sibling (tanggal, komentar)
          const parent = a.parentElement;
          if (parent && parent !== contentElement) parent.remove();
          else a.remove();
        }
      }
    });

    // Post-pass: hapus blok sponsor (スポンサードリンク + semua sibling sampai elemen teks berikutnya)
    contentElement.querySelectorAll('p,div,span,b,strong').forEach(el => {
      const t = (el.textContent ?? '').trim();
      if (t === 'スポンサードリンク' || t === 'スポンサーリンク' || /^sponsored\s*(link)?$/i.test(t)) {
        // Hapus semua sibling setelahnya yang bukan paragraf teks (biasanya banner div)
        let next = el.nextSibling;
        while (next) {
          const sibling = next;
          next = sibling.nextSibling;
          const sibText = (sibling.textContent ?? '').replace(/\s+/g, ' ').trim();
          // Stop jika menemukan paragraf teks yang cukup panjang (konten artikel)
          if (sibling.nodeType === 1 && sibText.length > 80 && !sibling.querySelector('img,iframe')) break;
          sibling.parentNode?.removeChild(sibling);
        }
        el.remove();
      }
    });

    // Post-pass: hapus Pinterest "Save" button yang inject ke DOM
    contentElement.querySelectorAll('[data-pin-do],[data-pin-href],[class*="pinterest"],[id*="pinterest"]').forEach(el => el.remove());
    // Hapus overlay Pinterest yang inject sebagai sibling dari img
    contentElement.querySelectorAll('a[href*="pinterest.com/pin"]').forEach(el => el.remove());

    // Post-pass: Yaraon — hapus semua elemen sebelum komentar pertama
    // Konten asli Yaraon adalah kumpulan komentar pembaca, dimulai dengan "1："atau "1:"
    // Semua yang sebelumnya (banner, judul duplikat, tanggal, metadata) harus dibuang
    if (pageUrl.hostname.includes('yaraon')) {
      const children = Array.from(contentElement.children);
      // Cari elemen pertama yang teksnya dimulai dengan "1：" atau "1:" (komentar pertama)
      let firstCommentIdx = -1;
      for (let i = 0; i < children.length; i++) {
        const t = (children[i].textContent ?? '').trim();
        if (/^1[：:]\s*\S/.test(t) || /^1[：:]\s*$/.test(t)) {
          firstCommentIdx = i;
          break;
        }
        // Juga deteksi jika <p> isinya dimulai angka+titik dua (format komentar Yaraon)
        if (children[i].tagName === 'P' || children[i].tagName === 'DIV') {
          const inner = children[i].querySelectorAll('p,span,b,strong');
          for (const sub of Array.from(inner)) {
            if (/^1[：:]\s*\S/.test((sub.textContent ?? '').trim())) {
              firstCommentIdx = i;
              break;
            }
          }
          if (firstCommentIdx >= 0) break;
        }
      }
      // Hapus semua elemen sebelum komentar pertama
      if (firstCommentIdx > 0) {
        children.slice(0, firstCommentIdx).forEach(el => el.remove());
      }
    }

    // Post-pass: Somoskudasai — potong dari bawah jika ada blok thumbnail artikel terkait
    // Somoskudasai menyusun artikel terkait di akhir konten sebagai grid gambar kecil
    // Deteksi: ≥3 <img> berurutan dalam satu container tanpa banyak teks
    if (pageUrl.hostname.includes('somoskudasai')) {
      const children = Array.from(contentElement.children);
      for (let i = children.length - 1; i >= Math.floor(children.length * 0.5); i--) {
        const el = children[i];
        const imgs = el.querySelectorAll('img');
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        // Block dengan banyak gambar tapi sedikit teks = artikel terkait grid
        if (imgs.length >= 2 && text.length < 100) {
          el.remove();
        }
      }
    }

    // Post-pass: potong semua konten setelah heading "Artikel Terkait" / "Related" / "Baca Juga"
    // Di WordPress/blog, artikel terkait hampir selalu di akhir konten setelah heading ini
    const RELATED_HEADING = /^(artikel\s*terkait|related\s*(post|artikel|article)?|baca\s*juga|lihat\s*juga|you\s*may\s*(also\s*)?(like|read)|more\s*(from|article)|関連記事|おすすめ記事|人気記事|こちらもどうぞ)$/i;
    const headings = Array.from(contentElement.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    for (const heading of headings) {
      const text = (heading.textContent ?? '').trim();
      if (RELATED_HEADING.test(text)) {
        // Hapus heading ini dan semua elemen setelahnya
        let next = heading.nextSibling;
        while (next) {
          const toRemove = next;
          next = next.nextSibling;
          toRemove.parentNode?.removeChild(toRemove);
        }
        heading.remove();
        break;
      }
    }

    // Post-pass: hapus elemen iklan inline (script, ins.adsbygoogle, div[id*=ad])
    contentElement.querySelectorAll('ins,script,[id*="ad-"],[id*="-ad"],[id*="ads"],[class*="adsbygoogle"],[class*="ad-slot"],[class*="advertisement"]').forEach(el => el.remove());

    const contentHtml = contentElement.innerHTML.trim();
    if (!contentHtml) return res.json({ success: false, error: 'No content after sanitization', items: [] });

    const plainText = (contentElement.textContent ?? '').replace(/\s+/g, ' ').trim();
    return res.json({
      success: true,
      items: [{ title: article.title ?? '', description: plainText.slice(0, 200), image: ogImage, summary: article.excerpt ?? plainText.slice(0, 200), contentHtml }],
    });

  } catch (error) {
    const msg = error.message ?? String(error);
    console.error(`[fetch-content ERROR] ${msg}`);
    return res.status(500).json({ success: false, error: msg, items: [] });
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
