import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Clock, Share2, Bookmark, Sparkles,
  RefreshCw, ExternalLink, Edit3, Languages, Copy, Check, X,
} from "lucide-react";
import { articleStore } from "../store/articleStore";
import { rewriteArticleOnDemand, getCachedRewrite, getAIConfig } from "../services/rewriter";
import { fetchArticleContent } from "../services/newsFetcher";
import { proxyImgInHtml } from "../services/fetcherUtils";
import type { Article } from "../data/articles";

// ── Image proxy — semua gambar cross-origin diload via server agar COEP tidak blokir
function proxyImg(src: string): string {
  if (!src) return src;
  // Jika sudah lokal atau data URI, tidak perlu proxy
  if (src.startsWith('/') || src.startsWith('data:')) return src;
  return '/api/img?url=' + encodeURIComponent(src);
}

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

// ── Translate contentHtml (ekstrak teks paragraf → translate → masukkan kembali)
async function translateHtml(html: string): Promise<string> {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = Array.from(doc.querySelectorAll("p, h2, h3, h4, li, figcaption, blockquote"));
  if (nodes.length === 0) return html;
  const originals = nodes.map(n => n.textContent?.trim() ?? "").filter(t => t.length > 3);
  const translated = await Promise.allSettled(originals.map(t => gtranslate(t)));
  let idx = 0;
  for (const node of nodes) {
    const orig = node.textContent?.trim() ?? "";
    if (orig.length <= 3) continue;
    const res = translated[idx++];
    if (res.status === "fulfilled" && res.value && res.value !== orig) {
      node.textContent = res.value;
    }
  }
  return doc.body.innerHTML;
}

