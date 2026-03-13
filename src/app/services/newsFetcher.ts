/**
 * newsFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orkestrator fetch semua sumber berita.
 * Engine utama: rssFetcher.ts (Client-Side Racing Proxy — tanpa backend)
 * Fallback sumber website: websiteFetcher.ts
 */

import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import { updateSourceMeta } from "./sourceManager";

// Re-export utilities yang dipakai langsung oleh komponen lain
export { sanitizeHtml, fetchWithFallback, fetchArticleContent, proxyImgInHtml } from "./fetcherUtils";
export { sanitizeHtml as sanitizeRssHtml } from "./fetcherUtils"; // backward compat

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
  const rssSources = enabled.filter(s => s.type === "rss");
  const websiteSources = enabled.filter(s => s.type === "website");

  const errors: Record<string, string> = {};
  let all: Article[] = [];

  // ── 1. Fetch semua sumber RSS langsung via client-side racing proxy ──────
  // Semua source diproses concurrent, setiap source racing versi sendiri
  const rssResults = await Promise.allSettled(
    rssSources.map(async (source, idx) => {
      onProgress?.(`Mengambil ${source.name}...`, idx, enabled.length);
      try {
        const arts = await fetchFromRSS(source, 15);
        updateSourceMeta(source.id, {
          lastFetched: new Date().toISOString(),
          articleCount: arts.length,
          error: undefined,
        });
        return arts;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors[source.id] = msg;
        updateSourceMeta(source.id, { error: msg });
        return [] as Article[];
      }
    })
  );

  rssResults.forEach(r => {
    if (r.status === "fulfilled") all.push(...r.value);
  });

  // ── 2. Fetch sumber website via websiteFetcher ────────────────────────────
  await Promise.allSettled(
    websiteSources.map(async (source, idx) => {
      onProgress?.(`Mengambil ${source.name}...`, rssSources.length + idx, enabled.length);
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

  // ── Dedup global: berdasarkan URL akurat (sudah di-dedup per-source di rssFetcher,
  //    ini sebagai safety net lintas sumber) ─────────────────────────────────
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  all = all.filter(a => {
    const url = (a as any).originalUrl || (a as any).url || "";
    const titleKey = a.title.trim().toLowerCase().slice(0, 80);
    if (url && seenUrls.has(url)) return false;
    if (!url && seenTitles.has(titleKey)) return false;
    if (url) seenUrls.add(url);
    seenTitles.add(titleKey);
    return true;
  });

  // Sort by pubTimestamp (terbaru duluan)
  all.sort((a, b) => {
    const ta = (a as any).pubTimestamp ?? 0;
    const tb = (b as any).pubTimestamp ?? 0;
    return tb - ta;
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
