import { useMemo, useState, useEffect } from "react";
import { Bookmark, Check, Clock3, Flame, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { CATEGORIES, type Article } from "../data/articles";
import { useNews } from "../hooks/useNews";
import { articleStore } from "../store/articleStore";
import { ArticleReaderModal } from "./ArticleReaderModal";

type FeedFilter = "all" | "unread" | "saved";

function relativeLabel(article: Article) {
  return article.publishedAt || "Baru saja";
}

function FeedRow({ article, onOpen, refresh }: { article: Article; onOpen: () => void; refresh: () => void }) {
  const [saved, setSaved] = useState(() => articleStore.isSaved(article.id));
  const [read, setRead] = useState(() => articleStore.isRead(article.id));
  useEffect(() => articleStore.subscribe(() => {
    setSaved(articleStore.isSaved(article.id));
    setRead(articleStore.isRead(article.id));
  }), [article.id]);

  return (
    <article className="flex gap-3 py-4 border-b border-neutral-100">
      <button onClick={onOpen} className="flex flex-1 min-w-0 gap-3 text-left active:opacity-70">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold tracking-wide uppercase text-neutral-500">{article.source}</p>
          <h3 className={`mt-1 text-[15px] leading-[1.35] font-semibold ${read ? "text-neutral-500" : "text-neutral-900"}`}>{article.title}</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500 line-clamp-2">{article.summary}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Clock3 size={12} /><span>{relativeLabel(article)}</span><span>·</span><span>{article.readTime} mnt</span>
          </div>
        </div>
        {article.image && !article.image.includes("favicon") && (
          <img src={article.image} alt="" loading="lazy" className="w-[92px] h-[78px] rounded-xl object-cover bg-neutral-100 shrink-0"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
        )}
      </button>
      <div className="flex flex-col gap-2">
        <button aria-label={saved ? "Hapus dari tersimpan" : "Simpan artikel"} onClick={() => { articleStore.toggleSave(article.id); refresh(); }}
          className={`w-8 h-8 rounded-full grid place-items-center ${saved ? "bg-orange-50 text-orange-600" : "bg-neutral-50 text-neutral-400"}`}>
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
        </button>
        <button aria-label={read ? "Tandai belum dibaca" : "Tandai sudah dibaca"} onClick={() => { articleStore.toggleRead(article.id); refresh(); }}
          className={`w-8 h-8 rounded-full grid place-items-center ${read ? "bg-emerald-50 text-emerald-600" : "bg-neutral-50 text-neutral-400"}`}>
          <Check size={16} />
        </button>
      </div>
    </article>
  );
}

export function FoloMobileHome() {
  const { articles, loading, errors, refresh } = useNews();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [, setRevision] = useState(0);
  const bump = () => setRevision(n => n + 1);

  useEffect(() => articleStore.subscribe(bump), []);

  const visible = useMemo(() => articles.filter(article => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || article.title.toLowerCase().includes(q) || article.summary.toLowerCase().includes(q) || article.source.toLowerCase().includes(q);
    const matchesCategory = category === "Semua" || article.category === category;
    const matchesFilter = filter === "all" || (filter === "unread" && !articleStore.isRead(article.id)) || (filter === "saved" && articleStore.isSaved(article.id));
    return matchesQuery && matchesCategory && matchesFilter;
  }), [articles, query, category, filter]);

  const featured = visible.find(article => article.hot) ?? visible[0];

  return (
    <div className="min-h-screen bg-white text-neutral-900 pb-[calc(88px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/95 backdrop-blur-xl">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-orange-600">Otaku Cafe</p>
              <h1 className="mt-1 text-[25px] font-bold tracking-tight">Your feed<span className="text-orange-500">.</span></h1>
            </div>
            <button aria-label="Refresh feed" onClick={refresh} className="w-10 h-10 rounded-full bg-neutral-100 grid place-items-center active:scale-95">
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2.5 rounded-2xl bg-neutral-100 px-3.5 py-3">
            <Search size={17} className="text-neutral-400 shrink-0" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari anime, manga, game..." className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400" />
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {([{id:"all",label:"Semua"},{id:"unread",label:"Belum dibaca"},{id:"saved",label:"Tersimpan"}] as const).map(item => (
            <button key={item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${filter === item.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}>{item.label}</button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {CATEGORIES.map(item => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${category === item ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200" : "text-neutral-500"}`}>{item}</button>)}
        </div>
      </header>

      <main className="px-4">
        {featured && filter === "all" && !query && category === "Semua" && (
          <button onClick={() => { articleStore.markRead(featured.id); setActiveArticle(featured); }} className="mt-5 w-full text-left">
            <div className="flex items-center gap-1.5 text-orange-600 text-xs font-bold"><Flame size={14} /> HIGHLIGHT</div>
            <div className="mt-3 overflow-hidden rounded-2xl bg-neutral-100">
              {featured.image && <img src={featured.image} alt="" className="w-full aspect-[16/9] object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
              <div className="bg-neutral-50 p-4">
                <p className="text-[10px] font-bold tracking-widest uppercase text-orange-600">{featured.category} · {featured.source}</p>
                <h2 className="mt-2 text-[19px] leading-snug font-bold">{featured.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500 line-clamp-2">{featured.summary}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400"><Sparkles size={13} /> {featured.readTime} menit membaca</div>
              </div>
            </div>
          </button>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">{filter === "unread" ? "Belum dibaca" : filter === "saved" ? "Tersimpan" : "Terbaru"}</h2>
            <p className="mt-0.5 text-xs text-neutral-400">{visible.length} artikel</p>
          </div>
          <button onClick={refresh} className="text-xs font-semibold text-orange-600">Perbarui</button>
        </div>

        {loading && articles.length === 0 && <div className="py-12 text-center text-sm text-neutral-400">Memuat feed kamu…</div>}
        {!loading && visible.length === 0 && <div className="py-12 text-center"><p className="text-sm font-semibold">Belum ada artikel di sini</p><p className="mt-1 text-xs text-neutral-400">Coba filter lain atau perbarui feed.</p></div>}
        {visible.filter(article => article.id !== featured?.id || filter !== "all" || query || category !== "Semua").map(article => (
          <FeedRow key={article.id} article={article} onOpen={() => { articleStore.markRead(article.id); setActiveArticle(article); }} refresh={bump} />
        ))}
        {Object.keys(errors).length > 0 && <p className="py-3 text-xs text-amber-700">{Object.keys(errors).length} sumber mengalami kendala saat dimuat.</p>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-100 bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[62px] max-w-lg items-center justify-around px-3">
          <button onClick={() => { setFilter("all"); setCategory("Semua"); setQuery(""); }} className="flex flex-col items-center gap-1 text-orange-600"><Sparkles size={20}/><span className="text-[10px] font-semibold">Feed</span></button>
          <button onClick={() => setFilter("unread")} className={`flex flex-col items-center gap-1 ${filter === "unread" ? "text-orange-600" : "text-neutral-400"}`}><Check size={20}/><span className="text-[10px] font-semibold">Unread</span></button>
          <button onClick={() => setFilter("saved")} className={`flex flex-col items-center gap-1 ${filter === "saved" ? "text-orange-600" : "text-neutral-400"}`}><Bookmark size={20}/><span className="text-[10px] font-semibold">Saved</span></button>
        </div>
      </nav>
      <ArticleReaderModal article={activeArticle} isOpen={!!activeArticle} onClose={() => setActiveArticle(null)} />
    </div>
  );
}
