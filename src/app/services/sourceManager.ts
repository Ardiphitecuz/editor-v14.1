export type SourceType = "rss" | "website";

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  feedUrl?: string;
  type: SourceType;
  language: string;
  enabled: boolean;
  addedAt: string;
  lastFetched?: string;
  articleCount?: number;
  error?: string;
}

const STORAGE_KEY = "discuss_news_sources";

const DEFAULT_SOURCES: NewsSource[] = [
  {
    id: "yaraon",
    name: "やらおん！",
    url: "http://yaraon-blog.com/",
    feedUrl: "http://yaraon-blog.com/feed",
    type: "rss",
    language: "ja",
    enabled: true,
    addedAt: new Date().toISOString(),
  },
];

export function getSources(): NewsSource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { saveSources(DEFAULT_SOURCES); return DEFAULT_SOURCES; }
    const parsed = JSON.parse(raw) as NewsSource[];
    const hasYaraon = parsed.some((s) => s.id === "yaraon");
    if (!hasYaraon) {
      const merged = [DEFAULT_SOURCES[0], ...parsed];
      saveSources(merged);
      return merged;
    }
    return parsed;
  } catch { return DEFAULT_SOURCES; }
}

export function saveSources(sources: NewsSource[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sources)); } catch { /* ignore */ }
}

export function addSource(source: Omit<NewsSource, "id" | "addedAt">): NewsSource {
  const newSource: NewsSource = { ...source, id: "src_" + Date.now(), addedAt: new Date().toISOString() };
  saveSources([...getSources(), newSource]);
  return newSource;
}

export function removeSource(id: string): void {
  if (id === "yaraon") return;
  saveSources(getSources().filter((s) => s.id !== id));
}

export function toggleSource(id: string, enabled: boolean): void {
  saveSources(getSources().map((s) => (s.id === id ? { ...s, enabled } : s)));
}

export function updateSourceMeta(
  id: string,
  meta: Partial<Pick<NewsSource, "lastFetched" | "articleCount" | "error">>
): void {
  saveSources(getSources().map((s) => (s.id === id ? { ...s, ...meta } : s)));
}

// ── Google News ───────────────────────────────────────────────────────────────

export function buildGoogleNewsUrl(query: string, lang = "id", country = "ID"): string {
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=" + lang + "-" + country +
    "&gl=" + country +
    "&ceid=" + country + ":" + lang
  );
}

export function isGoogleNewsUrl(url: string): boolean {
  return url.includes("news.google.com");
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function safeParseUrl(url: string): URL | null {
  try {
    // Add https:// if no protocol
    const withProto = /^https?:\/\//i.test(url) ? url : "https://" + url;
    return new URL(withProto);
  } catch { return null; }
}

function normalizeUrl(url: string): string {
  const parsed = safeParseUrl(url);
  return parsed ? parsed.href : url;
}

// ── Proxy fetch ───────────────────────────────────────────────────────────────

const PROXIES = [
  "https://api.rss2json.com/v1/api.json?rss_url=", // only for RSS check
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
];

async function proxyFetch(url: string, timeoutMs = 10000): Promise<string> {
  // Skip rss2json for generic proxy fetch, use raw proxies
  const rawProxies = PROXIES.slice(1);
  let lastErr: Error = new Error("all proxies failed");
  for (const proxy of rawProxies) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(proxy + encodeURIComponent(url), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (text.length < 50) throw new Error("too short");
      return text;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr;
}

// ── detectSourceType ──────────────────────────────────────────────────────────

export async function detectSourceType(
  rawUrl: string
): Promise<{ type: SourceType; feedUrl?: string; name?: string }> {
  // Validate and normalize URL first
  const url = normalizeUrl(rawUrl.trim());
  const parsed = safeParseUrl(url);
  if (!parsed) throw new Error("URL tidak valid");

  // Google News: langsung RSS
  if (isGoogleNewsUrl(url)) {
    return { type: "rss", feedUrl: url, name: "Google News" };
  }

  const base = parsed.origin + parsed.pathname.replace(/\/$/, "");
  const candidates = [
    url,
    base + "/feed",
    base + "/feed/",
    base + "/rss",
    base + "/rss.xml",
    base + "/atom.xml",
    base + "/feed.xml",
  ];

  for (const candidate of candidates) {
    try {
      const text = await proxyFetch(candidate);
      if (text.includes("<rss") || text.includes("<feed") || text.includes("<channel")) {
        const titleMatch = text.match(/<title[^>]*>([^<]{1,80})<\/title>/);
        const name = titleMatch ? titleMatch[1].trim() : parsed.hostname;
        return { type: "rss", feedUrl: candidate, name };
      }
    } catch { continue; }
  }

  // Fallback: website
  return { type: "website", name: parsed.hostname.replace("www.", "") };
}