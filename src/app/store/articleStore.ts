import type { Article } from "../data/articles";
import { ARTICLES } from "../data/articles";

type Listener = () => void;

const SAVED_KEY = "otaku_saved_ids";
const CACHE_KEY = "otaku_articles_cache_v11"; // v11 = invalidate cache lama dari Vercel
const CACHE_TTL = 1000 * 60 * 120; // 2 jam — survive tab close, langsung tampil saat buka ulang

interface ArticleCache {
  articles: Article[];
  savedAt: number;
}

function loadCachedArticles(): Article[] {
  try {
    // Coba localStorage dulu (survive tab close), fallback ke sessionStorage
    const raw = localStorage.getItem(CACHE_KEY) ?? sessionStorage.getItem(CACHE_KEY);
    if (!raw) return ARTICLES;
    const cache: ArticleCache = JSON.parse(raw);
    if (Date.now() - cache.savedAt < CACHE_TTL && cache.articles.length > 0) {
      return cache.articles;
    }
    return ARTICLES;
  } catch { return ARTICLES; }
}

function persistArticles(articles: Article[]) {
  try {
    const cache: ArticleCache = { articles, savedAt: Date.now() };
    const data = JSON.stringify(cache);
    // Simpan ke localStorage agar survive tab close / revisit
    localStorage.setItem(CACHE_KEY, data);
  } catch {
    // localStorage penuh — fallback ke sessionStorage
    try {
      const cache: ArticleCache = { articles, savedAt: Date.now() };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* skip */ }
  }
}

class ArticleStore {
  private articles: Article[] = loadCachedArticles();
  private listeners: Set<Listener> = new Set();

  get(): Article[] {
    return this.articles;
  }

  set(articles: Article[]) {
    this.articles = articles.length > 0 ? articles : ARTICLES;
    persistArticles(this.articles);
    this.listeners.forEach((fn) => fn());
  }

  findById(id: string): Article | undefined {
    return this.articles.find((a) => a.id === id);
  }

  updateById(id: string, updated: Article) {
    this.articles = this.articles.map((a) => a.id === id ? updated : a);
    persistArticles(this.articles);
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Saved articles (persisted to localStorage) ───────────────────────────

  getSavedIds(): string[] {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    } catch { return []; }
  }

  isSaved(id: string): boolean {
    return this.getSavedIds().includes(id);
  }

  saveArticle(id: string): void {
    const ids = this.getSavedIds();
    if (!ids.includes(id)) {
      localStorage.setItem(SAVED_KEY, JSON.stringify([id, ...ids]));
      this.listeners.forEach((fn) => fn());
    }
  }

  unsaveArticle(id: string): void {
    const ids = this.getSavedIds().filter((i) => i !== id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
    this.listeners.forEach((fn) => fn());
  }

  toggleSave(id: string): boolean {
    if (this.isSaved(id)) {
      this.unsaveArticle(id);
      return false;
    } else {
      this.saveArticle(id);
      return true;
    }
  }

  getSavedArticles(): Article[] {
    const ids = this.getSavedIds();
    return ids
      .map((id) => this.articles.find((a) => a.id === id))
      .filter((a): a is Article => !!a);
  }
}

export const articleStore = new ArticleStore();