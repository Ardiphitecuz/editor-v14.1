/**
 * newsroom-engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Port lengkap dari the-newsroom-rss (Deno/TypeScript) ke Node.js/Express.
 * 
 * Sumber asli: https://github.com/royalgarter/the-newsroom-rss
 * Fungsi utama yang diport:
 *   - parseRSS()        — fetch & parse RSS/Atom feed
 *   - processRssItem()  — normalisasi setiap item (image, link, ldjson, dst.)
 *   - fetchRSSLinks()   — orchestrator: fetch semua URL RSS secara paralel
 * 
 * Perbedaan dari original Deno:
 *   - Menggunakan rss-parser (npm) alih-alih deno.land/x/rss
 *   - Menggunakan axios alih-alih native fetch (untuk SSL fallback)
 *   - In-memory CACHE sama persis (Map + setTimeout TTL)
 *   - Semua logika Google News decode, image extraction, ldjson tetap sama
 */

import axios from 'axios';
import RSSParser from 'rss-parser';
import https from 'https';

// ── HTTPS Agent (bypass sertifikat lemah) ─────────────────────────────────────
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ── In-Memory Cache (identik dengan cache.ts asli) ───────────────────────────
const CACHE = {
  MAP: new Map(),
  TIMER: new Map(),

  get: (k) => CACHE.MAP.get(k),
  del: (k) => CACHE.MAP.delete(k),
  set: (k, v, e = 60 * 60 * 24 * 7) => {
    CACHE.MAP.set(k, v);
    const oldtime = CACHE.TIMER.get(k);
    if (oldtime) clearTimeout(oldtime);
    const newtime = setTimeout(() => CACHE.MAP.delete(k), e * 1e3);
    CACHE.TIMER.set(k, newtime);
  },
};

setInterval(() => console.log('[NewsroomEngine] CACHE.MAP.size:', CACHE.MAP.size), 10 * 60e3);

// ── RSS Parser instance ─────────────────────────────────────────────────────
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const rssParser = new RSSParser({
  customFields: {
    feed: ['image'],
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail'],
      ['media:group', 'media:group'],
      ['media:description', 'media:description'],
      ['media:community', 'media:community'],
      ['dc:subject', 'dc:subject'],
      ['dc:creator', 'dc:creator'],
    ],
  },
  timeout: 10000,
  headers: {
    'User-Agent': BROWSER_UA,
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Cache-Control': 'no-cache',
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeHost(urlStr) {
  try {
    if (!urlStr) return '';
    return new URL(urlStr).host;
  } catch { return ''; }
}

function titleCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function upperCase(str) {
  if (!str) return str;
  return str.toUpperCase();
}

// Hapus HTML tags dan decode entitas HTML untuk preview description
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')          // hapus semua HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&[a-zA-Z]+;/g, ' ')      // hapus entitas HTML yang tersisa
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 300);                     // batasi panjang description preview
}

// ── Fetch dengan fallback UA + SSL ────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
];

