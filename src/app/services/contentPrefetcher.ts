/**
 * Background content prefetcher.
 * Setelah artikel di-list, prefetch konten dari URL asli agar
 * saat user buka artikel, konten sudah siap (tidak perlu tunggu lagi).
 */
import { fetchArticleContent } from "./newsFetcher";
import { articleStore } from "../store/articleStore";
import type { Article } from "../data/articles";

// Track ID yang sudah/sedang di-prefetch agar tidak duplikat
const prefetchedIds = new Set<string>();

export async function prefetchArticleContents(articles: Article[], batchSize = 5): Promise<void> {
  const needsFetch = articles.filter(a =>
    a.originalUrl &&                       // harus punya URL sumber
    !prefetchedIds.has(a.id) &&           // belum pernah di-prefetch
    !a.blocks?.length &&                  // belum punya konten lengkap
    !a.rssContentSufficient               // ← SKIP jika RSS sudah cukup (yaraon, dll)
  ).slice(0, batchSize);

  if (needsFetch.length === 0) return;

  // Tandai segera agar tidak ada fetch duplikat
  needsFetch.forEach(a => prefetchedIds.add(a.id));

  await Promise.allSettled(
    needsFetch.map(async (art) => {
      try {
        const result = await fetchArticleContent(art.originalUrl!);
        if (!result || result.content.length === 0) return;
        const updated: Article = {
          ...art,
          originalUrl: art.originalUrl,   // jangan sampai hilang
          content: result.content,
          summary: result.summary ?? art.summary,
          image: result.image?.startsWith("http") ? result.image : art.image,
          images: result.images?.length ? result.images : art.images,
          blocks: result.blocks as Article["blocks"],
          readTime: Math.max(1, Math.ceil(result.content.join(" ").split(/\s+/).length / 200)),
        };
        articleStore.updateById(art.id, updated);
      } catch {
        // Prefetch gagal — akan di-fetch on-demand saat user buka artikel
        prefetchedIds.delete(art.id);
      }
    })
  );
}

export function clearPrefetchCache() {
  prefetchedIds.clear();
}