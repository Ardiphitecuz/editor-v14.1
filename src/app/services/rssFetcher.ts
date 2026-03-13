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
  PUBLIC_PROXIES, PROXY_SERVERS, fetchWithTimeout,
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
    const rawTitleDom = item.querySelector("title")?.textContent ?? "";
    const title = decodeHtmlEntities(
      rawTitleDom.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "").trim()
    ) || "Untitled";

    const pubDate = item.querySelector("pubDate, published, updated")?.textContent ?? "";
    const dcNs = "http://purl.org/dc/elements/1.1/";
    const author = item.getElementsByTagNameNS(dcNs, "creator")[0]?.textContent?.trim() || 
                   item.querySelector("author, creator")?.textContent?.trim() || 
                   undefined;

    const domLinkEl = Array.from(item.querySelectorAll("link")).find(el =>
      (el.textContent?.trim().startsWith("http")) || (el.getAttribute("href")?.startsWith("http"))
    );
    const domGuidEl = item.querySelector("guid");
    const domGuidUrl = domGuidEl?.getAttribute("isPermaLink") !== "false"
      ? (domGuidEl?.textContent?.trim() ?? "") : "";

    const link = upgrade(
      domLinkEl?.textContent?.trim() ||
      domLinkEl?.getAttribute("href") ||
      domGuidUrl ||
      ""
    );

    // Prioritas: content:encoded (konten HTML penuh) > description > summary > content
    // Pilih yang TERPANJANG agar tidak salah ambil summary ketika keduanya tersedia
    const contentEncoded =
      item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]?.textContent ||
      item.getElementsByTagName("content:encoded")[0]?.textContent ||
      "";
    const descriptionText =
      item.querySelector("description, summary, content")?.textContent || "";
    // Pakai content:encoded jika tersedia dan lebih panjang, selain itu pakai description
    // decodeHtmlEntities diperlukan karena textContent dari DOMParser XML mode
    // tidak decode HTML entities seperti &aacute; → á
    const rawContentRaw = (contentEncoded.length >= descriptionText.length)
      ? (contentEncoded || descriptionText)
      : (descriptionText || contentEncoded);
    const rawContent = decodeHtmlEntities(rawContentRaw);

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
      id: hashId((link || pubDate || String(i)) + source.id + title.slice(0, 30)),
      category: cat,
      title,
      summary: parsed.content[0] || title,
      content: [], // Kosongkan agar tidak render paragraf saja
      source: srcName,
      sourceId: source.id,
      author,
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

function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let errors = 0;
    if (promises.length === 0) return reject(new Error("No promises"));
    promises.forEach(p => Promise.resolve(p).then(resolve).catch(() => {
      errors++;
      if (errors === promises.length) reject(new Error("All promises were rejected"));
    }));
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function fetchFromRSS(source: NewsSource, limit = 15): Promise<Article[]> {
  const feedUrl = source.feedUrl ?? source.url;

  const promises = PROXY_SERVERS.map(async (proxy) => {
    const res = await fetchWithTimeout(proxy.getUrl(feedUrl), {}, 12000);
    if (!res.ok) throw new Error("Gagal fetch");
    const text = await proxy.parse(res);
    if (text && text.length > 200) {
      return parseXmlFeed(source, text, limit);
    }
    throw new Error("Response is empty");
  });

  try {
    return await promiseAny(promises);
  } catch (error) {
    console.warn(`Semua proxy gagal untuk feed: ${feedUrl}`);
    return [];
  }
}