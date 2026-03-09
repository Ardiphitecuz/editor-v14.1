import { useState, useEffect, useCallback, useRef } from "react";
import type { Article } from "../data/articles";
import { getSources } from "../services/sourceManager";
import { fetchAllSourcesCached, clearAllSourceCache } from "../services/newsFetcher";
import { prefetchArticleContents } from "../services/contentPrefetcher";
import { articleStore } from "../store/articleStore";

export interface UseNewsState {
  articles: Article[];
  loading: boolean;
  progressMsg: string;
  progressDone: number;
  progressTotal: number;
  errors: Record<string, string>;
  fromCache: boolean;
  refresh: () => void;
}

export function useNews(): UseNewsState {
  const [articles, setArticles] = useState<Article[]>(articleStore.get());
  const [loading, setLoading] = useState(true);
  const [progressMsg, setProgressMsg] = useState("Memuat berita...");
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fromCache, setFromCache] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async (forceRefresh = false) => {
    if (!mountedRef.current) return;
    setLoading(true);
    setProgressMsg("Memuat berita...");
    setProgressDone(0);
    setProgressTotal(0);
    setErrors({});

    try {
      const sources = getSources();
      const result = await fetchAllSourcesCached(
        sources,
        forceRefresh,
        (msg, done, total) => {
          if (!mountedRef.current) return;
          setProgressMsg(msg);
          setProgressDone(done);
          setProgressTotal(total);
        }
      );
      if (!mountedRef.current) return;
      articleStore.set(result.articles);
      setArticles(result.articles);
      setErrors(result.errors ?? {});
      setFromCache(result.fromCache ?? false);

      // Background prefetch content for first 5 articles
      if (result.articles.length > 0) {
        setTimeout(() => prefetchArticleContents(result.articles, 5), 500);
      }
    } catch (err) {
      if (mountedRef.current) {
        setErrors({ _global: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  useEffect(() => {
    return articleStore.subscribe(() => setArticles(articleStore.get()));
  }, []);

  const refresh = useCallback(() => {
    clearAllSourceCache();
    load(true);
  }, [load]);

  return { articles, loading, progressMsg, progressDone, progressTotal, errors, fromCache, refresh };
}