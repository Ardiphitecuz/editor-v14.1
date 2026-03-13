import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Trash2, CheckCircle2, Circle, BookOpen, Clock } from "lucide-react";
import { articleStore } from "../store/articleStore";
import type { Article } from "../data/articles";
import { MascotEmptyState } from "./MascotEmptyState";

type FilterTab = "all" | "unread" | "completed";

interface SavedItem {
  article: Article;
  isCompleted: boolean;
}

export function SavedPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!headerRef.current) return;
    const totalOffset = headerRef.current.offsetHeight + 84;
    document.documentElement.style.setProperty("--header-h", `${totalOffset}px`);
    return () => document.documentElement.style.removeProperty("--header-h");
  }, []);

  const loadSaved = useCallback(() => {
    const saved = articleStore.getSavedArticles();
    setItems(prev => {
      // Preserve isCompleted state for existing items
      const prevMap = Object.fromEntries(prev.map(i => [i.article.id, i.isCompleted]));
      return saved.map(a => ({ article: a, isCompleted: prevMap[a.id] ?? false }));
    });
  }, []);

  useEffect(() => {
    loadSaved();
    return articleStore.subscribe(loadSaved);
  }, [loadSaved]);

  const filtered = items.filter(item => {
    if (activeFilter === "unread") return !item.isCompleted;
    if (activeFilter === "completed") return item.isCompleted;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      {/* Header */}
      <div ref={headerRef} className="sticky top-0 z-30 border-b"
        style={{ background: "rgba(252,249,245,0.97)", backdropFilter: "blur(16px)", borderColor: "#ede8e2" }}>
        <div className="px-4 pt-4 pb-4">
          <p className="text-neutral-400" style={{ fontSize: 13 }}>Koleksi Saya</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
            Meja Saya
          </h1>
          {/* Filter Tabs */}
          <div className="flex gap-2 mt-3">
            {(["all", "unread", "completed"] as FilterTab[]).map(tab => (
              <button key={tab} onClick={() => setActiveFilter(tab)}
                className="px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: activeFilter === tab ? "#ff742f" : "#f0ede9",
                  color: activeFilter === tab ? "white" : "#6b6560",
                  fontSize: 12, fontWeight: 600,
                }}>
                {tab === "all" ? "Semua" : tab === "unread" ? "Belum Dibaca" : "Selesai"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-24 lg:pb-6 px-4 pt-4">
        {items.length === 0 ? (
          <MascotEmptyState
            expr="sedih"
            title="Belum ada artikel disimpan"
            desc="Tekan ikon bookmark saat membaca artikel untuk menyimpannya di sini"
            action={
              <button
                onClick={() => navigate("/")}
                className="px-5 py-3 rounded-2xl text-white font-bold active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)", fontSize: 13 }}
              >Baca Artikel</button>
            }
          />
        ) : filtered.length === 0 ? (
          <MascotEmptyState
            expr="tanya"
            title="Tidak ada di kategori ini"
            desc="Coba tab yang lain"
            imgSize={120}
          />
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#b0a89e", fontWeight: 600 }} className="mb-3">
              {filtered.length} artikel tersimpan
            </p>
            <div className="flex flex-col gap-3">
              {filtered.map(item => (
                <div key={item.article.id} className="bg-white rounded-2xl overflow-hidden"
                  style={{ border: "1px solid #ede8e2", opacity: item.isCompleted ? 0.65 : 1 }}>
                  {/* Article row */}
                  <button onClick={() => navigate(`/artikel/${item.article.id}`)}
                    className="w-full text-left p-4 flex gap-3 items-start">
                    <img
                      src={item.article.image || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60"}
                      alt=""
                      className="rounded-xl object-cover shrink-0"
                      style={{ width: 80, height: 64 }}
                      onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&q=60"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#ff742f", letterSpacing: "0.03em" }} className="mb-1">
                        {item.article.source}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 700, lineHeight: "1.35", color: "#1a1a1a",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.article.title}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Clock size={10} style={{ color: "#b0a89e" }} />
                        <span style={{ fontSize: 11, color: "#b0a89e" }}>{item.article.readTime} mnt baca</span>
                      </div>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center border-t px-3 py-2 gap-1" style={{ borderColor: "#f5f1ec" }}>
                    <button
                      onClick={() => setItems(prev => prev.map(i =>
                        i.article.id === item.article.id ? { ...i, isCompleted: !i.isCompleted } : i
                      ))}
                      className="flex items-center gap-1.5 flex-1 py-1.5 px-2 rounded-lg hover:bg-neutral-50 transition-colors"
                      style={{ color: item.isCompleted ? "#ff742f" : "#9ca3af" }}
                    >
                      {item.isCompleted
                        ? <><CheckCircle2 size={15} /><span style={{ fontSize: 12, fontWeight: 600 }}>Selesai</span></>
                        : <><Circle size={15} /><span style={{ fontSize: 12, fontWeight: 600 }}>Tandai Selesai</span></>}
                    </button>
                    <button
                      onClick={() => articleStore.unsaveArticle(item.article.id)}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-red-50 transition-colors"
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 size={15} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}