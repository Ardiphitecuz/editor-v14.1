import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { CATEGORIES, type Article } from "../data/articles";
import { useNews } from "../hooks/useNews";
import { Flame, Clock, ChevronRight, Search, RefreshCw, WifiOff, Settings } from "lucide-react";
import { LazyImage } from "./ui/LazyImage";

async function gtranslate(text: string): Promise<string> {
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=" + encodeURIComponent(text)
    );
    if (!res.ok) return text;
    const data = await res.json();
    return (data[0] as [string, string][]).map(s => s[0]).join("") || text;
  } catch { return text; }
}

function needsTranslation(text: string): boolean {
  // Translate ALL articles - Google Translate with sl=auto will handle any language
  // and return the original if it's already Indonesian
  if (!text || text.length < 3) return false;
  return true;
}

async function translateTitles(articles: Article[]): Promise<Record<string, string>> {
  const toTranslate = articles.filter(a => needsTranslation(a.title));
  if (toTranslate.length === 0) return {};
  // Batch in groups of 10 to avoid rate limiting
  const BATCH = 10;
  const map: Record<string, string> = {};
  for (let i = 0; i < toTranslate.length; i += BATCH) {
    const batch = toTranslate.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(a => gtranslate(a.title)));
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value && r.value !== batch[j].title)
        map[batch[j].id] = r.value;
    });
  }
  return map;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Hot Topic": "#ff742f", "Breaking": "#e53e3e", "Trending": "#805ad5",
  "Discuss": "#2b6cb0", "Opinion": "#2f855a", "Analisis": "#b7791f",
  "Review": "#c05621", "Exclusive": "#1a202c",
};

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? "#555";
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-white shrink-0"
      style={{ backgroundColor: color, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>
      {category.toUpperCase()}
    </span>
  );
}

