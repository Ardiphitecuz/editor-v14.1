/**
 * newsroomFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend service yang menggunakan backend /api/feeds — port penuh dari
 * the-newsroom-rss (https://github.com/royalgarter/the-newsroom-rss).
 *
 * Aliran data:
 *   getSources() → [{ id, feedUrl, ... }]
 *     ↓
 *   POST /api/feeds  (newsroom-engine.js di backend)
 *     ↓
 *   fetchRSSLinks() — engine asli newsroom-rss
 *     ↓
 *   Article[]  (dinormalisasi ke format app kita)
 */

import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import { guessCategory, relTime } from "./fetcherUtils";

// Alias agar code di bawah mudah dibaca
const classifyCategory = guessCategory;
function estimateReadTime(text: string): number {
  const words = (text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ── Tipe respons dari /api/feeds ──────────────────────────────────────────────
interface NewsroomFeed {
  title: string;
  link: string;
  rss_url: string;
  image?: string;
  order: number;
  short?: string;
  cached?: boolean;
  items: NewsroomItem[];
}

interface NewsroomItem {
  link: string;
  title: string;
  author?: string;
  description?: string;
  published?: string | Date;
  updated?: string | Date;
  images?: string[];
  categories?: string[];
  statistics?: string;
  ldjson?: Record<string, unknown>;
  source?: string;
}

// ── Base URL backend ──────────────────────────────────────────────────────────
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

// ── Normalisasi NewsroomItem → Article ───────────────────────────────────────
function normalizeItem(item: NewsroomItem, feed: NewsroomFeed, idx: number): Article | null {
  if (!item?.link || !item?.title) return null;

  const pubDate = item.published ? new Date(item.published) : new Date();
  const pubTimestamp = pubDate.getTime();

  // Relative time label
  const now = Date.now();
  const diffMs = now - pubTimestamp;
  const diffHrs = diffMs / (1000 * 60 * 60);
  let publishedAt: string;
  if (diffHrs < 1) {
    const mins = Math.round(diffMs / 60000);
    publishedAt = `${mins} menit lalu`;
  } else if (diffHrs < 24) {
    publishedAt = `${Math.round(diffHrs)} jam lalu`;
  } else {
    publishedAt = pubDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  // Image: cari dari berbagai sumber, prioritas terbaik dulu
  let image = '';

  // 1. Dari images[] yang sudah diproses engine (media:content, media:thumbnail, og:image)
  if (item.images?.length) {
    image = item.images.find(u => u && u.startsWith('http') && !u.includes('favicon')) || item.images[0] || '';
  }

  // 2. Fallback: ekstrak <img> dari description/content HTML
  if (!image && item.description) {
    const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch?.[1]) image = imgMatch[1];
  }

  // 3. Gunakan favicon jika semua gagal (sudah pasti ada dari engine)
  if (!image && item.images?.length) {
    image = item.images[0]; // termasuk favicon fallback dari engine
  }

  // Source label: ambil dari host link
  let sourceName = '';
  try {
    const host = new URL(item.link).hostname.replace(/^www\./, '');
    sourceName = host.split('.').slice(-2, -1)[0]?.toUpperCase() || host;
  } catch {}
  if (!sourceName) sourceName = feed.short || feed.title || 'News';

  // Summary: bersihkan HTML dari description
  const rawDesc = item.description || '';
  const summary = rawDesc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

  // Kategori: coba dari item.categories lalu auto-classify
  const categoryHint = item.categories?.[0] || '';
  const category = classifyCategory(item.title, categoryHint ? [categoryHint] : []);

  // Hot: artikel < 6 jam dengan kategori panas
  const hot = diffHrs < 6 && ['Hot Topic', 'Breaking', 'Trending'].includes(category);

  // ID unik
  const id = btoa(encodeURIComponent(item.link)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);

  return {
    id,
    title: item.title,
    summary: summary || item.title,
    image,
    source: sourceName,
    category,
    publishedAt,
    readTime: estimateReadTime(summary),
    hot,
    originalUrl: item.link,   // ← pakai originalUrl agar ArticlePage bisa fetch konten penuh
    content: [],
    // Extra fields dari newsroom-rss (disimpan untuk ArticlePage)
    author: item.author,
    pubTimestamp,
    ldjson: item.ldjson,
  } as unknown as Article;
}

// ── fetchFromNewsroomEngine — panggil /api/feeds ──────────────────────────────
export async function fetchFromNewsroomEngine(
  sources: NewsSource[],
  limit = 15,
  pioneer = false,
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<{ articles: Article[]; errors: Record<string, string>; fromCache: boolean }> {
  const enabled = sources.filter(s => s.enabled && s.feedUrl);

  if (enabled.length === 0) {
    return { articles: [], errors: { _noSources: 'Tidak ada sumber RSS yang aktif' }, fromCache: false };
  }

  const errors: Record<string, string> = {};
  const allArticles: Article[] = [];
  let fromCache = false;

  try {
    onProgress?.(`Menghubungi newsroom engine...`, 0, enabled.length);

    const keys = enabled.map((s, order) => ({
      url: s.feedUrl!,
      order,
      name: s.name,
    }));

    const response = await fetch(`${getBaseUrl()}/api/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, limit, pioneer }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    fromCache = !!data.cached;

    const feeds: NewsroomFeed[] = data.feeds || [];
    
    // Buat map: feedUrl → source.id untuk error reporting
    const urlToSourceId = new Map(enabled.map(s => [s.feedUrl!, s.id]));

    feeds.forEach((feed, feedIdx) => {
      onProgress?.(`Memproses ${feed.short || feed.title}...`, feedIdx + 1, feeds.length);

      if (!feed.items?.length) {
        // Feed berhasil di-fetch tapi kosong — bukan error
        return;
      }

      feed.items.forEach((item, idx) => {
        const article = normalizeItem(item, feed, idx);
        if (article) allArticles.push(article);
      });
    });

    // Tandai sumber yang tidak menghasilkan artikel sebagai gagal
    enabled.forEach(source => {
      const feedArticles = allArticles.filter(a => {
        try {
          return new URL((a as any).url || '').hostname === new URL(source.feedUrl!).hostname;
        } catch { return false; }
      });
      if (feedArticles.length === 0) {
        // Cek apakah feed-nya memang ada tapi kosong vs gagal di-parse
        const feedFound = feeds.find(f => f.rss_url === source.feedUrl);
        if (!feedFound) {
          errors[source.id] = 'Feed tidak ditemukan dalam respons engine';
        }
      }
    });

    onProgress?.('Selesai', enabled.length, enabled.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors['_newsroom_engine'] = msg;
    console.error('[newsroomFetcher] Error:', msg);
  }

  // Sort terbaru dulu
  allArticles.sort((a, b) => {
    const ta = (a as any).pubTimestamp ?? 0;
    const tb = (b as any).pubTimestamp ?? 0;
    return tb - ta;
  });

  return { articles: allArticles, errors, fromCache };
}