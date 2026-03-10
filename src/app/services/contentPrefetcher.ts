/**
 * Background content + thumbnail prefetcher.
 * 
 * Dua mode:
 * 1. prefetchThumbnails — hanya ambil og:image untuk artikel yang gambarnya fallback
 *    Ringan, jalankan untuk semua artikel di halaman utama
 * 2. prefetchArticleContents — fetch konten lengkap untuk artikel pertama
 *    Berat, jalankan hanya untuk beberapa artikel teratas
 */
import { fetchArticleContent } from "./newsFetcher";
import { articleStore } from "../store/articleStore";
import type { Article } from "../data/articles";

const prefetchedIds    = new Set<string>();
const thumbPrefetched  = new Set<string>();

const FALLBACK_HOST = "images.unsplash.com";

function isFallbackImage(img: string | undefined): boolean {
  if (!img) return true;
  return img.includes(FALLBACK_HOST);
}

// ── 1. Prefetch thumbnail saja (og:image) ────────────────────────────────────
// Panggil untuk semua artikel — ringan karena hanya baca og:image dari server
export async function prefetchThumbnails(articles: Article[], concurrency = 4): Promise<void> {
  const needsThumb = articles.filter(a =>
    a.originalUrl &&
    !thumbPrefetched.has(a.id) &&
    isFallbackImage(a.image)
  );

  if (needsThumb.length === 0) return;
  needsThumb.forEach(a => thumbPrefetched.add(a.id));

  // Proses dalam batch kecil agar tidak banjir request
  for (let i = 0; i < needsThumb.length; i += concurrency) {
    const batch = needsThumb.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(async (art) => {
      try {
        const result = await fetchArticleContent(art.originalUrl!);
        if (!result) return;

        // Update gambar dan summary jika lebih baik
        const newImage = result.image?.startsWith("http") ? result.image : null;
        const newContentHtml = (result as any).contentHtml;
        if (!newImage && !newContentHtml) return;

        const updated: Article = {
          ...art,
          ...(newImage ? { image: newImage } : {}),
          ...(newContentHtml && !art.rssContentSufficient ? {
            contentHtml: newContentHtml,
            summary: result.summary ?? art.summary,
            rssContentSufficient: true,
          } : {}),
        };
        articleStore.updateById(art.id, updated);
        prefetchedIds.add(art.id); // tandai juga sebagai konten sudah prefetch
      } catch {
        thumbPrefetched.delete(art.id); // boleh retry nanti
      }
    }));
    // Jeda antar batch agar tidak overload server
    if (i + concurrency < needsThumb.length) {
      await new Promise(r => setTimeout(r, 300));
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