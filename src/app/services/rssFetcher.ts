/**
 * rssFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mengambil artikel dari sumber bertipe RSS/Atom.
 * Entry point: fetchFromRSS(source, limit)
 *
 * Pipeline:
 *   1. rss2json API (paling lengkap — thumbnail, content, metadata)
 *   2. /api/rss server proxy → parse XML manual
 *   3. Public CORS proxies → parse XML manual
 */

import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import {
  RSS2JSON, SERVER_RSS_PROXY, PUBLIC_PROXIES,
  TRACKING_IMG_URL,
  hashId, decodeHtmlEntities, relTime, rawPubTimestamp, guessCategory,
  fallbackImg, sanitizeHtml, scoreContent, extractPlainParagraphs,
  extractFirstImageUrl, SUFFICIENT_THRESHOLD,
} from "./fetcherUtils";

// ── buildFromRssContent ───────────────────────────────────────────────────────
function buildFromRssContent(
  rawHtml: string,
  baseUrl: string,
  forceSufficient?: boolean,
  fallbackTitle?: string
): { contentHtml: string; content: string[]; heroImage: string | null; sufficient: boolean } {
  // Jangan decode entity sebelum sanitasi — sanitizeHtml pakai doc.body.innerHTML
  // yang decode otomatis; decode manual dulu akan men-strip semua tag HTML
  const stripped = (rawHtml ?? "")
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/gi, "");

  const heroImage = extractFirstImageUrl(stripped);
  const cleanHtml = sanitizeHtml(stripped, baseUrl);
  const finalHtml = cleanHtml || (fallbackTitle ? `<p>${fallbackTitle}</p>` : "");
  const content = extractPlainParagraphs(finalHtml);
  const score = scoreContent(finalHtml);
  const sufficient = forceSufficient ?? (score >= SUFFICIENT_THRESHOLD);

  return { contentHtml: finalHtml, content, heroImage, sufficient };
}

