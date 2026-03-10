import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Clock, Share2, Bookmark, Sparkles,
  RefreshCw, ExternalLink, Edit3,
} from "lucide-react";
import { articleStore } from "../store/articleStore";
import { rewriteArticleOnDemand, getCachedRewrite, getAIConfig } from "../services/rewriter";
import { fetchArticleContent } from "../services/newsFetcher";
import type { Article } from "../data/articles";

// ── Google Translate helper ──────────────────────────────────────────────────
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

async function translateArticleContent(article: Article): Promise<Article> {
  const [title, summary, ...contentParts] = await Promise.all([
    gtranslate(article.title),
    gtranslate(article.summary ?? ""),
    ...( article.content ?? []).map(p => gtranslate(p)),
  ]);
  return { ...article, title, summary, content: contentParts };
}

const CATEGORY_COLORS: Record<string, string> = {
  "Hot Topic": "#ff742f", "Breaking": "#e53e3e", "Trending": "#805ad5",
  "Discuss": "#2b6cb0", "Opinion": "#2f855a", "Analisis": "#b7791f",
  "Review": "#c05621", "Exclusive": "#1a202c",
};


type RawArticle = Article & { originalUrl?: string };

function RelatedCard({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex gap-3 items-start text-left group w-full">
      <img src={article.image} alt={article.title}
        className="rounded-xl object-cover shrink-0 group-hover:opacity-90 transition-opacity"
        style={{ width: 80, height: 64 }}
        onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=60"; }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: "1.35",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {article.title}
        </p>
        <p className="mt-1 text-neutral-400" style={{ fontSize: 11 }}>{article.publishedAt}</p>
      </div>
    </button>
  );
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const rawArticle = articleStore.findById(id ?? "") as RawArticle | undefined;
  const originalUrl = rawArticle?.originalUrl;

  const [displayArticle, setDisplayArticle] = useState<Article | null>(rawArticle ?? null);
  const [isAIMode, setIsAIMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(() => articleStore.isSaved(id ?? ""));
  const [isTranslated, setIsTranslated] = useState(false);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translatedArticle, setTranslatedArticle] = useState<Article | null>(null);

  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Scroll to top whenever article changes
    window.scrollTo({ top: 0, behavior: "instant" });
    setDisplayArticle(rawArticle ?? null);
    setIsAIMode(false); setAiError(null);
    setContentLoading(false);
    setIsTranslated(false); setTranslatedArticle(null);
  }, [id]);

  useEffect(() => {
    if (!rawArticle || fetchedRef.current === rawArticle.id) return;
    // Only skip fetch if we have substantial content (>3 paragraphs)
    if ((rawArticle.content?.length ?? 0) >= 4) { fetchedRef.current = rawArticle.id; return; }
    if (!originalUrl) return;
    fetchedRef.current = rawArticle.id;
    setContentLoading(true);
    fetchArticleContent(originalUrl).then(result => {
      if (!result || !result.content.length) return;
      const updated: Article = {
        ...rawArticle, content: result.content,
        summary: result.summary ?? rawArticle.summary,
        image: result.image?.startsWith("http") ? result.image : rawArticle.image,
        readTime: Math.max(1, Math.ceil(result.content.join(" ").split(/\s+/).length / 200)),
      };
      setDisplayArticle(updated);
      articleStore.updateById(rawArticle!.id, updated);
    }).finally(() => setContentLoading(false));
  }, [rawArticle?.id]);

  if (!rawArticle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p style={{ fontSize: 40 }}>📭</p>
        <p style={{ fontSize: 16, fontWeight: 700 }}>Artikel tidak ditemukan</p>
        <button onClick={() => navigate("/")} className="px-4 py-2 rounded-full bg-[#ff742f] text-white" style={{ fontSize: 14, fontWeight: 600 }}>
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const article = displayArticle ?? rawArticle;
  const catColor = CATEGORY_COLORS[article.category] ?? "#555";
  const aiConfig = getAIConfig();
  const hasApiKey = !!aiConfig.apiKey;

  async function handleAIRewrite() {
    if (!hasApiKey || !rawArticle) { setAiError("API key belum diset. Buka Pengaturan."); return; }
    const cached = getCachedRewrite(rawArticle.id);
    if (cached && isAIMode) {
      setDisplayArticle(rawArticle!);
      setIsAIMode(false); return;
    }
    if (cached && !isAIMode) { setDisplayArticle(cached); setIsAIMode(true); return; }
    setAiLoading(true); setAiError(null);
    try {
      const rewritten = await rewriteArticleOnDemand((displayArticle ?? rawArticle)!);
      setDisplayArticle(rewritten); setIsAIMode(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Gagal menulis ulang");
    } finally { setAiLoading(false); }
  }

  function handleSave() {
    if (!rawArticle) return;
    const saved = articleStore.toggleSave(rawArticle.id);
    setIsSaved(saved);
  }

  async function handleTranslate() {
    if (!rawArticle) return;
    if (isTranslated) {
      // Toggle back to original
      setDisplayArticle(rawArticle);
      setIsTranslated(false);
      return;
    }
    if (translatedArticle) {
      setDisplayArticle(translatedArticle);
      setIsTranslated(true);
      return;
    }
    setTranslateLoading(true);
    try {
      const src = displayArticle ?? rawArticle;
      const translated = await translateArticleContent(src);
      setTranslatedArticle(translated);
      setDisplayArticle(translated);
      setIsTranslated(true);
    } finally {
      setTranslateLoading(false);
    }
  }

  const related = articleStore.get()
    .filter(a => a.category === article.category && a.id !== article.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Sticky floating top bar ─────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{ height: 60, pointerEvents: "none" }}
      >
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded-full text-white transition-colors active:opacity-70"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)", pointerEvents: "auto" }}
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Kembali</span>
        </button>

        {/* Right action buttons */}
        <div className="flex gap-2" style={{ pointerEvents: "auto" }}>
          {originalUrl && (
            <a href={originalUrl} target="_blank" rel="noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)" }}>
              <ExternalLink size={16} className="text-white" />
            </a>
          )}
          <button
            onClick={handleSave}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: isSaved ? "rgba(255,116,47,0.9)" : "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)" }}>
            <Bookmark size={16} color="white" fill={isSaved ? "white" : "none"} />
          </button>
          <button
            onClick={handleTranslate}
            disabled={translateLoading}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: isTranslated ? "rgba(59,130,246,0.9)" : "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)" }}
          >
            {translateLoading
              ? <RefreshCw size={15} color="white" className="animate-spin" />
              : <span style={{ fontSize: 11, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
                  {isTranslated ? "ID✓" : "ID"}
                </span>
            }
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-95"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)" }}>
            <Share2 size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Full-width hero image ────────────────────────────────────────── */}
      <div className="relative w-full" style={{ height: 480 }}>
        <img src={article.image} alt={article.title}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80"; }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.65) 100%)" }} />

        {/* Category + badges */}
        <div className="absolute bottom-5 left-5 flex items-center gap-2">
          <span className="inline-block px-3 py-1 rounded-full text-white"
            style={{ background: catColor, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
            {article.category.toUpperCase()}
          </span>
          {isAIMode && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(124,58,237,0.85)", color: "white", fontSize: 11, fontWeight: 700 }}>
              <Sparkles size={10} />AI
            </span>
          )}
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex gap-10">
          {/* ── Main content (left) ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <div className="flex items-center gap-1.5 text-neutral-400">
                <Clock size={12} />
                <span style={{ fontSize: 12 }}>{article.readTime} menit baca</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-neutral-200" />
              <span className="text-neutral-400" style={{ fontSize: 12 }}>{article.publishedAt}</span>
              <div className="w-1 h-1 rounded-full bg-neutral-200" />
              <span className="text-neutral-400 truncate max-w-[160px]" style={{ fontSize: 12 }}>{article.source}</span>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a1a", lineHeight: "1.3" }}>
              {article.title}
            </h1>

            {/* Summary */}
            {article.summary && article.summary !== article.title && (
              <p className="mt-4 p-4 rounded-xl"
                style={{ fontSize: 14, color: "#555", lineHeight: "1.7", background: "#fff8f4", borderLeft: "3px solid " + catColor }}>
                {article.summary}
              </p>
            )}

            <div className="my-5 border-t border-neutral-100" />

            {/* AI button */}
            {hasApiKey ? (
              <button onClick={handleAIRewrite} disabled={aiLoading}
                className="w-full mb-5 flex items-center justify-between px-4 py-3.5 rounded-2xl active:opacity-80 disabled:opacity-60 transition-all"
                style={{ background: isAIMode ? "linear-gradient(135deg,#7c3aed,#a78bfa)" : "linear-gradient(135deg,#ff742f,#ff9a5c)" }}>
                <div className="flex items-center gap-3">
                  {aiLoading ? <RefreshCw size={16} className="text-white animate-spin" /> : <Sparkles size={16} className="text-white" />}
                  <div className="text-left">
                    <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                      {aiLoading ? "Sedang menulis ulang..." : isAIMode ? "Lihat Artikel Asli" : "Buat Artikel dengan AI"}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>
                      {aiLoading ? "Mohon tunggu..." : isAIMode ? "Kembali ke sumber asli" : "Terjemahkan & tulis ulang ke Bahasa Indonesia"}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{isAIMode ? "Asli" : "AI"}</span>
              </button>
            ) : (
              <button onClick={() => navigate("/pengaturan")}
                className="w-full mb-5 flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-neutral-200 hover:border-[#ff742f] transition-colors">
                <Sparkles size={16} className="text-neutral-400" />
                <div className="text-left">
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>Aktifkan AI Rewriter</p>
                  <p style={{ fontSize: 11, color: "#999" }}>Tambah API key di Pengaturan</p>
                </div>
              </button>
            )}

            {aiError && (
              <div className="mb-5 px-4 py-3 rounded-2xl flex flex-col gap-2" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <p style={{ fontSize: 12, color: "#dc2626", lineHeight: "1.6" }}>{aiError}</p>
                <button onClick={() => navigate("/pengaturan")}
                  className="self-start px-3 py-1.5 rounded-lg text-white font-bold"
                  style={{ background: "#dc2626", fontSize: 11 }}>
                  Buka Pengaturan →
                </button>
              </div>
            )}

            {isAIMode && !aiLoading && (
              <button onClick={() => navigate("/editor", { state: { titleHtml: article.title, bgUrl: article.image } })}
                className="w-full mb-5 flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-transform active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e)", color: "white" }}>
                <Edit3 size={16} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Buat Post dari Artikel Ini</span>
              </button>
            )}

            {/* Article body */}
            {contentLoading ? (
              <div className="flex flex-col gap-3 py-4">
                {[100, 95, 80, 100, 70, 90].map((w, i) => (
                  <div key={i} className="rounded animate-pulse" style={{ height: 14, background: "#f5f5f5", width: w + "%" }} />
                ))}
              </div>
            ) : article.content?.length > 0 ? (
              <div className="flex flex-col gap-5">
                {article.content.map((p, i) => (
                  <p key={i} style={{ fontSize: 15, color: "#333", lineHeight: "1.8", textAlign: "justify" as const }}>{p}</p>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12">
                <p style={{ fontSize: 36 }}>📄</p>
                <p style={{ fontSize: 14, color: "#888", textAlign: "center" }}>Konten tidak tersedia.</p>
                {originalUrl && (
                  <a href={originalUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full"
                    style={{ background: "#ff742f", color: "white", fontSize: 13, fontWeight: 600 }}>
                    <ExternalLink size={14} /> Buka Artikel Asli
                  </a>
                )}
              </div>
            )}

            {/* Source footer */}
            <div className="mt-8 pt-5 border-t border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center" style={{ fontSize: 12 }}>📰</div>
                <span className="text-neutral-500" style={{ fontSize: 13, fontWeight: 600 }}>{rawArticle.source}</span>
              </div>
              {originalUrl && (
                <a href={originalUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[#ff742f] hover:underline" style={{ fontSize: 13, fontWeight: 600 }}>
                  <ExternalLink size={13} /> Artikel Asli
                </a>
              )}
            </div>
          </div>

          {/* ── Sidebar: Related articles (desktop only) ─────────────────── */}
          {related.length > 0 && (
            <div className="hidden lg:block shrink-0" style={{ width: 280 }}>
              <div className="sticky top-24">
                <h3 className="mb-4" style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>
                  Artikel Terkait
                </h3>
                <div className="flex flex-col gap-4">
                  {related.map(a => (
                    <RelatedCard key={a.id} article={a} onClick={() => navigate("/artikel/" + a.id)} />
                  ))}
                </div>

                {/* Back to home */}
                <button onClick={() => navigate("/")}
                  className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-neutral-200 hover:border-[#ff742f] hover:text-[#ff742f] transition-colors"
                  style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>
                  <ArrowLeft size={14} /> Kembali ke Beranda
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Mobile: related articles ─────────────────────────────────── */}
        {related.length > 0 && (
          <div className="lg:hidden mt-8 pt-6 border-t border-neutral-100">
            <h3 className="mb-4" style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>Artikel Terkait</h3>
            <div className="flex flex-col gap-4">
              {related.map(a => (
                <RelatedCard key={a.id} article={a} onClick={() => navigate("/artikel/" + a.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-16 lg:hidden" />
    </div>
  );
}