/**
 * Background content prefetcher.
 * After articles are listed, this prefetches content from article URLs
 * so when user opens an article, content is already ready.
 */
import { fetchArticleContent } from "./newsFetcher";
import { articleStore } from "../store/articleStore";
import type { Article } from "../data/articles";

type ExtArticle = Article & { originalUrl?: string };

// Track which IDs have been prefetched to avoid duplicate work
const prefetchedIds = new Set<string>();

export async function prefetchArticleContents(articles: Article[], batchSize = 5): Promise<void> {
  const needsFetch = (articles as ExtArticle[]).filter(a =>
    (!a.content || a.content.length === 0) &&
    a.originalUrl &&
    !prefetchedIds.has(a.id)
  ).slice(0, batchSize);

  if (needsFetch.length === 0) return;

  // Mark as in-progress immediately to prevent duplicate fetches
  needsFetch.forEach(a => prefetchedIds.add(a.id));

  await Promise.allSettled(
    needsFetch.map(async (art) => {
      try {
        const result = await fetchArticleContent(art.originalUrl!);
        if (!result || result.content.length === 0) return;
        const updated: Article = {
          ...art,
          content: result.content,
          summary: result.summary ?? art.summary,
          image: result.image?.startsWith("http") ? result.image : art.image,
          readTime: Math.max(1, Math.ceil(result.content.join(" ").split(/\s+/).length / 200)),
        };
        articleStore.updateById(art.id, updated);
      } catch {
        // Prefetch failure is silent — article will fetch on demand when opened
        prefetchedIds.delete(art.id);
      }
    })
  );
}

export function clearPrefetchCache() {
  prefetchedIds.clear();
}