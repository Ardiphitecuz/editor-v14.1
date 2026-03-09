import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ARTICLES, CATEGORIES, type Article } from "../data/articles";
import { useNews } from "../hooks/useNews";
import { Flame, Clock, ChevronRight, Search, RefreshCw, Wifi, WifiOff, Settings } from "lucide-react";

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
  return /[\u3000-\u9FFF\uF900-\uFAFF]/.test(text);
}

async function translateTitles(articles: Article[]): Promise<Record<string, string>> {
  const toTranslate = articles.filter(a => needsTranslation(a.title));
  if (toTranslate.length === 0) return {};
  const results = await Promise.allSettled(toTranslate.map(a => gtranslate(a.title)));
  const map: Record<string, string> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value !== toTranslate[i].title)
      map[toTranslate[i].id] = r.value;
  });
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

// Desktop hero — large image with overlay text
function HeroCard({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80";
  return (
    <button onClick={onClick}
      className="relative w-full rounded-2xl overflow-hidden text-left active:scale-[0.99] transition-transform"
      style={{ height: 360 }}>
      <img 
        src={article.image || placeholderImg} 
        alt={article.title} 
        className="absolute inset-0 w-full h-full object-cover" 
        onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0) 25%, rgba(0,0,0,0.85) 100%)" }} />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#ff742f] text-white rounded-full px-2.5 py-1" style={{ fontSize: 11, fontWeight: 700 }}>
        <Flame size={11} /> HOT
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <CategoryBadge category={article.category} />
        <p className="text-white mt-2" style={{ fontSize: 20, fontWeight: 800, lineHeight: "1.3", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Clock size={11} className="text-white/60" />
          <span className="text-white/60" style={{ fontSize: 12 }}>{article.readTime} mnt · {article.publishedAt}</span>
        </div>
      </div>
    </button>
  );
}

// Mobile featured card
function FeaturedCard({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80";
  return (
    <button onClick={onClick}
      className="relative w-full rounded-2xl overflow-hidden text-left shadow-lg active:scale-[0.98] transition-transform"
      style={{ height: 220 }}>
      <img 
        src={article.image || placeholderImg} 
        alt={article.title} 
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.75) 100%)" }} />
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#ff742f] text-white rounded-full px-2.5 py-1" style={{ fontSize: 11, fontWeight: 700 }}>
        <Flame size={11} /> HOT
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <CategoryBadge category={article.category} />
        <p className="text-white mt-1.5" style={{ fontSize: 16, fontWeight: 700, lineHeight: "1.35", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Clock size={11} className="text-white/70" />
          <span className="text-white/70" style={{ fontSize: 11 }}>{article.readTime} mnt · {article.publishedAt}</span>
        </div>
      </div>
    </button>
  );
}

// Right sidebar item — thumbnail + title + time
function SidebarItem({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200&q=60";
  return (
    <button onClick={onClick}
      className="w-full flex gap-3 items-start text-left py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors rounded-lg px-1">
      <img 
        src={article.image || placeholderImg} 
        alt={article.title}
        className="rounded-xl object-cover shrink-0" 
        style={{ width: 68, height: 68 }}
        onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }}
      />
      <div className="flex-1 min-w-0">
        <CategoryBadge category={article.category} />
        <p className="mt-1" style={{ fontSize: 12, fontWeight: 700, lineHeight: "1.35", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <p className="mt-1" style={{ fontSize: 11, color: "#999" }}>{article.publishedAt}</p>
      </div>
    </button>
  );
}

// Standard list card
function ArticleCard({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60";
  return (
    <button onClick={onClick}
      className="w-full flex gap-3 items-start text-left py-4 border-b border-neutral-100 active:bg-neutral-50 transition-colors">
      <img 
        src={article.image || placeholderImg} 
        alt={article.title}
        className="rounded-xl object-cover shrink-0" 
        style={{ width: 80, height: 80 }}
        onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }}
      />
      <div className="flex-1 min-w-0">
        <CategoryBadge category={article.category} />
        <p className="mt-1" style={{ fontSize: 14, fontWeight: 700, lineHeight: "1.35", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {displayTitle ?? article.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock size={10} className="text-neutral-400" />
          <span className="text-neutral-400" style={{ fontSize: 11 }}>{article.readTime} mnt · {article.publishedAt}</span>
        </div>
      </div>
    </button>
  );
}

function ArticleRow({ article, onClick, displayTitle }: { article: Article; onClick: () => void; displayTitle?: string }) {
  const placeholderImg = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=60";
  return (
    <button onClick={onClick}
      className="shrink-0 text-left rounded-2xl overflow-hidden bg-white shadow-sm active:scale-[0.97] transition-transform"
      style={{ width: 190 }}>
      <img 
        src={article.image || placeholderImg} 
        alt={article.title} 
        className="w-full object-cover" 
        style={{ height: 105 }}
        onError={(e) => { (e.target as HTMLImageElement).src = placeholderImg; }} 
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
  const allArticles = fetchedArticles.length > 0 ? fetchedArticles : ARTICLES;
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    if (allArticles.length === 0) return;
    const untranslated = allArticles.filter(a => needsTranslation(a.title) && !translatedIdsRef.current.has(a.id));
    if (untranslated.length === 0) return;
    untranslated.forEach(a => translatedIdsRef.current.add(a.id));
    translateTitles(untranslated).then(map => {
      if (Object.keys(map).length > 0) setTranslatedTitles(prev => ({ ...prev, ...map }));
    });
  }, [allArticles.length]);

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
              <p className="text-neutral-400" style={{ fontSize: 12 }}>
                {loading ? progressMsg : hasErrors ? "Beberapa sumber gagal dimuat" : fromCache ? "Dari cache · perbarui untuk konten baru" : `${allArticles.length} artikel · baru diperbarui`}
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1 }}>Discuss</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!loading && (hasErrors ? <WifiOff size={14} className="text-neutral-400" /> : <Wifi size={14} className="text-[#ff742f]" />)}
              <button onClick={refresh} disabled={loading} className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 disabled:opacity-50">
                <RefreshCw size={16} className={`text-neutral-600 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button onClick={() => navigate("/pengaturan")} className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 lg:hidden">
                <Settings size={18} className="text-neutral-600" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-neutral-100 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-neutral-400 shrink-0" />
            <input type="text" placeholder="Cari artikel..." value={searchQuery}
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
        {!loading && hasErrors && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
            <WifiOff size={14} className="text-amber-500 shrink-0" />
            <p style={{ fontSize: 12, color: "#92400e" }}>{Object.keys(errors).length} sumber gagal dimuat.</p>
          </div>
        )}

        {loading && (
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

        {!loading && (
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
                <div className="shrink-0 pt-5 pr-4" style={{ width: 300 }}>
                  <div className="sticky top-[120px]">
                    <h2 className="mb-3 flex items-center gap-1.5" style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>
                      🔥 Terbaru
                    </h2>
                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-3 py-1">
                      {sidebarArticles.map(a => (
                        <SidebarItem key={a.id} article={a} onClick={() => goToArticle(a.id)} displayTitle={getTitle(a)} />
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