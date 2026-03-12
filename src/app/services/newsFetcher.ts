/**
 * newsFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orkestrator: mendelegasikan ke newsroomFetcher (engine utama dari the-newsroom-rss)
 * atau rssFetcher/websiteFetcher sebagai fallback.
 *
 * Arsitektur:
 *   - newsroomFetcher.ts  — engine RSS utama (port dari the-newsroom-rss)
 *   - rssFetcher.ts       — fallback RSS/Atom  
 *   - websiteFetcher.ts   — fallback website scraping
 *   - fetcherUtils.ts     — shared utilities
 */

import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import { updateSourceMeta } from "./sourceManager";

// Re-export utilities yang dipakai langsung oleh komponen lain
export { sanitizeHtml, fetchWithFallback, fetchArticleContent, proxyImgInHtml } from "./fetcherUtils";
export { sanitizeHtml as sanitizeRssHtml } from "./fetcherUtils"; // backward compat

import { fetchFromNewsroomEngine } from "./newsroomFetcher";
import { fetchFromRSS } from "./rssFetcher";
import { fetchFromWebsite } from "./websiteFetcher";

// ── Public types ──────────────────────────────────────────────────────────────
export interface FetchAllResult {
  articles: Article[];
  errors: Record<string, string>;
  fromCache: boolean;
}

// ── Fetch semua sumber ────────────────────────────────────────────────────────
export async function fetchAllSources(
  sources: NewsSource[],
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<FetchAllResult> {
  const enabled = sources.filter(s => s.enabled);

  // Sumber RSS → newsroomFetcher (engine asli the-newsroom-rss via /api/feeds)
  // Sumber website → websiteFetcher (scraper seperti semula)
  const rssSources = enabled.filter(s => s.type === "rss");
  const websiteSources = enabled.filter(s => s.type === "website");

  const errors: Record<string, string> = {};
  let all: Article[] = [];

  // 1. Fetch semua sumber RSS via newsroom engine (batch, lebih efisien)
  if (rssSources.length > 0) {
    const result = await fetchFromNewsroomEngine(rssSources, 15, false, onProgress);

    // Tambahkan artikel dari engine
    all.push(...result.articles);

    // Hitung artikel per sumber (pakai originalUrl karena newsroomFetcher set originalUrl)
    const articlesByHost = new Map<string, number>();
    result.articles.forEach(a => {
      try {
        const host = new URL((a as any).originalUrl || '').hostname;
        articlesByHost.set(host, (articlesByHost.get(host) ?? 0) + 1);
      } catch {}
    });

    // Tentukan sumber mana yang perlu fallback:
    // - ada di result.errors, ATAU
    // - engine total gagal (_newsroom_engine error), ATAU
    // - berhasil fetch tapi 0 artikel (feed mungkin format tidak dikenali)
    const engineFailed = !!result.errors['_newsroom_engine'];
    const failedSources = rssSources.filter(source => {
      if (engineFailed) return true;
      if (result.errors[source.id]) return true;
      // Cek apakah sumber ini menghasilkan 0 artikel
      try {
        const feedHost = new URL(source.feedUrl || source.url).hostname;
        return (articlesByHost.get(feedHost) ?? 0) === 0;
      } catch { return true; }
    });

    // Update meta untuk sumber yang berhasil
    rssSources.filter(s => !failedSources.includes(s)).forEach(source => {
      try {
        const feedHost = new URL(source.feedUrl || source.url).hostname;
        updateSourceMeta(source.id, {
          lastFetched: new Date().toISOString(),
          articleCount: articlesByHost.get(feedHost) ?? 0,
          error: undefined,
        });
      } catch {}
    });

    // Fallback ke rssFetcher untuk sumber yang gagal
    if (failedSources.length > 0) {
      await Promise.allSettled(
        failedSources.map(async (source) => {
          try {
            const arts = await fetchFromRSS(source, 15);
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
        })
      );
    }
  }

  // 2. Fetch sumber website via websiteFetcher
  await Promise.allSettled(
    websiteSources.map(async (source, idx) => {
      onProgress?.("Mengambil " + source.name + "...", rssSources.length + idx, enabled.length);
      try {
        const arts = await fetchFromWebsite(source, 15);
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
    })
  );

  onProgress?.("Selesai", enabled.length, enabled.length);

  // ── Dedup berdasarkan URL — artikel yang sama dari beda sumber digabung jadi satu
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  all = all.filter(a => {
    const url = (a as any).originalUrl || (a as any).url || "";
    const titleKey = a.title.trim().toLowerCase().slice(0, 60);
    // Skip jika URL sama (exact match)
    if (url && seenUrls.has(url)) return false;
    // Skip jika judul sangat mirip (mencegah artikel yg sama tapi beda source)
    if (seenTitles.has(titleKey)) return false;
    if (url) seenUrls.add(url);
    seenTitles.add(titleKey);
    return true;
  });
    const ta = (a as any).pubTimestamp ?? 0;
    const tb = (b as any).pubTimestamp ?? 0;
    if (tb !== ta) return tb - ta;
    return 0;
  });

  return { articles: all, errors, fromCache: false };
}

// ── Cache (15 menit) ──────────────────────────────────────────────────────────
const cache = new Map<string, { articles: Article[]; ts: number }>();

export async function fetchAllSourcesCached(
  sources: NewsSource[],
  forceRefresh = false,
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<FetchAllResult> {
  const key = sources.filter(s => s.enabled).map(s => s.id).join(",");

  if (!forceRefresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < 900_000) {
      return { articles: hit.articles, errors: {}, fromCache: true };
    }
  }

  const result = await fetchAllSources(sources, onProgress);
  if (result.articles.length > 0) {
    cache.set(key, { articles: result.articles, ts: Date.now() });
  }
  return result;
}

export function clearAllSourceCache(): void {
  cache.clear();
}
