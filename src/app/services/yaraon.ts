import type { Article } from "../data/articles";

const CORS_PROXY = "https://api.allorigins.win/raw?url=";
const YARAON_RSS = "http://yaraon-blog.com/feed";

const CATEGORY_MAP: Record<string, string> = {
  "アニメ": "Hot Topic", "漫画": "Trending", "ゲーム": "Trending",
  "VTuber": "Hot Topic", "ホロライブ": "Hot Topic", "ラノベ": "Review",
  "声優": "Trending", "話題": "Breaking", "速報": "Breaking",
  "朗報": "Breaking", "悲報": "Discuss",
};

const CATEGORY_IMAGES: Record<string, string> = {
  "Hot Topic": "https://images.unsplash.com/photo-1705927450843-3c1abe9b17d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  "Breaking":  "https://images.unsplash.com/photo-1655393001768-d946c97d6fd1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  "Trending":  "https://images.unsplash.com/photo-1771193950779-27b2802ab4c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  "Discuss":   "https://images.unsplash.com/photo-1772587003187-65b32c91df91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  "Review":    "https://images.unsplash.com/photo-1772587003205-e727c3db6f44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
};

function detectCategory(title: string, tags: string[]): string {
  if (title.includes("速報") || title.includes("朗報")) return "Breaking";
  if (title.includes("悲報")) return "Discuss";
  if (title.includes("話題")) return "Hot Topic";
  for (const tag of tags) {
    if (CATEGORY_MAP[tag]) return CATEGORY_MAP[tag];
  }
  return "Hot Topic";
}

function extractImage(content: string): string | null {
  const match = content.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

function formatPublishedAt(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export interface FetchResult {
  articles: Article[];
  error: string | null;
  fromCache: boolean;
}

let cache: { articles: Article[]; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

export async function fetchYaraonArticles(limit = 20): Promise<FetchResult> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return { articles: cache.articles.slice(0, limit), error: null, fromCache: true };
  }

  try {
    const url = `${CORS_PROXY}${encodeURIComponent(YARAON_RSS)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, "text/xml");
    if (xml.querySelector("parsererror")) throw new Error("XML parse error");

    const items = Array.from(xml.querySelectorAll("item"));

    const articles: Article[] = items.slice(0, limit).map((item, index) => {
      const title = item.querySelector("title")?.textContent?.trim() ?? "Untitled";
      const link = item.querySelector("link")?.textContent?.trim() ?? "#";
      const pubDate = item.querySelector("pubDate")?.textContent ?? "";
      const description = item.querySelector("description")?.textContent ?? "";
      const contentEncoded =
        item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]
          ?.textContent ?? description;

      const tags = Array.from(item.querySelectorAll("category")).map(c => c.textContent?.trim() ?? "");
      const category = detectCategory(title, tags);
      const image = extractImage(contentEncoded) ?? extractImage(description)
        ?? CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES["Hot Topic"];

      return {
        id: `yaraon-${index + 1}`,
        category,
        title,
        summary: title,   // will be replaced after content fetch
        content: [],      // always empty — triggers background fetch
        source: "やらおん！",
        image,
        readTime: 3,
        publishedAt: pubDate ? formatPublishedAt(pubDate) : "Baru saja",
        hot: index < 3,
        originalUrl: link !== "#" ? link : undefined,
      } as Article & { originalUrl?: string };
    });

    cache = { articles, timestamp: Date.now() };
    return { articles, error: null, fromCache: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { articles: [], error: message, fromCache: false };
  }
}

export function clearYaraonCache() { cache = null; }