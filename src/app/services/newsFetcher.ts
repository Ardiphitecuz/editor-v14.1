/**
 * newsFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Orkestrator: mendelegasikan ke rssFetcher atau websiteFetcher berdasarkan
 * tipe sumber, lalu meng-cache hasilnya.
 *
 * File ini TIDAK berisi logika parsing/sanitasi — semua ada di:
 *   - fetcherUtils.ts   — shared utilities, sanitizer, proxy fetch
 *   - rssFetcher.ts     — logika RSS/Atom
 *   - websiteFetcher.ts — logika non-RSS website scraping
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
  const errors: Record<string, string> = {};
  const all: Article[] = [];

  await Promise.allSettled(
    enabled.map(async (source, idx) => {
      onProgress?.("Mengambil " + source.name + "...", idx, enabled.length);
      try {
        const arts =
          source.type === "rss"
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
    })
  );

  onProgress?.("Selesai", enabled.length, enabled.length);
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