async function translateArticleContent(article: Article): Promise<Article> {
  const textsToTranslate: string[] = [
    article.title,
    article.summary ?? "",
    ...(article.content ?? []),
  ];

  const blockTextIndices: number[] = [];
  if (article.blocks?.length) {
    article.blocks.forEach((b) => {
      if (b.type === 'text' && b.text) {
        blockTextIndices.push(textsToTranslate.length);
        textsToTranslate.push(b.text);
      }
    });
  }

  const translated = await Promise.all(textsToTranslate.map(t => gtranslate(t)));

  const [title, summary, ...rest] = translated;
  const contentTranslated = rest.slice(0, article.content?.length ?? 0);
  const blockTexts = rest.slice(article.content?.length ?? 0);

  let translatedBlocks = article.blocks;
  if (article.blocks?.length && blockTexts.length) {
    let btIdx = 0;
    translatedBlocks = article.blocks.map(b => {
      if (b.type === 'text' && b.text) {
        return { ...b, text: blockTexts[btIdx++] ?? b.text };
      }
      return b;
    });
  }

  // Juga translate contentHtml jika ada
  const contentHtml = (article as any).contentHtml;
  const translatedHtml = contentHtml ? await translateHtml(contentHtml) : undefined;

  return {
    ...article,
    title,
    summary,
    content: contentTranslated,
    blocks: translatedBlocks,
    ...(translatedHtml ? { contentHtml: translatedHtml } : {}),
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  "Hot Topic": "#ff742f", "Breaking": "#e53e3e", "Trending": "#805ad5",
  "Discuss": "#2b6cb0", "Opinion": "#2f855a", "Analisis": "#b7791f",
  "Review": "#c05621", "Exclusive": "#1a202c",
};



function RelatedCard({ article, onClick }: { article: Article; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex gap-3 items-start text-left group w-full">
      <img src={proxyImg(article.image)} alt={article.title}
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

  const rawArticle = articleStore.findById(id ?? "") as Article | undefined;
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
  // AI popup state
  const [aiPopup, setAiPopup] = useState<Article | null>(null);
  const [aiCopied, setAiCopied] = useState(false);

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
    fetchedRef.current = rawArticle.id;

    // Tidak ada URL asli → tidak bisa fetch lebih lanjut
    if (!originalUrl) return;

    // SELALU coba fetch artikel penuh dari URL asli, kecuali:
    // source secara eksplisit menandai kontennya sudah lengkap (rssContentSufficient dari config, bukan auto-flag)
    // Catatan: rssContentSufficient yang di-set otomatis via scoreContent TIDAK dipercaya
    // karena RSS teaser bisa saja sudah >800 char namun tetap hanya summary.
    // Satu-satunya pengecualian adalah jika artikel ini sudah pernah di-fetch sebelumnya
    // (ditandai dengan adanya contentHtml DAN rssContentSufficient = true secara bersamaan setelah fetch sukses)
    const alreadyFullyFetched = (rawArticle as any).contentHtml && (rawArticle as any)._fullFetched === true;
    if (alreadyFullyFetched) return;

    // Tampilkan RSS content dulu sebagai preview (tanpa skeleton) sambil fetch di background
    // Hanya tampilkan skeleton jika belum ada konten sama sekali
    const hasAnyContent = !!(rawArticle as any).contentHtml || (rawArticle.content?.length ?? 0) > 0;
    if (!hasAnyContent) setContentLoading(true);

    fetchArticleContent(originalUrl).then(result => {
      if (!result || (!result.contentHtml && !result.content.length)) {
        // Fetch gagal — buat minimal dari summary jika belum ada konten
        if (!(rawArticle as any).contentHtml && rawArticle.summary && rawArticle.summary !== rawArticle.title) {
          const updated: Article = {
            ...rawArticle,
            contentHtml: `<p>${rawArticle.summary}</p>`,
          };
          setDisplayArticle(updated);
          articleStore.updateById(rawArticle!.id, updated);
        }
        return;
      }

      // Hitung panjang konten (teks saja, tanpa tag)
      const fetchedTextLen = (result.contentHtml ?? "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
      const rssTextLen = ((rawArticle as any).contentHtml ?? "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

      // Hitung jumlah gambar di hasil fetch (gambar itu nilai tambah, bukan hanya teks)
      const fetchedImgCount = ((result.contentHtml ?? "").match(/<img[^>]+src=/gi) ?? []).length;

      // Replace RSS content jika:
      // (a) Fetch lebih panjang dari RSS, ATAU
      // (b) Fetch sama panjang tapi punya lebih banyak gambar, ATAU
      // (c) RSS belum punya konten sama sekali
      const rssHasNoContent = rssTextLen < 100;
      const fetchIsBetter = fetchedTextLen > rssTextLen * 0.5; // toleransi 50%
      const fetchHasImages = fetchedImgCount > 0 && rssTextLen < 3000; // upgrade jika ada gambar dan RSS belum sangat panjang

      if (!rssHasNoContent && !fetchIsBetter && !fetchHasImages) return;

      const wordCount = Math.ceil(fetchedTextLen / 5 / 200);
      const updated: Article = {
        ...rawArticle,
        originalUrl: rawArticle.originalUrl,
        content: result.content,
        summary: result.summary ?? rawArticle.summary,
        image: result.image?.startsWith("http") ? result.image : rawArticle.image,
        contentHtml: result.contentHtml,
        rssContentSufficient: true,
        readTime: Math.max(1, wordCount),
        _fullFetched: true, // tandai sudah di-fetch penuh, tidak perlu fetch lagi
      } as any;
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
    if (cached) { setAiPopup(cached); return; }
    setAiLoading(true); setAiError(null);
    try {
      const rewritten = await rewriteArticleOnDemand((displayArticle ?? rawArticle)!);
      setAiPopup(rewritten);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Gagal menulis ulang");
    } finally { setAiLoading(false); }
  }

  function handleAICopyContent() {
    if (!aiPopup) return;
    const text = [aiPopup.title, "", ...(aiPopup.content ?? [])].join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 2000);
    });
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
                : <Languages size={17} color="white" />
              }
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-95"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(12px)" }}>
            <Share2 size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Full-width hero image — 16:9 di mobile, fixed 480px di desktop ────── */}
      <div className="relative w-full md:h-[480px]" style={{ aspectRatio: '16/9' }}
        onLoad={() => {}}
        ref={el => { if (el && window.innerWidth >= 768) { el.style.aspectRatio = 'unset'; el.style.height = '480px'; } }}>
        <img src={proxyImg(article.image)} alt={article.title}
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

            <div className="my-5 border-t border-neutral-100" />

            {/* AI button */}
            {hasApiKey ? (
              <button onClick={handleAIRewrite} disabled={aiLoading}
                className="w-full mb-5 flex items-center justify-between px-4 py-3.5 rounded-2xl active:opacity-80 disabled:opacity-60 transition-all"
                style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)" }}>
                <div className="flex items-center gap-3">
                  {aiLoading ? <RefreshCw size={16} className="text-white animate-spin" /> : <Sparkles size={16} className="text-white" />}
                  <div className="text-left">
                    <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                      {aiLoading ? "Sedang menulis ulang..." : "Buat Artikel dengan AI"}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>
                      {aiLoading ? "Mohon tunggu..." : "Terjemahkan & tulis ulang ke Bahasa Indonesia"}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>AI</span>
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

            {/* ── AI Result Popup ─────────────────────────────────────────── */}
            {aiPopup && (
              <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
                onClick={(e) => { if (e.target === e.currentTarget) setAiPopup(null); }}>
                <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
                  style={{ maxHeight: "85vh" }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)" }}>
                        <Sparkles size={13} color="white" />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a" }}>Hasil AI</span>
                    </div>
                    <button onClick={() => setAiPopup(null)} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                      <X size={15} className="text-neutral-500" />
                    </button>
                  </div>
                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-5 pb-3">
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.35, marginBottom: 12 }}>
                      {aiPopup.title}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {(aiPopup.content ?? []).map((p, i) => (
                        <p key={i} style={{ fontSize: 14, color: "#444", lineHeight: 1.75 }}>{p}</p>
                      ))}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex gap-3 px-5 py-4 border-t border-neutral-100 shrink-0">
                    <button
                      onClick={handleAICopyContent}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all active:scale-95"
                      style={{ background: aiCopied ? "#22c55e" : "#f5f5f5", color: aiCopied ? "white" : "#333" }}>
                      {aiCopied ? <Check size={15} /> : <Copy size={15} />}
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{aiCopied ? "Tersalin!" : "Salin"}</span>
                    </button>
                    <button
                      onClick={() => {
                        setAiPopup(null);
                        navigate("/editor", { state: { titleHtml: aiPopup.title, bgUrl: article.image } });
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all active:scale-95"
                      style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e)", color: "white" }}>
                      <Edit3 size={15} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Buat Post</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Article body */}
            {contentLoading ? (
              <div className="flex flex-col gap-3 py-4">
                {[100, 95, 80, 100, 70, 90].map((w, i) => (
                  <div key={i} className="rounded animate-pulse" style={{ height: 14, background: "#f5f5f5", width: w + "%" }} />
                ))}
              </div>
            ) : (article as any).contentHtml ? (
              /* ── Render contentHtml: Inoreader-style HTML dengan prose CSS ── */
              <>
                <style>{`
                  .article-prose { font-size: 15px; color: #333; line-height: 1.85; }
                  .article-prose p { margin-bottom: 1.1em; text-align: justify; }
                  .article-prose h2 { font-size: 18px; font-weight: 800; color: #1a1a1a; line-height: 1.4; margin: 1.4em 0 0.5em; }
                  .article-prose h3 { font-size: 16px; font-weight: 700; color: #1a1a1a; line-height: 1.4; margin: 1.2em 0 0.4em; }
                  .article-prose h4, .article-prose h5, .article-prose h6 { font-size: 14px; font-weight: 700; color: #333; margin: 1em 0 0.3em; }
                  .article-prose img { width: 100%; max-width: 100%; border-radius: 14px; margin: 1.2em 0; object-fit: cover; display: block; }
                  .article-prose figure { margin: 1.2em 0; }
                  .article-prose figcaption { font-size: 12px; color: #888; text-align: center; margin-top: -0.6em; margin-bottom: 0.8em; font-style: italic; }
                  .article-prose blockquote { border-left: 3px solid #ff742f; padding: 0.6em 1em; margin: 1em 0; background: #fff8f4; border-radius: 0 8px 8px 0; color: #555; font-style: italic; }
                  .article-prose ul { list-style: disc; padding-left: 1.5em; margin-bottom: 1em; }
                  .article-prose ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 1em; }
                  .article-prose li { margin-bottom: 0.4em; }
                  .article-prose a { color: #ff742f; text-decoration: none; }
                  .article-prose a:hover { text-decoration: underline; }
                  .article-prose strong, .article-prose b { font-weight: 700; color: #1a1a1a; }
                  .article-prose em, .article-prose i { font-style: italic; }
                  .article-prose table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 1em 0; }
                  .article-prose th { background: #f5f5f5; font-weight: 700; padding: 8px; border: 1px solid #e5e5e5; }
                  .article-prose td { padding: 7px 8px; border: 1px solid #e5e5e5; }
                  .article-prose br { display: block; content: ""; margin-top: 0.4em; }
                  .article-prose [data-embed] { margin: 1.4em 0; }
                  .article-prose [data-embed="youtube"],
                  .article-prose [data-embed="instagram"],
                  .article-prose [data-embed="tiktok"],
                  .article-prose [data-embed="maps"] { border-radius: 14px; overflow: hidden; }
                  .article-prose [data-embed="twitter"] { border-radius: 12px; }
                  .article-prose [data-embed="spotify"],
                  .article-prose [data-embed="soundcloud"] { border-radius: 12px; }
                `}</style>
                <div
                  className="article-prose"
                  dangerouslySetInnerHTML={{ __html: proxyImgInHtml((article as any).contentHtml) }}
                />
              </>
            ) : (article.blocks && article.blocks.length > 0) ? (
              /* ── Render blocks: teks + gambar sesuai urutan artikel asli ── */
              <div className="flex flex-col gap-5">
                {article.blocks.map((block, i) => {
                  if (block.type === 'image' && block.src) {
                    const heroName = article.image?.split('/').pop()?.split('?')[0] || '';
                    const blockName = block.src?.split('/').pop()?.split('?')[0] || '';
                    if (heroName && blockName && heroName === blockName) return null;
                    return (
                      <figure key={i} className="my-2">
                        <img src={proxyImg(block.src)} alt=""
                          className="rounded-2xl w-full object-cover" style={{ maxHeight: 480 }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </figure>
                    );
                  }
                  if (block.type === 'text' && block.text) {
                    const isHeading = block.tag && /^h[1-6]$/.test(block.tag);
                    const temp = document.createElement('div');
                    temp.innerHTML = block.text;
                    temp.querySelectorAll('script,style,[onclick],[onload]').forEach(el => el.remove());
                    const cleanHtml = temp.innerHTML;
                    return isHeading ? (
                      <h2 key={i} style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', lineHeight: '1.4', marginTop: 8 }}>
                        {block.text.replace(/<[^>]+>/g, '')}
                      </h2>
                    ) : (
                      <div key={i}
                        style={{ fontSize: 15, color: '#333', lineHeight: '1.85', textAlign: 'justify' as const }}
                        dangerouslySetInnerHTML={{ __html: cleanHtml }} />
                    );
                  }
                  return null;
                })}
              </div>
            ) : article.content?.length > 0 ? (
              /* ── Fallback: render content[] string biasa ── */
              <div className="flex flex-col gap-5">
                {article.content.map((p, i) => (
                  <p key={i} style={{ fontSize: 15, color: "#333", lineHeight: "1.85", textAlign: "justify" as const }}>{p}</p>
                ))}
              </div>
            ) : (
              /* ── Last resort: tampilkan summary + tombol buka asli ── */
              <div className="flex flex-col gap-4">
                {article.summary && article.summary !== article.title && (
                  <p style={{ fontSize: 15, color: "#555", lineHeight: "1.85", textAlign: "justify" as const }}>
                    {article.summary}
                  </p>
                )}
                <div className="flex flex-col items-center gap-3 py-6 rounded-2xl" style={{ background: "#f9f9f9" }}>
                  <p style={{ fontSize: 13, color: "#888", textAlign: "center" }}>
                    Konten penuh tidak dapat dimuat secara otomatis.
                  </p>
                  {originalUrl && (
                    <a href={originalUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full"
                      style={{ background: "#ff742f", color: "white", fontSize: 13, fontWeight: 600 }}>
                      <ExternalLink size={14} /> Buka Artikel Asli
                    </a>
                  )}
                </div>
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