import { useState } from "react";
import { useNavigate } from "react-router";
import { Search, Bookmark } from "lucide-react";
import { ARTICLES, type Article } from "../data/articles";

const CATEGORIES = [
  {
    id: "anime",
    name: "ANIME",
    icon: "🎨",
    color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    description: "Anime Terbaru & Trending"
  },
  {
    id: "manga",
    name: "MANGA",
    icon: "📚",
    color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    description: "Update Manga Mingguan"
  },
  {
    id: "games",
    name: "GAMES",
    icon: "🎮",
    color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    description: "Game & Gaming News"
  },
  {
    id: "cosplay",
    name: "COSPLAY",
    icon: "👘",
    color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    description: "Cosplay & Community"
  },
  {
    id: "reviews",
    name: "REVIEWS",
    icon: "⭐",
    color: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    description: "Review & Analisis"
  },
  {
    id: "news",
    name: "BERITA",
    icon: "📰",
    color: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    description: "Breaking News & Trending"
  }
];

const POPULAR_TAGS = [
  "#GenshinImpact", "#OnePiec", "#JujutsuKaisen", "#DanDaDan",
  "#ArcaneActTwo", "#WindbreakerMovie", "#AnimeSeasonan",
  "#MangaNew", "#CosplayContest", "#AnimeShowdown"
];

interface CategoryGridCardProps {
  category: (typeof CATEGORIES)[0];
  onClick: () => void;
}

function CategoryGridCard({ category, onClick }: CategoryGridCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-full aspect-square rounded-2xl overflow-hidden group cursor-pointer"
      style={{ backgroundImage: category.color, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span style={{ fontSize: 48 }} className="mb-2">{category.icon}</span>
        <h3 className="text-white font-bold" style={{ fontSize: 18, lineHeight: 1.2 }}>
          {category.name}
        </h3>
        <p className="text-white/80 text-xs mt-1.5" style={{ fontSize: 11 }}>
          {category.description}
        </p>
      </div>
    </button>
  );
}

export function ExplorePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      setIsSearching(true);
      const results = ARTICLES.filter(a =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.summary.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredArticles(results);
    } else {
      setIsSearching(false);
      setFilteredArticles([]);
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/?category=${categoryId}`);
  };

  const handleTagClick = (tag: string) => {
    handleSearch(tag.replace("#", ""));
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-100">
        <div className="px-4 pt-4 pb-4">
          <div className="mb-3">
            <p className="text-neutral-400" style={{ fontSize: 13 }}>
              Temukan konten favorit ☕
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1 }}>Rak Koleksi</h1>
          </div>
          <div className="flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-2.5">
            <Search size={15} className="text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Cari judul anime, karakter, atau game..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="flex-1 bg-transparent text-neutral-800 placeholder-neutral-400 focus:outline-none"
              style={{ fontSize: 14 }}
            />
          </div>
        </div>

        {/* Tag Pills */}
        {!isSearching && (
          <div className="px-4 pb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {POPULAR_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="shrink-0 px-3 py-1.5 rounded-full text-sm transition-all hover:bg-[#ff742f] hover:text-white"
                style={{ fontSize: 12, fontWeight: 600, background: "#f0ede9", color: "#555" }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-24 lg:pb-6">
        {isSearching ? (
          // Search Results
          <div className="px-4 pt-5">
            <p className="text-neutral-500 mb-4" style={{ fontSize: 13 }}>
              {filteredArticles.length} hasil untuk "{searchQuery}"
            </p>
            {filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                <p style={{ fontSize: 40 }}>🔍</p>
                <p style={{ fontSize: 15, fontWeight: 600 }} className="mt-2">
                  Tidak ada hasil ditemukan
                </p>
                <p style={{ fontSize: 13 }} className="mt-1">
                  Coba kata kunci lain
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {filteredArticles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => navigate(`/artikel/${article.id}`)}
                    className="w-full flex gap-4 items-start text-left py-4 border-b border-neutral-100 active:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="inline-block" style={{ fontSize: 12, fontWeight: 700, color: "#ff742f", letterSpacing: "0.04em" }}>
                        {article.source}
                      </p>
                      <p className="mt-1" style={{ fontSize: 15, fontWeight: 700, lineHeight: "1.35", color: "#1a1a1a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.title}
                      </p>
                      <p className="mt-1.5 text-neutral-500" style={{ fontSize: 13, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.summary}
                      </p>
                    </div>
                    <img
                      src={article.image || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60"}
                      alt={article.title}
                      className="rounded-lg object-cover shrink-0"
                      style={{ width: 100, height: 80 }}
                      onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60"; }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Category Grid View
          <>
            <div className="px-4 pt-5 pb-8">
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>
                Jelajahi Kategori
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {CATEGORIES.map(category => (
                  <CategoryGridCard
                    key={category.id}
                    category={category}
                    onClick={() => handleCategoryClick(category.id)}
                  />
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="px-4 py-8 border-t border-neutral-200 bg-white">
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>
                Rekomendasi Cafe
              </h2>
              <p className="text-neutral-500 text-center" style={{ fontSize: 13 }}>
                👉 Terjelajahi kategori di atas untuk menemukan konten yang kamu sukai!
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
