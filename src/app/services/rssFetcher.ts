/**
 * rssFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-Side Racing Proxy Engine untuk mengambil & parsing RSS/Atom.
 * Entry point: fetchFromRSS(source, limit)
 *
 * Pipeline:
 *   1. Race semua PROXY_SERVERS bersamaan (Promise.any)
 *   2. Pemenang parsing dengan DOMParser
 *   3. Anti-Duplikasi berdasarkan URL akurat
 *   4. Ekstraksi gambar cerdas (src/data-src/data-lazy-src)
 */

import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import {
  PROXY_SERVERS,
  TRACKING_IMG_URL,
  hashId, decodeHtmlEntities, relTime, rawPubTimestamp, guessCategory,
  fallbackImg, sanitizeHtml, scoreContent, extractPlainParagraphs,
  extractFirstImageUrl, SUFFICIENT_THRESHOLD,
} from "./fetcherUtils";

// ── Polyfill Promise.any ───────────────────────────────────────────────────────
function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (promises.length === 0) return reject(new Error("No promises"));
    let errors = 0;
    promises.forEach(p =>
      Promise.resolve(p).then(resolve).catch(() => {
        errors++;
        if (errors === promises.length) reject(new Error("All promises failed"));
      })
    );
  });
}

// ── Cara akurat ambil link (Atom/RSS/Google News) ───────────────────────────
function getAccurateLink(itemNode: Element): string {
  let link = "";
  const linkNodes = itemNode.querySelectorAll("link");
  for (const node of Array.from(linkNodes)) {
    if (node.getAttribute("rel") === "replies") continue;
    const href = node.getAttribute("href");
    if (href && href.startsWith("http")) { link = href; break; }
    const txt = node.textContent?.trim();
    if (txt?.startsWith("http")) { link = txt; break; }
  }
  if (!link) {
    const guid = itemNode.querySelector("guid");
    if (guid?.getAttribute("isPermaLink") !== "false") {
      const g = guid?.textContent?.trim();
      if (g?.startsWith("http")) link = g;
    }
  }
  return link || "#";
}

// ── Ekstraksi gambar cerdas (lazy-load-aware) ───────────────────────────────
function extractSmartImage(node: Element, fallbackCat: string): string {
  const mediaNs = "http://search.yahoo.com/mrss/";
  const upgrade = (u: string) => u?.startsWith("http://") ? u.replace("http://", "https://") : u;

  // 1. media:thumbnail / media:content / enclosure — standard RSS media
  const mt = node.getElementsByTagNameNS(mediaNs, "thumbnail")[0]?.getAttribute("url");
  if (mt && !TRACKING_IMG_URL.test(mt) && !mt.includes("avatar") && !mt.includes("pixel")) return upgrade(mt);

  const mc = node.getElementsByTagNameNS(mediaNs, "content")[0]?.getAttribute("url");
  if (mc && /\.(jpe?g|png|webp|gif)/i.test(mc) && !mc.includes("avatar") && !mc.includes("pixel")) return upgrade(mc);

  const enc = node.querySelector("enclosure[type^='image']")?.getAttribute("url");
  if (enc && !TRACKING_IMG_URL.test(enc)) return upgrade(enc);

  // 2. Regex pada outerHTML / innerHTML — tangkap lazy-load src/data-src/data-lazy-src
  const htmlBody = node.innerHTML || node.textContent || "";
  const regexImg = /(?:src|data-src|data-lazy-src)=["'](https?:\/\/[^"'\s>]+(?:\.jpe?g|\.png|\.webp|\.gif)[^"'\s>]*)["']/i;
  const m = htmlBody.match(regexImg);
  if (m && m[1] && !TRACKING_IMG_URL.test(m[1]) && !m[1].includes("avatar") && !m[1].includes("pixel")) {
    return upgrade(m[1]);
  }

  // 3. extractFirstImageUrl dari <description>/<content:encoded>
  const raw = node.querySelector("description, summary, content")?.textContent || "";
  if (raw) {
    const fi = extractFirstImageUrl(raw);
    if (fi && !TRACKING_IMG_URL.test(fi)) return upgrade(fi);
  }

  return fallbackImg(fallbackCat);
}

