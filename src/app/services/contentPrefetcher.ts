/**
 * Background content + thumbnail prefetcher.
 *
 * Dua mode:
 * 1. prefetchThumbnails — ambil og:image via /api/og (ringan, tanpa Readability)
 * 2. prefetchArticleContents — fetch konten lengkap untuk artikel pertama
 */
import { fetchArticleContent } from "./fetcherUtils";
import { articleStore } from "../store/articleStore";
import type { Article } from "../data/articles";

const prefetchedIds    = new Set<string>();
const thumbPrefetched  = new Set<string>();

const FALLBACK_HOST = "images.unsplash.com";

function isFallbackImage(img: string | undefined): boolean {
  if (!img) return true;
  return img.includes(FALLBACK_HOST);
}

// ── 1. Prefetch thumbnail via /api/og (ringan, hanya baca meta tag) ──────────
// Pakai /api/og bukan fetchArticleContent — jauh lebih cepat karena hanya fetch
// 50KB pertama halaman untuk baca og:image, tanpa Readability/linkedom sama sekali
export async function prefetchThumbnails(articles: Article[], concurrency = 4): Promise<void> {
  const needsThumb = articles.filter(a =>
    a.originalUrl &&
    !thumbPrefetched.has(a.id) &&
    isFallbackImage(a.image)
  );

  if (needsThumb.length === 0) return;
  needsThumb.forEach(a => thumbPrefetched.add(a.id));

  for (let i = 0; i < needsThumb.length; i += concurrency) {
    const batch = needsThumb.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(async (art) => {
      try {
        const res = await fetch("/api/og?url=" + encodeURIComponent(art.originalUrl!), {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = await res.json();
        const newImage = data.image?.startsWith("http") ? data.image : null;
        if (!newImage) return;
        articleStore.updateById(art.id, { ...art, image: newImage });
      } catch {
        thumbPrefetched.delete(art.id);
      }
    }));
    if (i + concurrency < needsThumb.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

// ── 2. Prefetch konten lengkap ────────────────────────────────────────────────
export async function prefetchArticleContents(articles: Article[], batchSize = 5): Promise<void> {
  const needsFetch = articles.filter(a =>
    a.originalUrl &&
    !prefetchedIds.has(a.id) &&
    !a.rssContentSufficient
  ).slice(0, batchSize);

  if (needsFetch.length === 0) return;
  needsFetch.forEach(a => prefetchedIds.add(a.id));

  await Promise.allSettled(
    needsFetch.map(async (art) => {
      try {
        const result = await fetchArticleContent(art.originalUrl!);
        if (!result || (!(result as any).contentHtml && !result.content.length)) return;

        const updated: Article = {
          ...art,
          originalUrl: art.originalUrl,
          content: result.content,
          summary: result.summary ?? art.summary,
          image: result.image?.startsWith("http") ? result.image : art.image,
          contentHtml: (result as any).contentHtml,
          rssContentSufficient: true,
          readTime: Math.max(1, Math.ceil(
            ((result as any).contentHtml ?? result.content.join(" "))
              .replace(/<[^>]+>/g, " ").trim().split(/\s+/).length / 200
          )),
        };
        articleStore.updateById(art.id, updated);
        thumbPrefetched.add(art.id);
      } catch {
        prefetchedIds.delete(art.id);
      }
    })
  );
}

export function clearPrefetchCache() {
  prefetchedIds.clear();
  thumbPrefetched.clear();
}