// ── rss2json ──────────────────────────────────────────────────────────────────
async function fetchRss2Json(feedUrl: string): Promise<any> {
  try {
    // &_t= untuk bust rss2json server-side cache (cache 1 jam di sisi mereka)
    const cacheBust = Math.floor(Date.now() / (60 * 60 * 1000)); // berubah tiap 1 jam
    const res = await fetch(`${RSS2JSON}${encodeURIComponent(feedUrl)}&count=20&_t=${cacheBust}`, {
      signal: AbortSignal.timeout(30000), // timeout diperpanjang jadi 30 detik
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === "ok" && data.items?.length ? data : null;
  } catch { return null; }
}

function articlesFromR2J(source: NewsSource, data: any, limit: number): Article[] {
  const upgrade = (u: string) =>
    u?.startsWith("http://") ? u.replace("http://", "https://") : u;

  return data.items.slice(0, limit).map((item: any, i: number) => {
    const title = decodeHtmlEntities(item.title ?? "Untitled");
    const cat = guessCategory(title, item.categories ?? []);
    const baseUrl = item.link || source.url;

    // Selalu pilih konten TERPANJANG:
    // rss2json memetakan content:encoded → item.content, description → item.description
    // Jika content lebih pendek dari description, berarti feed hanya punya summary di content:encoded
    // → pakai yang lebih panjang karena lebih lengkap
    const candidates = [item.content, item.description].filter(Boolean);
    const rawContent = candidates.reduce(
      (best: string, cur: string) => (cur?.length ?? 0) > (best?.length ?? 0) ? cur : best,
      ""
    );

    const parsed = buildFromRssContent(
      rawContent, baseUrl,
      source.rssContentSufficient === true || undefined,
      title
    );

    const enclosureImg = Array.isArray(item.enclosures)
      ? item.enclosures.find((e: any) => e.type?.startsWith("image") && e.link)?.link
      : null;

    const heroImage =
      (item.thumbnail && !TRACKING_IMG_URL.test(item.thumbnail) && item.thumbnail.startsWith("http"))
        ? upgrade(item.thumbnail)
        : (enclosureImg && !TRACKING_IMG_URL.test(enclosureImg))
        ? upgrade(enclosureImg)
        : (parsed.heroImage && !TRACKING_IMG_URL.test(parsed.heroImage))
        ? upgrade(parsed.heroImage)
        : fallbackImg(cat);

    return {
      id: hashId(item.link || title),
      category: cat,
      title,
      summary: parsed.content[0] || title,
      content: [], // Kosongkan agar tidak render paragraf saja
      source: source.name,
      sourceId: source.id,
      rssContentSufficient: parsed.sufficient,
      image: heroImage,
      contentHtml: parsed.contentHtml || undefined, // HTML hasil sanitasi
      readTime: Math.max(1, Math.ceil(scoreContent(parsed.contentHtml) / 1000)),
      publishedAt: relTime(item.pubDate),
      pubTimestamp: rawPubTimestamp(item.pubDate),
      hot: i < 2,
      originalUrl: item.link || undefined,
    } as any;
  });
}

// ── XML parser ────────────────────────────────────────────────────────────────
function parseXmlFeed(source: NewsSource, rawText: string, limit: number): Article[] {
  const clean = rawText
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  let xml = new DOMParser().parseFromString(clean, "text/xml");
  if (xml.querySelector("parsererror")) {
    xml = new DOMParser().parseFromString(clean, "text/html");
  }

  const items = Array.from(xml.querySelectorAll("item, entry")).slice(0, limit);
  if (!items.length) throw new Error("No items in feed");

  const upgrade = (u: string) =>
    u?.startsWith("http://") ? u.replace("http://", "https://") : u;

  return items.map((item, i) => {
    const rawTitle = item.querySelector("title")?.textContent ?? "Untitled";
    const title = decodeHtmlEntities(
      rawTitle.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "").trim()
    );

    const pubDate = item.querySelector("pubDate, published, updated")?.textContent ?? "";

    // Ambil link artikel — WordPress RSS kadang punya <link> kosong (atom:link self-closing)
    // Fallback chain: link text → link href → guid (isPermaLink) → guid text
    const linkEl = Array.from(item.querySelectorAll("link")).find(el =>
      (el.textContent?.trim().startsWith("http")) || (el.getAttribute("href")?.startsWith("http"))
    );
    const guidEl = item.querySelector("guid");
    const guidIsPermalink = guidEl?.getAttribute("isPermaLink") !== "false";
    const guidUrl = guidIsPermalink ? (guidEl?.textContent?.trim() ?? "") : "";
    const link =
      linkEl?.textContent?.trim() ||
      linkEl?.getAttribute("href") ||
      guidUrl ||
      "";

    // Prioritas: content:encoded (konten HTML penuh) > description > summary > content
    // Pilih yang TERPANJANG agar tidak salah ambil summary ketika keduanya tersedia
    const contentEncoded =
      item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]?.textContent ||
      item.getElementsByTagName("content:encoded")[0]?.textContent ||
      "";
    const descriptionText =
      item.querySelector("description, summary, content")?.textContent || "";
    // Pakai content:encoded jika tersedia dan lebih panjang, selain itu pakai description
    const rawContent = (contentEncoded.length >= descriptionText.length)
      ? (contentEncoded || descriptionText)
      : (descriptionText || contentEncoded);

    const baseUrl = link || source.url;
    const tags = Array.from(item.querySelectorAll("category")).map(c => c.textContent?.trim() ?? "");
    const cat = guessCategory(title, tags);

    const parsed = buildFromRssContent(
      rawContent, baseUrl,
      source.rssContentSufficient === true || undefined,
      title
    );

    // Nama sumber dari Google News <source> tag
    let srcName = source.name;
    if ((source.feedUrl ?? "").includes("news.google.com")) {
      const gs = item.querySelector("source")?.textContent?.trim();
      if (gs) srcName = gs;
    }

    // Thumbnail: media:thumbnail > media:content > enclosure > dari konten
    const mediaNs = "http://search.yahoo.com/mrss/";
    const mediaThumbUrl = (() => {
      const mt = item.getElementsByTagNameNS(mediaNs, "thumbnail")[0]?.getAttribute("url");
      if (mt) return mt;
      const mc = item.getElementsByTagNameNS(mediaNs, "content")[0]?.getAttribute("url");
      if (mc) return mc;
      const encImg = item.querySelector("enclosure[type^='image']")?.getAttribute("url");
      if (encImg) return encImg;
      return "";
    })();

    const rawThumb = mediaThumbUrl ? upgrade(mediaThumbUrl) : "";
    const heroImage =
      (rawThumb && !TRACKING_IMG_URL.test(rawThumb) && rawThumb.startsWith("http"))
        ? rawThumb
        : (parsed.heroImage && !TRACKING_IMG_URL.test(parsed.heroImage))
        ? upgrade(parsed.heroImage)
        : fallbackImg(cat);

    return {
      id: hashId(link || title),
      category: cat,
      title,
      summary: parsed.content[0] || title,
      content: [], // Kosongkan agar tidak render paragraf saja
      source: srcName,
      sourceId: source.id,
      rssContentSufficient: parsed.sufficient,
      image: heroImage,
      contentHtml: parsed.contentHtml || undefined, // HTML hasil sanitasi
      readTime: Math.max(1, Math.ceil(scoreContent(parsed.contentHtml) / 1000)),
      publishedAt: relTime(pubDate),
      pubTimestamp: rawPubTimestamp(pubDate),
      hot: i < 2,
      originalUrl: link || undefined,
    } as any;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function fetchFromRSS(source: NewsSource, limit = 15): Promise<Article[]> {
  const feedUrl = source.feedUrl ?? source.url;

  // ① rss2json — paling lengkap, skip untuk Google News
  if (!feedUrl.includes("news.google.com")) {
    const j = await fetchRss2Json(feedUrl);
    if (j) {
      const articles = articlesFromR2J(source, j, limit);
      // Validasi: jika semua artikel punya judul identik, rss2json salah baca feed
      // (sering terjadi pada WordPress feed dengan CDATA title) → fallback ke XML parser
      const titles = articles.map(a => a.title);
      const links = articles.map(a => (a as any).originalUrl ?? "");
      // Validasi kualitas data rss2json:
      // 1. Semua judul identik → rss2json salah baca CDATA title
      // 2. Semua link identik (dan ada isinya) → rss2json salah baca link
      // 3. Mayoritas link kosong → rss2json tidak dapat link sama sekali
      const allTitleSame = titles.length > 1 && titles.every(t => t === titles[0]);
      const filledLinks = links.filter(l => l && l.startsWith("http"));
      const allLinkSame = filledLinks.length > 1 && filledLinks.every(l => l === filledLinks[0]);
      const mostLinkEmpty = filledLinks.length < articles.length * 0.5;
      if (!allTitleSame && !allLinkSame && !mostLinkEmpty) return articles;
      // rss2json data invalid → fallback ke XML parser
    }
  }

  // ② Server proxy /api/rss
  try {
    const res = await fetch(SERVER_RSS_PROXY + encodeURIComponent(feedUrl), {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 200) return parseXmlFeed(source, text, limit);
    }
  } catch { /* lanjut */ }

  // ③ Public CORS proxies
  for (const proxy of PUBLIC_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(feedUrl), {
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.length > 200) return parseXmlFeed(source, text, limit);
    } catch { /* coba berikutnya */ }
  }

  return [];
}