// Desktop hero — image and text separated (Substack style)
function HeroCard({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1000&q=80";
  return (
    <button onClick={onClick} className="w-full text-left active:opacity-90 transition-opacity cursor-pointer">
      <div className="flex gap-6 items-start">
        <div className="flex-1 order-2">
          <CategoryBadge category={article.category} />
          <p className="mt-3" style={{ fontSize: 24, fontWeight: 800, lineHeight: "1.25", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {displayTitle ?? article.title}
          </p>
          <p className="mt-3 text-neutral-600" style={{ fontSize: 15, lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {article.summary}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Clock size={13} className="text-neutral-400" />
            <span className="text-neutral-400" style={{ fontSize: 13 }}>{article.readTime} mnt · {article.publishedAt}</span>
          </div>
        </div>
        <LazyImage
          src={article.image || placeholderImg}
          fallback={placeholderImg}
          alt={article.title}
          className="rounded-2xl object-cover shrink-0 order-1"
          style={{ width: 280, height: 180 }}
          wrapperClass="rounded-2xl shrink-0 order-1"
          wrapperStyle={{ width: 280, height: 180, flexShrink: 0 }}
        />
      </div>
    </button>
  );
}

// Mobile featured card
function FeaturedCard({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80";
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden bg-white shadow-sm active:scale-[0.98] transition-transform">
      <LazyImage
        src={article.image || placeholderImg}
        fallback={placeholderImg}
        alt={article.title}
        className="w-full object-cover"
        wrapperStyle={{ width: "100%", height: 200 }}
        style={{ width: "100%", height: "100%" }}
      />
      <div className="p-4">
        <CategoryBadge category={article.category} />
        <p className="mt-2.5" style={{ fontSize: 16, fontWeight: 700, lineHeight: "1.35", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <p className="mt-2 text-neutral-500" style={{ fontSize: 13, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {article.summary}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <Clock size={12} className="text-neutral-400" />
          <span className="text-neutral-400" style={{ fontSize: 12 }}>{article.readTime} mnt · {article.publishedAt}</span>
        </div>
      </div>
    </button>
  );
}

// Right sidebar item — updated for numbered list
function SidebarItem({ articleIndex, article, onClick, displayTitle }: { articleIndex: number; article: Article; onClick: () => void; displayTitle?: string }) {
  return (
    <button onClick={onClick}
      className="w-full text-left hover:bg-neutral-50 p-2 rounded-lg transition-colors group">
      <div className="flex items-start gap-3">
        <span className="text-neutral-300 font-bold shrink-0" style={{ fontSize: 18, lineHeight: 1.2 }}>
          {articleIndex}
        </span>
        <div className="flex-1 min-w-0">
          <p className="group-hover:text-[#ff742f] transition-colors" style={{ fontSize: 13, fontWeight: 600, lineHeight: "1.3", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {displayTitle ?? article.title}
          </p>
          <p className="mt-1 text-neutral-400" style={{ fontSize: 11 }}>{article.publishedAt}</p>
        </div>
      </div>
    </button>
  );
}

// Standard list card - Substack style (left: text, right: thumbnail)
function ArticleCard({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60";
  return (
    <button onClick={onClick}
      className="w-full flex gap-4 items-start text-left py-4 border-b border-neutral-100 active:bg-neutral-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="inline-block" style={{ fontSize: 12, fontWeight: 700, color: "#ff742f", letterSpacing: "0.04em" }}>
          {article.source}
        </p>
        <p className="mt-1" style={{ fontSize: 15, fontWeight: 700, lineHeight: "1.35", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <p className="mt-1.5 text-neutral-500" style={{ fontSize: 13, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {article.summary}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <Clock size={12} className="text-neutral-400" />
          <span className="text-neutral-400" style={{ fontSize: 12 }}>{article.readTime} mnt · {article.publishedAt}</span>
        </div>
      </div>
      <LazyImage
        src={article.image || placeholderImg}
        fallback={placeholderImg}
        alt={article.title}
        className="rounded-lg object-cover"
        wrapperClass="rounded-lg shrink-0"
        wrapperStyle={{ width: 100, height: 80, flexShrink: 0 }}
        style={{ width: "100%", height: "100%" }}
      />
    </button>
  );
}

function ArticleRow({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=60";
  return (
    <button onClick={onClick}
      className="shrink-0 text-left rounded-2xl overflow-hidden bg-white shadow-sm active:scale-[0.97] transition-transform"
      style={{ width: 190 }}>
      <LazyImage
        src={article.image || placeholderImg}
        fallback={placeholderImg}
        alt={article.title}
        className="w-full object-cover"
        wrapperStyle={{ width: "100%", height: 105 }}
        style={{ width: "100%", height: "100%" }}
      />
      <div className="p-3">
        <CategoryBadge category={article.category} />
        <p className="mt-1.5" style={{ fontSize: 12, fontWeight: 700, lineHeight: "1.3", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <p className="mt-1 text-neutral-400" style={{ fontSize: 11 }}>{article.publishedAt}</p>
      </div>
    </button>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const translatedIdsRef = useRef(new Set<string>());

  const { articles: fetchedArticles, loading, progressMsg, progressDone, progressTotal, errors, fromCache, refresh } = useNews();
  const allArticles = fetchedArticles;
  const hasArticles = allArticles.length > 0;
  // Skeleton hanya saat pertama kali buka & belum ada artikel sama sekali
  const showSkeleton = loading && !hasArticles;
  // Refresh bar tipis saat update di background (sudah ada artikel)
  const showRefreshBar = loading && hasArticles;
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    if (allArticles.length === 0) return;
    const untranslated = allArticles.filter(a => !translatedIdsRef.current.has(a.id));
    if (untranslated.length === 0) return;
    // Mark all as queued immediately to prevent duplicate requests
    untranslated.forEach(a => translatedIdsRef.current.add(a.id));
    translateTitles(untranslated).then(map => {
      if (Object.keys(map).length > 0) setTranslatedTitles(prev => ({ ...prev, ...map }));
    });
  }, [allArticles]);

  const getTitle = (a: Article) => translatedTitles[a.id] ?? a.title;

  const featured = allArticles.filter(a => a.hot);
  const trending = allArticles.filter(a => ["Trending", "Hot Topic"].includes(a.category)).slice(0, 6);
  const filtered = allArticles.filter(a => {
    const matchCat = activeCategory === "Semua" || a.category === activeCategory;
    const matchSearch = !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const heroArticle = featured[0] ?? allArticles[0];
  const sidebarArticles = allArticles.filter(a => a.id !== heroArticle?.id).slice(0, 6);

  const goToArticle = (id: string) => navigate(`/artikel/${id}`);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-100">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              {/* Selamat pagi dihapus */}
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1 }}>Menu Hari Ini</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Icon Wifi dihapus */}
              <button onClick={refresh} disabled={loading} className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 disabled:opacity-50">
                <RefreshCw size={16} className={`text-neutral-600 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={() => navigate("/pengaturan")} className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 lg:hidden">
                <Settings size={18} className="text-neutral-600" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-2.5">
            <Search size={15} className="text-neutral-400 shrink-0" />
            <input type="text" placeholder="Cari konten..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-neutral-800 placeholder-neutral-400 focus:outline-none"
              style={{ fontSize: 14 }} />
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="shrink-0 rounded-full px-3.5 py-1.5 transition-all"
              style={{ fontSize: 12, fontWeight: 700, background: activeCategory === cat ? "#ff742f" : "#f0ede9", color: activeCategory === cat ? "white" : "#555" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 pb-24 lg:pb-6">

        {/* Refresh bar — tipis di atas, muncul saat ada artikel tapi sedang update */}
        {showRefreshBar && (
          <div className="h-0.5 w-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-[#ff742f] transition-all duration-500"
              style={{ width: progressTotal > 0 ? `${Math.round((progressDone / progressTotal) * 100)}%` : "30%",
                animation: progressTotal === 0 ? "pulse 1s ease-in-out infinite" : undefined }}
            />
          </div>
        )}

        {!loading && hasErrors && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
            <WifiOff size={14} className="text-amber-500 shrink-0" />
            <p style={{ fontSize: 12, color: "#92400e" }}>{Object.keys(errors).length} sumber gagal dimuat.</p>
          </div>
        )}

        {/* Loading skeleton — hanya jika benar-benar kosong (kunjungan pertama) */}
        {showSkeleton && (
          <div className="px-4 pt-5 flex flex-col gap-4">
            {progressTotal > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <p className="text-neutral-500" style={{ fontSize: 12 }}>{progressMsg}</p>
                  <p className="text-neutral-400" style={{ fontSize: 12 }}>{progressDone}/{progressTotal}</p>
                </div>
                <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ff742f] rounded-full transition-all duration-300" style={{ width: `${Math.round((progressDone / progressTotal) * 100)}%` }} />
                </div>
              </div>
            )}
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="rounded-xl bg-neutral-200 shrink-0" style={{ width: 80, height: 80 }} />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="h-3 bg-neutral-200 rounded-full w-1/4" />
                  <div className="h-4 bg-neutral-200 rounded-full w-full" />
                  <div className="h-4 bg-neutral-200 rounded-full w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Konten artikel — tampil segera jika ada, bahkan saat refresh berlangsung */}
        {!showSkeleton && (
          activeCategory === "Semua" && !searchQuery ? (
            <>
              {/* ── DESKTOP two-column layout ── */}
              <div className="hidden lg:flex gap-0 min-h-0">
                {/* Left column: hero + trending + all articles */}
                <div className="flex-1 min-w-0 px-5 pt-5 flex flex-col gap-5">
                  {heroArticle && (
                    <HeroCard article={heroArticle} onClick={() => goToArticle(heroArticle.id)} displayTitle={getTitle(heroArticle)} />
                  )}
                  <div>
                    <h2 className="mb-3" style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>📈 Trending Sekarang</h2>
                    <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {trending.map(a => (
                        <ArticleRow key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h2 className="mb-2" style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>Semua Artikel</h2>
                    {allArticles.map(a => (
                      <ArticleCard key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
                    ))}
                  </div>
                </div>

                {/* Right column: sticky sidebar */}
                <div className="shrink-0 pt-5 pr-4" style={{ width: 280 }}>
                  <div className="sticky top-[120px]">
                    <h2 className="mb-4" style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>
                      Sedang Ramai di Cafe
                    </h2>
                    <div className="space-y-3">
                      {sidebarArticles.map((a, idx) => (
                        <button
                          key={a.id}
                          onClick={() => goToArticle(a.id)}
                          className="w-full text-left hover:bg-neutral-50 p-2 rounded-lg transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-neutral-300 font-bold shrink-0" style={{ fontSize: 18, lineHeight: 1.2 }}>
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="group-hover:text-[#ff742f] transition-colors" style={{ fontSize: 13, fontWeight: 600, lineHeight: "1.3", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {getTitle(a)}
                              </p>
                              <p className="mt-1 text-neutral-400" style={{ fontSize: 11 }}>{a.publishedAt}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MOBILE stacked layout ── */}
              <div className="lg:hidden">
                <div className="px-4 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>🔥 Sedang Panas</h2>
                    <button className="flex items-center gap-0.5 text-[#ff742f]" style={{ fontSize: 13, fontWeight: 700 }}>
                      Semua <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {featured.map(a => (
                      <FeaturedCard key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
                    ))}
                  </div>
                </div>
                <div className="pt-6 px-4">
                  <h2 className="mb-3" style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>📈 Trending Sekarang</h2>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {trending.map(a => (
                      <ArticleRow key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
                    ))}
                  </div>
                </div>
                <div className="pt-6 px-4">
                  <h2 className="mb-1" style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>Semua Artikel</h2>
                  {allArticles.map(a => (
                    <ArticleCard key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="px-4 pt-5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                  <p style={{ fontSize: 40 }}>🔍</p>
                  <p style={{ fontSize: 15, fontWeight: 600 }} className="mt-2">Tidak ada artikel ditemukan</p>
                  <p style={{ fontSize: 13 }} className="mt-1">Coba kata kunci lain</p>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-neutral-400" style={{ fontSize: 13 }}>
                    {filtered.length} artikel{activeCategory !== "Semua" && ` dalam "${activeCategory}"`}
                  </p>
                  {filtered.map(a => (
                    <ArticleCard key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
                  ))}
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}