async function fetchUrl(url, options = {}) {
  const isHttps = url.startsWith('https://');
  const baseConfig = {
    timeout: options.timeout || 10000,
    responseType: options.responseType || 'text',
    maxRedirects: 5,
    ...(isHttps ? { httpsAgent } : {}),
  };

  const uaList = options.ua ? [options.ua] : USER_AGENTS;

  for (const ua of uaList) {
    try {
      return await axios.get(url, {
        ...baseConfig,
        headers: {
          'User-Agent': ua,
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      const status = err.response?.status;
      // Kalau 403/429, coba UA berikutnya. Kalau error lain, langsung throw
      if ((status === 403 || status === 429) && ua !== uaList[uaList.length - 1]) {
        continue;
      }
      throw err;
    }
  }
}

// ── parseRSS — fetch + parse satu RSS URL ─────────────────────────────────────
async function parseRSS(url, pioneer = false) {
  try {
    if (!url) return { rss_url: url };

    url = url.replace(/ /g, '+').replace(/^http:\/\//i, 'https://');
    if (!url.startsWith('http')) url = 'https://' + url;

    const key_rss = 'RSS:' + url;

    // Cegah duplicate console.time warning
    try { console.timeEnd('>> parseRSS.' + url); } catch {}
    console.time('>> parseRSS.' + url);

    let content = CACHE.get(key_rss);

    if (!content) {
      try {
        const response = await fetchUrl(url, {
          timeout: pioneer ? 5000 : 10000,  // max 10 detik per feed
          headers: {
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          },
        });
        content = response.data;
        if (content) {
          CACHE.set(key_rss, content, 60 * 15);
          markFeedSuccess(url);
        }
      } catch (ex) {
        console.log('>> parseRSS.catch ' + url + ': ' + ex.message);
        markFeedFailed(url);
        return { rss_url: url };
      }
    }

    console.timeEnd('>> parseRSS.' + url);

    if (!content) return { rss_url: url };

    // Parse RSS/Atom string
    const data = await rssParser.parseString(content);

    // Normalisasi ke format yang sama dengan Deno rss lib
    return {
      rss_url: url,
      title: { value: data.title || '' },
      description: data.description || data.title || '',
      links: data.link ? [data.link] : [],
      image: data.image ? { url: data.image.url || data.image } : null,
      entries: (data.items || []).map(item => normalizeItem(item)),
    };
  } catch (error) {
    console.error('parseRSS.error:', url, error?.message || error);
    return { rss_url: url };
  }
}

function normalizeItem(item) {
  const mediaContents = Array.isArray(item['media:content'])
    ? item['media:content']
    : item['media:content'] ? [item['media:content']] : [];

  const mediaThumb = item['media:thumbnail'];
  const mediaGroup = item['media:group'];

  // Attachments (enclosures)
  const attachments = (item.enclosure ? [item.enclosure] : []).map(e => ({
    url: e.url,
    mimeType: e.type || '',
  }));

  // Fix: ambil URL thumbnail dengan aman dari berbagai format
  function safeThumbUrl(t) {
    if (!t) return null;
    if (typeof t === 'string') return t;
    if (t.$?.url) return t.$.url;
    if (t.url) return t.url;
    return null;
  }

  const thumbUrl = safeThumbUrl(mediaThumb);

  return {
    title: { value: item.title || '' },
    links: item.link ? [{ href: item.link }] : [],
    link: item.link || '',
    // contentSnippet sudah di-strip HTML oleh parseXmlString
    description: { value: item.contentSnippet || item.summary || '' },
    content: { value: item['content:encoded'] || item.content || '' },
    published: item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate) : null,
    updated: item.isoDate ? new Date(item.isoDate) : null,
    author: item.author || item['dc:creator']
      ? { name: item.author || item['dc:creator'] }
      : null,
    categories: (item.categories || []).map(c => ({ label: c, term: c })),
    attachments,
    'media:content': mediaContents.map(m => ({
      url: m.$.url || m.url || '',
      medium: m.$.medium || m.medium || '',
    })),
    'media:thumbnail': thumbUrl ? { url: thumbUrl } : null,
    'media:group': mediaGroup || null,
    'media:description': { value: item['media:description'] || '' },
    'media:community': item['media:community'] || null,
    'dc:subject': item['dc:subject'] || null,
    source: item.source ? { url: item.source.url } : null,
  };
}

// ── processRssItem — port persis dari rss.ts asli ─────────────────────────────
async function processRssItem(item, head, pioneer) {
  try {
    if (item['media:group']) item = { ...item, ...item['media:group'] };

    let images = [];

    // Ambil gambar dari attachments
    if (item?.attachments?.length) {
      images.push(...item.attachments
        .filter(x => x.mimeType && x.mimeType.includes('image'))
        .map(x => x.url));
    }

    // Ambil dari media:content
    if (Array.isArray(item?.['media:content'])) {
      images.push(...item['media:content']
        .filter(x => x.medium === 'image')
        .map(x => x.url));
    }

    // media:thumbnail
    if (item['media:thumbnail']?.url) images.push(item['media:thumbnail'].url);

    // media:content url (jika single)
    if (item['media:content']?.url && !Array.isArray(item['media:content'])) {
      images.push(item['media:content'].url);
    }

    let link = item?.links?.[0]?.href || item?.link || '';
    if (!link) return null;

    let urlParams = null;
    try { urlParams = new URL(link).searchParams; } catch {}
    let url = urlParams?.get('url');

    // Decode Google News link
    if (link.includes('news.google.com/rss/articles/')) {
      const key_gnews = 'GOOGLE_NEWS:' + link;
      const gn_link = CACHE.get(key_gnews);

      if (gn_link) {
        link = gn_link;
        images = [];
      } else {
        try {
          const ggnews = await fetchUrl(
            `https://feed.newsrss.org/api/feeds/decode-ggnews`
            + `?url=${encodeURIComponent(link)}`
            + `&source=${encodeURIComponent(item?.source?.url || '')}`
            + `&title=${encodeURIComponent(item?.title?.value || '')}`,
            { timeout: pioneer ? 5000 : 10000 }
          ).then(r => r.data).catch(() => null);

          if (ggnews?.data?.originUrl) {
            link = ggnews.data.originUrl;
            images = [];
            CACHE.set(key_gnews, link);
          }
        } catch (ex) {}
      }
    }

    // Bing news: gunakan url param
    if (link.includes('bing.com/news') && url) {
      link = url;
      images = [];
    }

    images = images.filter(x => x);

    // Coba fetch og:image dari halaman jika belum ada gambar
    let ldjson = null;
    if (link) {
      try {
        const key_html = 'HTML:' + link;
        const key_image = 'HTML_IMAGE:' + link;
        const key_ldjson = 'HTML_LDJSON:' + link;

        let image_og = CACHE.get(key_image);
        ldjson = CACHE.get(key_ldjson);

        // Coba ambil ldjson dari RSS item langsung
        if (!ldjson) {
          const rss_ldjson = Object.entries(item).find(
            ([k]) => k.toLowerCase().includes('ld+json') || k.toLowerCase().includes('ldjson')
          )?.[1];
          if (rss_ldjson) {
            try {
              ldjson = typeof rss_ldjson === 'string' ? JSON.parse(rss_ldjson) : rss_ldjson;
            } catch {}
          }
        }

        if (!image_og || !ldjson) {
          let html = CACHE.get(key_html);

          // Fetch HTML untuk mendapatkan og:image per artikel (bukan hanya jika tidak ada gambar)
          if (!html) {
            html = await fetchUrl(link, {
              timeout: pioneer ? 2000 : 3000,  // timeout singkat, prioritas kecepatan
              headers: { 'Range': 'bytes=0-32768' },  // 32KB cukup untuk meta tags
            }).then(r => r.data).catch(() => null);
            if (html) CACHE.set(key_html, html);
          }

          if (html) {
            if (!image_og) {
              const REGEX_IMAGE = /<meta[^>]*property=["']\w+:image["'][^>]*content=["']([^"']{10,})["'][^>]*>/;
              image_og = html.match(REGEX_IMAGE)?.[1]
                ?? html.match(/<meta[^>]*content=["']([^"']{10,})["'][^>]*property=["']\w+:image["'][^>]*>/)?.[1]
                ?? html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']{10,})["'][^>]*>/)?.[1];
              if (image_og) CACHE.set(key_image, image_og);
            }

            if (!ldjson) {
              const REGEX_LDJSON = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
              const match = html.match(REGEX_LDJSON);
              if (match?.[1]) {
                try {
                  ldjson = JSON.parse(match[1].trim());
                  if (ldjson) CACHE.set(key_ldjson, ldjson);
                } catch {}
              }
            }
          }
        }

        // Prioritaskan og:image per artikel di atas gambar generik dari RSS feed
        if (image_og) {
          // Cek apakah images[0] sudah sama dengan og:image — hindari duplikasi
          if (images[0] !== image_og) {
            images.unshift(image_og);
          }
        }
      } catch (ex) { console.error(ex); }
    }

    // Fallback gambar: favicon domain atau gambar dari feed header
    if (images.length === 0) {
      const hostname = safeHost(link);
      if (hostname) images.push(`https://www.google.com/s2/favicons?domain=https://${hostname}&sz=256`);
      if (head.image) images.push(head.image);
    }

    const statistics = Object.entries(item?.['media:community']?.['media:statistics'] || {})
      .map(([k, v]) => `${titleCase(k)}: ${v}`).join(', ').trim();

    return {
      link,
      title: item?.title?.value,
      author: item?.author?.name || item?.['dc:subject'] ||
        safeHost(link).split('.').slice(-3).filter(x => !x.includes('www')).sort((a, b) => b.length - a.length)[0],
      description: stripHtml(item?.description?.value || item?.content?.value || item?.['media:description']?.value || ''),
      published: item?.published,
      updated: item?.updated,
      images: images.filter(x => x && typeof x === 'string'),
      categories: item?.categories?.map?.(x => x.label || x.term),
      link_author: item?.author?.url || item?.author?.uri,
      source: item?.source?.url,
      statistics,
      ldjson,
    };
  } catch (ex) {
    console.error(ex);
    return null;
  }
}

// ── fetchRSSLinks — port persis dari rss.ts asli ──────────────────────────────
export async function fetchRSSLinks({ urls, limit = 12, pioneer = false }) {
  if (!urls) return [];

  let feedUrls = [];
  if (Array.isArray(urls)) {
    feedUrls = urls.filter(({ url }) => url);
  } else if (typeof urls === 'string') {
    feedUrls = urls.split(',').map(url => ({ url: url.trim() })).filter(x => x.url);
  }

  const feeds = await Promise.allSettled(
    feedUrls.map(({ url, content }) => parseRSS(url, pioneer))
  );

  const parsedFeeds = feeds.map(p => p.value).filter(x => x);

  const LAST_MONTH = new Date(Date.now() - 31 * 24 * 60 * 60e3);

  const render = new Array(parsedFeeds.length).fill(null);

  await Promise.allSettled(parsedFeeds.map((data, order) => new Promise(resolveFeed => {
    (async () => {
      const items = data.entries?.slice(0, limit) || [];

      const head = {
        title: data.description || data.title?.value || data.rss_url,
        link: data.links?.[0] || data.rss_url,
        rss_url: data.rss_url,
        image: data.image?.url,
        order,
      };

      const hostname = safeHost(head.link);
      if (hostname) {
        head.title = upperCase(hostname.split('.').slice(-2, -1)[0]) + ' > ' + head.title;
      }

      head.short = (head.title || '').substr(0, 100).trim();

      const rss_items = await Promise.allSettled(
        items.map(item => processRssItem(item, head, pioneer))
      );

      const result = {
        ...head,
        items: (() => {
          const seenLinks = new Set();
          return rss_items
            .map(p => p.value)
            .filter(x => x)
            // Jangan buang item tanpa published — pakai tanggal sekarang sebagai fallback
            .map(x => x.published ? x : { ...x, published: new Date() })
            .filter(x => new Date(x.published) > LAST_MONTH)
            // Deduplikasi berdasarkan URL artikel
            .filter(x => {
              const key = x.link || x.title;
              if (seenLinks.has(key)) return false;
              seenLinks.add(key);
              return true;
            })
            // Sort hanya berdasarkan tanggal (terbaru dulu) — tidak acak berdasarkan image count
            .sort((a, b) => new Date(b.published) - new Date(a.published));
        })(),
      };

      render[order] = result;
    })().catch(console.error).finally(resolveFeed);
  })));

  return render.filter(x => x);
}

// ── handleFeeds — endpoint utama (port dari handlers.ts) ─────────────────────
// Cache feeds per kombinasi URL (15 menit)
const FEEDS_CACHE = new Map();

// Dead URL tracker — feed yang terus gagal di-skip selama 30 menit
const DEAD_URLS = new Map(); // url → { failCount, lastFail }
const DEAD_SKIP_MS = 30 * 60 * 1000;   // skip 30 menit setelah 2x gagal
const DEAD_MAX_FAIL = 2;

function markFeedFailed(url) {
  const entry = DEAD_URLS.get(url) || { failCount: 0, lastFail: 0 };
  entry.failCount++;
  entry.lastFail = Date.now();
  DEAD_URLS.set(url, entry);
}

function markFeedSuccess(url) {
  DEAD_URLS.delete(url);
}

function isFeedDead(url) {
  const entry = DEAD_URLS.get(url);
  if (!entry) return false;
  if (entry.failCount < DEAD_MAX_FAIL) return false;
  if (Date.now() - entry.lastFail > DEAD_SKIP_MS) {
    // Reset setelah masa skip habis — coba lagi
    DEAD_URLS.delete(url);
    return false;
  }
  return true;
}

export async function handleFeedsRequest(req, res) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let data = null;

    if (req.method === 'GET') {
      const urls = decodeURIComponent(req.query.u || '').split(',').filter(x => x);
      const limit = req.query.l;
      const pioneer = req.query.pioneer;
      const v = urls.map(url => ({ url }));
      data = { keys: v, batch: v, limit, pioneer };
    }

    if (req.method === 'POST') {
      data = req.body;
    }

    if (!data) return res.status(400).json({ error: 'No data' });

    let { keys, batch, limit = 12, pioneer = false } = data;

    if (!keys?.length) keys = batch || [];
    keys = (keys || []).filter(x => x?.url);

    if (!keys.length) return res.json({ feeds: [], error: 'No URLs provided' });

    limit = Math.min(Math.max(parseInt(limit) || 12, 6), 100);

    // Filter out dead URLs (gagal berulang), kirim sebagai error terpisah
    const deadUrls = keys.filter(k => isFeedDead(k.url));
    const liveKeys = keys.filter(k => !isFeedDead(k.url));

    if (deadUrls.length > 0) {
      console.log(`[handleFeeds] Skipping ${deadUrls.length} dead feed(s):`, deadUrls.map(k => k.url).join(', '));
    }

    // Cache key (hanya dari live keys)
    const cacheKey = liveKeys.map(x => x.url).join(':') + ':' + limit;
    const hit = FEEDS_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < 15 * 60 * 1000) {
      return res.json({ feeds: hit.feeds, cached: true });
    }

    console.log(`[handleFeeds] Fetching ${liveKeys.length} feeds (limit ${limit}, pioneer: ${pioneer})`);

    const feeds = await fetchRSSLinks({
      urls: liveKeys,
      limit,
      pioneer: pioneer === 'true' || pioneer === true,
    });

    if (feeds.length > 0) {
      FEEDS_CACHE.set(cacheKey, { feeds, ts: Date.now() });
    }

    return res.json({
      feeds,
      cached: false,
      deadUrls: deadUrls.map(k => k.url),
    });
  } catch (err) {
    console.error('[handleFeeds] Error:', err.message);
    return res.status(500).json({ error: err.message, feeds: [] });
  }
}

export default { fetchRSSLinks, handleFeedsRequest, CACHE };