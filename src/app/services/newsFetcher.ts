import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import { updateSourceMeta } from "./sourceManager";

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

const PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://thingproxy.freeboard.io/fetch/",
  "https://corsproxy.io/?url=",
];

function dec(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|blockquote|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function relTime(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  if (!ms || isNaN(ms)) return "Baru saja";
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), day = Math.floor(h / 24);
  if (m < 2) return "Baru saja";
  if (m < 60) return m + " menit lalu";
  if (h < 24) return h + " jam lalu";
  if (day < 7) return day + " hari lalu";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const FALLBACK: Record<string, string> = {
  "Hot Topic": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
  "Breaking":  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80",
  "Trending":  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",
  "Discuss":   "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
  "Review":    "https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=800&q=80",
  "default":   "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
};
function fallbackImg(cat: string): string { return FALLBACK[cat] ?? FALLBACK["default"]; }

function guessCategory(title: string, tags: string[] = []): string {
  const t = (title + " " + tags.join(" ")).toLowerCase();
  if (/速報|breaking|darurat|urgent/.test(t)) return "Breaking";
  if (/悲報|masalah|gagal|kontroversi|skandal/.test(t)) return "Discuss";
  if (/朗報|rilis|launch|sukses|resmi/.test(t)) return "Trending";
  if (/review|ulasan|resensi/.test(t)) return "Review";
  if (/opini|analisis|opinion/.test(t)) return "Analisis";
  if (/anime|アニメ|vtuber/.test(t)) return "Hot Topic";
  if (/game|ゲーム|manga/.test(t)) return "Trending";
  return "Hot Topic";
}

function goodImage(url?: string | null): boolean {
  if (!url || url.length < 10) return false;
  if (/google\.com\/logos|feedburner|pixel\.gif|1x1|blank\.|spacer\./i.test(url)) return false;
  return url.startsWith("http");
}

function extractFirstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']{10,})["']/i);
  return m && goodImage(m[1]) ? m[1] : null;
}

// ── Extract clean paragraphs from full article HTML ───────────────────────────
// This is used on the actual article page HTML — NOT RSS content
export function extractParagraphs(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove all noise
  [
    "header", "footer", "nav", "aside", "script", "style", "noscript",
    ".sidebar", ".widget", ".related", ".related-posts", ".navigation",
    ".nav", ".menu", ".share", ".social", ".tags", ".author", ".ad",
    "[class*='sidebar']", "[class*='widget']", "[class*='related']",
    "[class*='recommend']", "[class*='share']", "[class*='ad']",
    "[id*='sidebar']", "[id*='related']", "[id*='header']",
    "[id*='footer']", "[id*='nav']", "[id*='ad']",
  ].forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

  // Find article body
  const selectors = [
    ".entry-content", ".post-content", ".article-body", ".article-content",
    ".post-body", ".article-text", ".main-text", ".entry-body",
    "#article-body", "#post-body", "#the-content", ".matome-body",
    "article", "main",
  ];

  let bodyEl: Element | null = null;
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && (el.textContent?.trim().length ?? 0) > 80) {
      bodyEl = el;
      break;
    }
  }

  const source = bodyEl ?? doc.body;
  if (!source) return [];

  // Prefer <p> tags
  const pTags = Array.from(source.querySelectorAll("p, blockquote"))
    .map(p => p.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(t => t.length > 15);

  if (pTags.length >= 2) {
    const result: string[] = [];
    let buf = "";
    for (const p of pTags) {
      if ((buf + " " + p).length < 350) {
        buf += (buf ? " " : "") + p;
      } else {
        if (buf) result.push(buf);
        buf = p;
      }
    }
    if (buf) result.push(buf);
    return result.slice(0, 12);
  }

  // Fallback: plain text split
  const text = stripHtml(source.innerHTML);
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 15);
  const result: string[] = [];
  let buf = "";
  for (const line of lines) {
    if ((buf + " " + line).length < 350) {
      buf += (buf ? " " : "") + line;
    } else {
      if (buf) result.push(buf);
      buf = line;
    }
  }
  if (buf) result.push(buf);
  return result.slice(0, 12);
}

// ── Proxy fetch ───────────────────────────────────────────────────────────────