// ── buildFromRssContent ───────────────────────────────────────────────────────
function buildFromRssContent(
  rawHtml: string,
  baseUrl: string,
  forceSufficient?: boolean,
  fallbackTitle?: string
): { contentHtml: string; content: string[]; heroImage: string | null; sufficient: boolean } {
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

// ── parseXmlFeed (Anti-Duplikat URL) ────────────────────────────────────────
function parseXmlFeed(source: NewsSource, rawText: string, limit: number): Article[] {
  const clean = rawText
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  let xml = new DOMParser().parseFromString(clean, "text/xml");
  if (xml.querySelector("parsererror")) {
    xml = new DOMParser().parseFromString(clean, "text/html");
  }

  const allItems = Array.from(xml.querySelectorAll("item, entry"));
  if (!allItems.length) throw new Error("No items in feed");

  const upgrade = (u: string) => u?.startsWith("http://") ? u.replace("http://", "https://") : u;

  // Anti-Duplikasi berdasarkan URL akurat
  const uniqueUrls = new Set<string>();
  const deduped: Element[] = [];
  for (const item of allItems) {
    const lnk = getAccurateLink(item);
    if (lnk !== "#" && uniqueUrls.has(lnk)) continue;
    if (lnk !== "#") uniqueUrls.add(lnk);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped.map((item, i) => {
    // Title
    const rawTitleDom = item.querySelector("title")?.textContent ?? "";
    const title = decodeHtmlEntities(
      rawTitleDom.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "").trim()
    ) || "Untitled";

    // Date & author
    const pubDate = item.querySelector("pubDate, published, updated")?.textContent ?? "";
    const dcNs = "http://purl.org/dc/elements/1.1/";
    const author =
      item.getElementsByTagNameNS(dcNs, "creator")[0]?.textContent?.trim() ||
      item.querySelector("author name, author, creator")?.textContent?.trim() ||
      undefined;

    // Link (akurat)
    const link = upgrade(getAccurateLink(item));

    // Content — pilih yang terpanjang
    const contentEncoded =
      item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]?.textContent ||
      item.getElementsByTagName("content:encoded")[0]?.textContent ||
      "";
    const descriptionText = item.querySelector("description, summary, content")?.textContent || "";
    const rawContentRaw = contentEncoded.length >= descriptionText.length
      ? (contentEncoded || descriptionText)
      : (descriptionText || contentEncoded);
    const rawContent = decodeHtmlEntities(rawContentRaw);

    const baseUrl = link && link !== "#" ? link : source.url;
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

    // Gambar cerdas (lazy-load-aware)
    const heroImage = extractSmartImage(item, cat);

    return {
      id: hashId((link !== "#" ? link : pubDate || String(i)) + source.id + title.slice(0, 30)),
      category: cat,
      title,
      summary: parsed.content[0] || title,
      content: [],
      source: srcName,
      sourceId: source.id,
      author,
      rssContentSufficient: parsed.sufficient,
      image: heroImage,
      contentHtml: parsed.contentHtml || undefined,
      readTime: Math.max(1, Math.ceil(scoreContent(parsed.contentHtml) / 1000)),
      publishedAt: relTime(pubDate),
      pubTimestamp: rawPubTimestamp(pubDate),
      hot: i < 2,
      originalUrl: link !== "#" ? link : undefined,
    } as any;
  });
}

// ── Public API — Racing Proxy Engine ────────────────────────────────────────
export async function fetchFromRSS(source: NewsSource, limit = 15): Promise<Article[]> {
  const feedUrl = source.feedUrl ?? source.url;

  const promises = PROXY_SERVERS.map(async (proxy) => {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(proxy.getUrl(feedUrl), { signal: controller.signal });
      clearTimeout(timerId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await proxy.parse(res);
      if (text && (text.includes("<rss") || text.includes("<feed") || text.includes("<?xml")) && text.length > 200) {
        return parseXmlFeed(source, text, limit);
      }
      throw new Error("Not a valid feed");
    } catch (err) {
      clearTimeout(timerId);
      throw err;
    }
  });

  try {
    return await promiseAny(promises);
  } catch {
    console.warn(`[RSS] Semua proxy gagal untuk: ${feedUrl}`);
    return [];
  }
}