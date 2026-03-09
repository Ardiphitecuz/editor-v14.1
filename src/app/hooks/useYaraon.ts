import { useState, useEffect, useCallback } from "react";
import { fetchYaraonArticles, clearYaraonCache, type FetchResult } from "../services/yaraon";
import { prefetchArticleContents } from "../services/contentPrefetcher";
import type { Article } from "../data/articles";

interface UseYaraonReturn {
  articles: Article[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  refresh: () => void;
}

export function useYaraon(limit = 20): UseYaraonReturn {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    if (forceRefresh) clearYaraonCache();

    const result: FetchResult = await fetchYaraonArticles(limit);
    setArticles(result.articles);
    setError(result.error);
    setFromCache(result.fromCache);
    setLoading(false);

    // Background prefetch content for first 5 articles
    if (result.articles.length > 0) {
      setTimeout(() => prefetchArticleContents(result.articles, 5), 500);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { articles, loading, error, fromCache, refresh };
}