export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  tag?: string;
  src?: string;
}

export interface Article {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string[];
  source: string;
  sourceId?: string;
  rssContentSufficient?: boolean;
  image: string;
  images?: string[];
  blocks?: ContentBlock[];
  contentHtml?: string;          // HTML bersih siap render (Inoreader-style)
  readTime: number;
  publishedAt: string;
  hot?: boolean;
  originalUrl?: string;
}

// Artikel asli selalu di-fetch dari RSS sources via newsFetcher.ts
// Array ini sengaja kosong — tidak ada dummy/placeholder
export const ARTICLES: Article[] = [];