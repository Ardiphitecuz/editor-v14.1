import type { Article } from "../data/articles";
import { ARTICLES } from "../data/articles";

type Listener = () => void;

class ArticleStore {
  private articles: Article[] = ARTICLES;
  private listeners: Set<Listener> = new Set();

  get(): Article[] {
    return this.articles;
  }

  set(articles: Article[]) {
    this.articles = articles.length > 0 ? articles : ARTICLES;
    this.listeners.forEach((fn) => fn());
  }

  findById(id: string): Article | undefined {
    return this.articles.find((a) => a.id === id);
  }

  updateById(id: string, updated: Article) {
    this.articles = this.articles.map((a) => a.id === id ? updated : a);
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const articleStore = new ArticleStore();