export async function fetchWithFallback(url: string, ms = 12000): Promise<string> {
  let last: Error = new Error("all proxies failed");

  // For Google News, try with proper headers first via a dedicated proxy approach
  const isGNews = url.includes("news.google.com");
  
  // Try server endpoint first
  const proxyList = isGNews
    ? [
        null, // placeholder for direct rss2json attempt below
        ...PROXIES,
      ]
    : [undefined, ...PROXIES]; // undefined = try server endpoint first

  for (const proxy of proxyList) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      
      let fetchUrl: string;
      if (proxy === undefined) {
        // Try server endpoint first (no CORS issues, same origin)
        fetchUrl = `/api/fetch-content?url=${encodeURIComponent(url)}`;
        const res = await fetch(fetchUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error("Server fetch failed");
        const json = await res.json();
        if (json.success && json.items?.[0]?.description) {
          return json.items[0].description; // Return as text content
        }
        throw new Error("No content from server");
      } else if (proxy === null) {
        // For Google News: try rss2json endpoint
        fetchUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=20`;
        const res = await fetch(fetchUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (json.status === "ok" && json.items?.length) {
          // Convert back to XML-like text for parseXml to handle
          const items = json.items.map((item: any) => `
            <item>
              <title><![CDATA[${item.title ?? ""}]]></title>
              <link>${item.link ?? ""}</link>
              <pubDate>${item.pubDate ?? ""}</pubDate>
              <description><![CDATA[${item.description ?? ""}]]></description>
              <source>${item.author ?? ""}</source>
            </item>
          `).join("");
          return `<?xml version="1.0"?><rss version="2.0"><channel><title>${json.feed?.title ?? "Google News"}</title>${items}</channel></rss>`;
        }
        throw new Error("rss2json returned no items");
      } else {
        fetchUrl = proxy + encodeURIComponent(url);
        const res = await fetch(fetchUrl, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        if (text.length < 100) throw new Error("too short");
        return text;
      }
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last;
}

// ── Fetch full article content from article URL ───────────────────────────────

// Phrases that indicate the page is a login wall, error page, or non-article
const BLOCKED_PAGE_PATTERNS = [
  /please\s+(enter|log\s*in|sign\s*in|reset)\s+your\s+(email|password|username)/i,
  /login\s+to\s+your\s+account/i,
  /you\s+(must|need\s+to)\s+(be\s+)?(logged\s+in|sign\s+in|login)/i,
  /access\s+denied|403\s+forbidden|page\s+not\s+found|404\s+not\s+found/i,
  /subscribe\s+to\s+(read|access|continue)/i,
];

function isBlockedPage(html: string, content: string[]): boolean {
  const bodyText = content.join(" ").slice(0, 500).toLowerCase();
  return BLOCKED_PAGE_PATTERNS.some(p => p.test(bodyText));
}

export async function fetchArticleContent(
  url: string
): Promise<{ content: string[]; image?: string; summary?: string } | null> {
  try {
    // Validate URL first
    if (!url || !/^https?:\/\//i.test(url)) return null;

    // Try server API first (more reliable)
    try {
      const serverRes = await fetch('http://localhost:3000/api/fetch-content?url=' + encodeURIComponent(url), {
        signal: AbortSignal.timeout(10000)
      });
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData.success && serverData.items?.[0]?.description) {
          const content = serverData.items[0].description
            .split(/\n\n+/)
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 15)
            .slice(0, 12);
          if (content.length > 0) {
            return {
              content,
              image: serverData.items[0].image,
              summary: content[0]
            };
          }
        }
      }
    } catch (e) {
      console.debug("Server fetch failed, trying proxy:", e);
    }

    const html = await fetchWithFallback(url, 12000);
    
    // Try to extract image with multiple methods
    let ogImg: RegExpExecArray | null = null;
    
    // Method 1: og:image meta tag
    ogImg = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)
      ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
    
    // Method 2: twitter:image meta tag
    if (!ogImg) {
      ogImg = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html)
        ?? /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i.exec(html);
    }
    
    // Method 3: Extract first img tag src
    let firstImg: string | null = null;
    if (!ogImg) {
      firstImg = extractFirstImage(html);
    }

    const content = extractParagraphs(html);
    if (content.length === 0) return null;

    // Reject login walls and error pages
    if (isBlockedPage(html, content)) return null;

    const summary = content.find(p => p.length > 40)?.slice(0, 200);
    const imageUrl = ogImg?.[1] || firstImg;
    
    return { 
      content, 
      image: imageUrl && goodImage(imageUrl) ? imageUrl : undefined, 
      summary 
    };
  } catch { return null; }
}

// ── RSS metadata-only parsing ─────────────────────────────────────────────────
// RSS is ONLY used for: title, date, image thumbnail, link
// content[] is always [] — will be fetched from originalUrl in background

interface R2JItem {
  title: string; link: string; pubDate: string;
  description: string; content: string; thumbnail: string;
  enclosure?: { link?: string }; categories?: string[];
}
interface R2JFeed { status: string; feed: { title: string }; items: R2JItem[]; }

async function fetchRss2Json(feedUrl: string, limit = 15): Promise<R2JFeed | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(RSS2JSON + encodeURIComponent(feedUrl), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json() as R2JFeed;
    return data.status === "ok" && data.items?.length ? data : null;
  } catch { return null; }
}

function articlesFromR2J(source: NewsSource, data: R2JFeed, limit: number): Article[] {
  return data.items.slice(0, limit).map((item, i) => {
    const title = dec(item.title ?? "Untitled");
    const cat = guessCategory(title, item.categories ?? []);
    const fullHtml = dec(item.content || item.description || "");

    // Extract text content from HTML for initial display
    let initialContent: string[] = [];
    if (fullHtml.length > 20) {
      const textParts = stripHtml(fullHtml)
        .split(/\n+/)
        .map(t => t.trim())
        .filter(t => t.length > 20);
      initialContent = textParts.slice(0, 3);
    }

    let image = "";
    if (goodImage(item.thumbnail)) image = item.thumbnail;
    else if (goodImage(item.enclosure?.link)) image = item.enclosure!.link!;
    else image = extractFirstImage(fullHtml) ?? fallbackImg(cat);

    return {
      id: source.id + "-r-" + i,
      category: cat, title,
      summary: initialContent[0] || title,
      content: initialContent.length > 0 ? initialContent : [],
      source: source.name, image,
      readTime: Math.max(1, Math.ceil((initialContent.join(" ").split(/\s+/).length || 50) / 200)),
      publishedAt: relTime(item.pubDate),
      hot: i < 2,
      originalUrl: item.link || undefined,
    } as Article & { originalUrl?: string };
  });
}

function parseXml(source: NewsSource, rawText: string, limit: number): Article[] {
  const clean = rawText.replace(/^\uFEFF/, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  let xml = new DOMParser().parseFromString(clean, "text/xml");
  if (xml.querySelector("parsererror")) {
    xml = new DOMParser().parseFromString(clean, "text/html");
  }
  const isGNews = (source.feedUrl ?? "").includes("news.google.com");
  const items = Array.from(xml.querySelectorAll("item, entry")).slice(0, limit);
  if (!items.length) throw new Error("No items in feed");

  return items.map((item, i) => {
    const rawTitle = item.querySelector("title")?.textContent ?? "Untitled";
    const title = dec(rawTitle.replace(/<!--\[CDATA\[|]]-->/g, "").trim());
    const pubDate = item.querySelector("pubDate, published, updated")?.textContent ?? "";
    const link = item.querySelector("link")?.textContent?.trim()
      || item.querySelector("link")?.getAttribute("href") || "";
    
    // Extract content with proper namespace and fallbacks
    const contentEncoded = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]?.textContent
      || item.getElementsByTagName("content:encoded")[0]?.textContent
      || item.querySelector("description, summary")?.textContent 
      || "";
    const fullHtml = dec(contentEncoded.replace(/<!--\[CDATA\[|]]-->/g, ""));

    // Extract text from HTML content for initial display
    let initialContent: string[] = [];
    if (fullHtml.length > 20) {
      const textParts = stripHtml(fullHtml)
        .split(/\n+/)
        .map(t => t.trim())
        .filter(t => t.length > 20);
      initialContent = textParts.slice(0, 3); // First 3 paragraphs
    }

    const tags = Array.from(item.querySelectorAll("category")).map(c => c.textContent?.trim() ?? "");
    const cat = guessCategory(title, tags);
    const image = extractFirstImage(fullHtml) ?? fallbackImg(cat);

    let srcName = source.name;
    if (isGNews) {
      const gs = item.querySelector("source")?.textContent?.trim();
      if (gs) srcName = gs;
    }

    return {
      id: source.id + "-x-" + i,
      category: cat, title,
      summary: initialContent[0] || title,
      content: [],  // Empty to trigger background fetch of full content
      source: srcName, image,
      readTime: Math.max(1, Math.ceil((initialContent.join(" ").split(/\s+/).length || 50) / 200)),
      publishedAt: relTime(pubDate),
      hot: i < 2,
      originalUrl: link || undefined,
    } as Article & { originalUrl?: string };
  });
}

async function fetchFromRSS(source: NewsSource, limit = 15): Promise<Article[]> {
  const feedUrl = source.feedUrl ?? source.url;
  const isGNews = feedUrl.includes("news.google.com");
  
  if (!isGNews) {
    // Try rss2json first for non-Google News
    const j = await fetchRss2Json(feedUrl, limit);
    if (j) return articlesFromR2J(source, j, limit);
  }
  
  // For Google News or rss2json failure: use fetchWithFallback (which tries rss2json via proxy for GNews)
  const raw = await fetchWithFallback(feedUrl);
  return parseXml(source, raw, limit);
}

async function fetchFromWebsite(source: NewsSource, limit = 15): Promise<Article[]> {
  // Ensure URL has protocol
  const rawUrl = /^https?:\/\//i.test(source.url) ? source.url : "https://" + source.url;
  let parsedUrl: URL;
  try { parsedUrl = new URL(rawUrl); } catch { throw new Error("Invalid URL: " + source.url); }

  const html = await fetchWithFallback(rawUrl);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = parsedUrl.origin;
  const siteImg = doc.querySelector("meta[property='og:image']")?.getAttribute("content") ?? null;
  const seen = new Set<string>();
  const links = Array.from(doc.querySelectorAll("a[href]"))
    .filter(a => {
      const text = a.textContent?.trim() ?? "";
      const href = (a as HTMLAnchorElement).href;
      const ok = href.includes(parsedUrl.hostname)
        && !href.includes("#") && !href.match(/\?(tag|cat|page|s)=/)
        && text.length > 25;
      if (!ok || seen.has(href)) return false;
      seen.add(href); return true;
    }).slice(0, limit);

  return links.map((a, i) => {
    const title = a.textContent?.trim() ?? "Untitled";
    const href = (a as HTMLAnchorElement).href;
    const cat = guessCategory(title, []);
    const near = a.closest("article,.post,.entry,.card,li,div")?.querySelector("img")?.getAttribute("src");
    let image = near ?? siteImg ?? fallbackImg(cat);
    if (image && !image.startsWith("http")) image = base + (image.startsWith("/") ? "" : "/") + image;
    return {
      id: source.id + "-w-" + i, category: cat, title, summary: title,
      content: [], source: source.name, image,
      readTime: 3, publishedAt: "Baru saja", hot: i < 2,
      originalUrl: href || undefined,
    } as Article & { originalUrl?: string };
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FetchAllResult {
  articles: Article[];
  errors: Record<string, string>;
  fromCache: boolean;
}

export async function fetchAllSources(
  sources: NewsSource[],
  onProgress?: (msg: string, done: number, total: number) => void,
): Promise<FetchAllResult> {
  const enabled = sources.filter(s => s.enabled);
  const errors: Record<string, string> = {};
  const all: Article[] = [];

  await Promise.allSettled(enabled.map(async (source, idx) => {
    onProgress?.("Mengambil " + source.name + "...", idx, enabled.length);
    try {
      const arts = source.type === "rss"
        ? await fetchFromRSS(source, 15)
        : await fetchFromWebsite(source, 15);
      all.push(...arts);
      updateSourceMeta(source.id, {
        lastFetched: new Date().toISOString(),
        articleCount: arts.length,
        error: undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors[source.id] = msg;
      updateSourceMeta(source.id, { error: msg });
    }
  }));

  onProgress?.("Selesai", enabled.length, enabled.length);
  return { articles: all, errors, fromCache: false };
}

const cache = new Map<string, { articles: Article[]; ts: number }>();
const TTL = 15 * 60 * 1000;

export async function fetchAllSourcesCached(
  sources: NewsSource[],
  forceRefresh = false,
  onProgress?: (msg: string, done: number, total: number) => void,
): Promise<FetchAllResult> {
  const key = sources.filter(s => s.enabled).map(s => s.id).join(",");
  if (!forceRefresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return { articles: hit.articles, errors: {}, fromCache: true };
  }
  const result = await fetchAllSources(sources, onProgress);
  if (result.articles.length > 0) cache.set(key, { articles: result.articles, ts: Date.now() });
  return result;
}

export function clearAllSourceCache() { cache.clear(); }