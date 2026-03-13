import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Readability } from "@mozilla/readability";
import { 
  X, ExternalLink, ArrowLeft, Bookmark, Languages, Share2, 
  Sparkles, RefreshCw, Check, Copy, BookmarkPlus, Edit3, Clock 
} from "lucide-react";
import type { Article } from "../data/articles";
import { PROXY_SERVERS, fetchWithTimeout, handleImgError } from "../services/fetcherUtils";
import { articleStore } from "../store/articleStore";
import { draftStore } from "../store/draftStore";
import { rewriteArticleOnDemand, getCachedRewrite, getAIConfig } from "../services/rewriter";

// ── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Hot Topic": "#ff742f", "Breaking": "#e53e3e", "Trending": "#805ad5",
  "Discuss": "#2b6cb0", "Opinion": "#2f855a", "Analisis": "#b7791f",
  "Review": "#c05621", "Exclusive": "#1a202c",
};

async function gtranslate(text: string): Promise<string> {
  try {
    const res = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=" + encodeURIComponent(text));
    if (!res.ok) return text;
    const data = await res.json();
    return (data[0] as [string, string][]).map(s => s[0]).join("") || text;
  } catch { return text; }
}

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

function cleanHTML(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

interface ArticleReaderModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ArticleReaderModal({ article, isOpen, onClose }: ArticleReaderModalProps) {
  const navigate = useNavigate();

  // ── States ───────────────────────────────────────────────────────────────
  const [displayArticle, setDisplayArticle] = useState<Article | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [contentOpacity, setContentOpacity] = useState(1);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Tools State
  const [isSaved, setIsSaved] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translatedArticle, setTranslatedArticle] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPopup, setAiPopup] = useState<Article | null>(null);
  const [aiCopied, setAiCopied] = useState(false);
  const [aiCloudUrl, setAiCloudUrl] = useState<string | null>(null);
  const [aiCloudSaving, setAiCloudSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Initialize & Auto-Fetch ─────────────────────────────────────────────
  useEffect(() => {
    const bodyEl = modalBodyRef.current;
    if (bodyEl) {
      bodyEl.scrollTop = 0;
      bodyEl.addEventListener("error", handleImgError as EventListener, true);
    }

    if (isOpen && article) {
      document.body.style.overflow = "hidden";
      setDisplayArticle(article);
      setIsSaved(articleStore.isSaved(article.id));
      setIsTranslated(false);
      setTranslatedArticle(null);

      // Selalu coba fetch konten penuh — proxy racing akan handle jika sudah ada konten
      // Tidak ada syarat panjang — biarkan loadFullContent yang memutuskan
      if (article.originalUrl) {
        loadFullContent(article);
      }
    } else {
      document.body.style.overflow = "";
      setDisplayArticle(null);
    }
    return () => { 
      document.body.style.overflow = ""; 
      if (bodyEl) bodyEl.removeEventListener("error", handleImgError as EventListener, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, article]);

  // ── Proxy Racing Engine ─────────────────────────────────────────────────
  const loadFullContent = async (targetArticle: Article) => {
    if (!targetArticle.originalUrl) return;

    setLoadingCode(true);
    setContentOpacity(0.5);

    let htmlContent: string | null = null;

    try {
      htmlContent = await new Promise<string>((resolve, reject) => {
        let errors = 0;
        const proxies = PROXY_SERVERS.map(async (proxy) => {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 15000);
          try {
            const res = await fetch(proxy.getUrl(targetArticle.originalUrl!), { signal: controller.signal });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await proxy.parse(res);
            if (text && text.length > 500) return text;
            throw new Error("too short");
          } catch (err) { clearTimeout(t); throw err; }
        });
        proxies.forEach(p => p.then(resolve).catch(() => {
          errors++;
          if (errors === proxies.length) reject(new Error("All proxies failed"));
        }));
      });
    } catch {
      console.warn("[Modal] Semua proxy gagal untuk load konten penuh.");
    }

    if (htmlContent) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");

      // Set base URL
      try {
        const baseTag = doc.createElement("base");
        baseTag.href = new URL(targetArticle.originalUrl).origin;
        doc.head.appendChild(baseTag);
      } catch {}

      // ── 1. Pulihkan lite-youtube → iframe ────────────────────────────────
      doc.querySelectorAll("lite-youtube, [data-youtube-id]").forEach(el => {
        const vid = el.getAttribute("videoid") || el.getAttribute("data-youtube-id") || el.id;
        if (!vid) return;
        const iframe = doc.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${vid}`;
        iframe.width = "100%"; iframe.height = "315";
        iframe.setAttribute("frameborder", "0"); iframe.setAttribute("allowfullscreen", "true");
        el.replaceWith(iframe);
      });

      // ── 2. Hapus selectors sampah standar ───────────────────────────────
      const junkSelectors = [
        "script", "style", "nav", "footer", "header", "aside",
        ".ads", ".ad", ".advertisement", ".sidebar", "#sidebar",
        ".related", ".recommended", ".trending", ".newsletter",
        ".social-share", ".comments", "#comments", ".footer-meta",
        ".tags", ".breadcrumb", ".cookie-notice", ".popup",
        "[class*='widget']", "[class*='promo']", "[class*='banner']"
      ];
      doc.querySelectorAll(junkSelectors.join(",")).forEach(el => el.remove());

      // ── 3. Truncate Ekstrem — cari elemen dengan keyword lalu hapus + semua saudara setelahnya ──
      const TRUNCATE_KEYWORDS = [
        "Etiquetado:", "Fuentes:", "Vía:", "Baca juga", "Baca Juga",
        "Te podría interesar", "Te podria interesar", "Leer más",
        "Tags:", "Filed under:", "Related Posts"
      ];
      const traverse = (root: Element) => {
        const children = Array.from(root.children);
        for (const child of children) {
          const txt = child.textContent?.trim() || "";
          if (TRUNCATE_KEYWORDS.some(kw => txt.startsWith(kw) || txt.includes(kw))) {
            // Hapus elemen ini dan semua saudara sesudahnya (nextElementSibling)
            let toRemove: Element | null = child;
            while (toRemove) {
              const next = toRemove.nextElementSibling;
              try { toRemove.remove(); } catch {}
              toRemove = next;
            }
            return; // Stop traversal on this branch
          }
          traverse(child);
        }
      };
      if (doc.body) traverse(doc.body);

      // ── 4. Tautan Siluman — hapus <p> dengan teks = teks link di dalamnya ─
      doc.querySelectorAll("p").forEach(p => {
        const pText = p.textContent?.trim() || "";
        if (!pText) { p.remove(); return; }
        const links = p.querySelectorAll("a");
        if (links.length === 0) return;
        const linkTexts = Array.from(links).map(a => a.textContent?.trim() || "");
        const combined = linkTexts.join("").trim();
        // Jika teks p hampir sama dengan gabungan teks link, ini tautan siluman
        if (combined.length > 0 && (pText === combined || pText.replace(/\s+/g, "") === combined.replace(/\s+/g, ""))) {
          p.remove();
        }
      });

      // ── 5. Jalankan Readability ──────────────────────────────────────────
      let finalHtml = "";
      try {
        const reader = new Readability(doc.cloneNode(true) as Document);
        const parsed = reader.parse();
        if (parsed?.content) finalHtml = parsed.content;
      } catch (err) {
        console.warn("[Modal] Readability error:", err);
      }

      if (finalHtml) {
        setDisplayArticle(prev => prev ? { ...prev, contentHtml: finalHtml, _fullFetched: true } as any : null);
      }
    }

    setLoadingCode(false);
    setContentOpacity(1);
  };


  // ── Tool Actions ────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!article) return;
    const saved = articleStore.toggleSave(article.id);
    setIsSaved(saved);
    showToast(saved ? "Tersimpan di Bookmark!" : "Dihapus dari Bookmark");
  };

  const handleTranslate = async () => {
    if (!displayArticle) return;
    if (isTranslated) {
      setDisplayArticle(article);
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
      const title = await gtranslate(displayArticle.title);
      const summary = await gtranslate(displayArticle.summary ?? "");
      const contentHtml = displayArticle.contentHtml ? await translateHtml(displayArticle.contentHtml) : undefined;
      
      const translated = { ...displayArticle, title, summary, contentHtml };
      setTranslatedArticle(translated);
      setDisplayArticle(translated);
      setIsTranslated(true);
      showToast("Teks diterjemahkan!");
    } finally {
      setTranslateLoading(false);
    }
  };

  const shareLink = async () => {
    const data = {
      title: displayArticle?.title,
      text: displayArticle?.summary ?? displayArticle?.title,
      url: displayArticle?.originalUrl ?? window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        showToast("🔗 Link artikel disalin!");
      }
    } catch {}
  };

  // ── AI Actions ──────────────────────────────────────────────────────────
  const aiConfig = getAIConfig();
  const hasApiKey = !!aiConfig.apiKey;

  const handleAIRewrite = async () => {
    if (!hasApiKey || !displayArticle) { setAiError("API key belum diset. Buka Pengaturan."); return; }
    const cached = getCachedRewrite(displayArticle.id);
    if (cached) { setAiPopup(cached); return; }
    setAiLoading(true); setAiError(null);
    try {
      const rewritten = await rewriteArticleOnDemand(displayArticle);
      setAiPopup(rewritten);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Gagal menulis ulang");
    } finally { setAiLoading(false); }
  };

  const handleAiCloudSave = async () => {
    if (!aiPopup || !displayArticle) return;
    setAiCloudSaving(true);
    try {
      const payload = {
        articleTitle: displayArticle.title,
        aiTitle: aiPopup.title,
        aiContent: aiPopup.content,
        source: displayArticle.source ?? "",
        imageUrl: displayArticle.image ?? "",
        isMagazine: true,
        createdAt: new Date().toISOString(),
      };
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setAiCloudUrl(`${window.location.origin}/drafts?load=${data.id}`);
      showToast("Tersimpan! Link siap dibagikan.");
    } catch (err: any) {
      showToast(`Gagal: ${err.message}`);
    } finally {
      setAiCloudSaving(false);
    }
  };

  // ── Render Helpers ──────────────────────────────────────────────────────
  if (!isOpen || !displayArticle) return null;
  const current = displayArticle;
  const catColor = CATEGORY_COLORS[current.category] ?? "#555";

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex justify-center items-end md:items-center p-0 md:p-6 transition-all animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[95vh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
        
        {/* ── Sticky Config Top Bar ──────────────────────────── */}
        <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between" style={{ pointerEvents: "none" }}>
          {/* Back/Close */}
          <button onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-white transition-colors active:opacity-70"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", pointerEvents: "auto" }}>
            <ArrowLeft size={16} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Tutup</span>
          </button>

          {/* Tools */}
          <div className="flex gap-2" style={{ pointerEvents: "auto" }}>
            {current.originalUrl && (
              <a href={current.originalUrl} target="_blank" rel="noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors bg-black/55 backdrop-blur-md">
                <ExternalLink size={16} className="text-white" />
              </a>
            )}
            <button onClick={handleSave}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{ background: isSaved ? "rgba(255,116,47,0.9)" : "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}>
              <Bookmark size={16} color="white" fill={isSaved ? "white" : "none"} />
            </button>
            <button onClick={handleTranslate} disabled={translateLoading}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{ background: isTranslated ? "rgba(59,130,246,0.9)" : "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}>
                {translateLoading ? <RefreshCw size={15} color="white" className="animate-spin" /> : <Languages size={17} color="white" />}
            </button>
            <button onClick={shareLink}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all bg-black/55 backdrop-blur-md text-white">
              <Share2 size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────── */}
        <div ref={modalBodyRef} className="overflow-y-auto flex-1 bg-white relative">
          
          {/* Hero Image */}
          <div className="relative w-full h-[320px] md:h-[420px] bg-slate-100">
            <img src={current.image || "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1000"} 
                 onError={handleImgError as any}
                 className="w-full h-full object-cover" 
                 alt={current.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            <div className="absolute bottom-5 left-5 right-5 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-white"
                style={{ background: catColor, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
                {current.category.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="p-6 md:p-10 max-w-3xl mx-auto">
            {/* Meta */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700" style={{ fontSize: 14 }}>
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[11px]">📰</div>
                  {current.source}
                </div>
                
                {current.author && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-slate-600 font-medium" style={{ fontSize: 13 }}>Oleh: {current.author}</span>
                  </>
                )}
                
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={13} />
                  <span style={{ fontSize: 13 }}>{current.readTime} mnt baca</span>
                </div>
              </div>

              {current.pubTimestamp && (
                <div className="text-slate-500 font-medium tracking-wide flex items-center" style={{ fontSize: 12.5 }}>
                  Diunggah: {new Date(current.pubTimestamp).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).replace(/\./g, ':')} WIB
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-[1.2] mb-6 tracking-tight">
              {current.title}
            </h1>

            <div className="w-full h-px bg-slate-100 mb-6" />

            {/* AI Call to action */}
            {hasApiKey ? (
              <button onClick={handleAIRewrite} disabled={aiLoading}
                className="w-full mb-8 flex items-center justify-between px-4 py-3.5 rounded-2xl active:opacity-80 disabled:opacity-60 transition-all shadow-sm"
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
              <button onClick={() => { onClose(); navigate("/pengaturan"); }}
                className="w-full mb-8 flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-neutral-200 hover:border-[#ff742f] transition-colors">
                <Sparkles size={16} className="text-neutral-400" />
                <div className="text-left">
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>Aktifkan AI Rewriter</p>
                  <p style={{ fontSize: 11, color: "#999" }}>Tambah API key di Pengaturan</p>
                </div>
              </button>
            )}

            {aiError && <p className="text-red-500 text-sm font-semibold mb-6">{aiError}</p>}

            {/* Content Loading State */}
            {loadingCode && (
              <div className="flex flex-col gap-3 py-6">
                {[100, 95, 80, 100, 70, 90].map((w, i) => (
                  <div key={i} className="rounded-md animate-pulse h-4 bg-slate-100" style={{ width: w + "%" }} />
                ))}
              </div>
            )}

            {/* HTML Article Prose */}
            <style>{`
              .modal-prose { font-size: 1.1rem; color: #334155; line-height: 1.8; }
              .modal-prose p { margin-bottom: 1.25rem; text-align: justify; }
              .modal-prose h2, .modal-prose h3 { font-size: 1.35rem; font-weight: 800; color: #0f172a; margin-top: 2rem; margin-bottom: 1rem; }
              .modal-prose img { width: 100%; max-width: 100%; border-radius: 1rem; margin: 2rem auto; object-fit: cover; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
              .modal-prose iframe, .modal-prose video { width: 100%; aspect-ratio: 16/9; border-radius: 1rem; margin: 2rem 0; }
              .modal-prose a { color: #4f46e5; font-weight: 600; text-decoration: underline; }
              .modal-prose blockquote { border-left: 4px solid #4f46e5; padding-left: 1.25rem; font-style: italic; color: #475569; background: #f8fafc; padding: 1rem; border-radius: 0.5rem; }
              .modal-prose ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1.25rem; }
              .modal-prose ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1.25rem; }
            `}</style>
            
            <div 
              className="modal-prose transition-opacity duration-300"
              style={{ opacity: contentOpacity }}
              dangerouslySetInnerHTML={{ __html: current.contentHtml || `<p>${current.summary}</p>` }}
            />
            
            {/* Fallback — hanya tampil jika loading selesai & konten masih pendek */}
            {!loadingCode && (current.contentHtml || current.summary || "").length < 400 && (
               <div className="mt-8 p-6 bg-slate-50 rounded-2xl text-center border border-slate-100">
                  <p className="text-slate-500 mb-4 font-medium text-sm">Konten penuh belum berhasil dimuat.</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => current.originalUrl && loadFullContent(current as any)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      <RefreshCw size={15} /> Coba Lagi
                    </button>
                    <a href={current.originalUrl!} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
                      <ExternalLink size={13} /> Buka Web Asli
                    </a>
                  </div>
               </div>
            )}
            
            <div className="h-12" />
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-neutral-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-[fadeInDown_0.2s_ease]">
          {toast}
        </div>
      )}

      {/* ── AI Result Popup ─────────────────────────────────────────── */}
      {aiPopup && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm shadow-2xl"
          onClick={(e) => { if (e.target === e.currentTarget) { setAiPopup(null); setAiCloudUrl(null); } }}>
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white overflow-hidden flex flex-col md:max-h-[85vh] animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500">
                  <Sparkles size={13} color="white" />
                </div>
                <span className="font-bold text-slate-900">Hasil AI</span>
              </div>
              <button onClick={() => { setAiPopup(null); setAiCloudUrl(null); }} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X size={15} className="text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 pb-3">
              <h2 className="text-xl font-bold text-slate-900 leading-snug mb-4">{aiPopup.title}</h2>
              <div className="flex flex-col gap-3">
                {(aiPopup.content ?? []).map((p, i) => (
                  <p key={i} className="text-slate-600 leading-relaxed text-[15px] text-justify">{p}</p>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={() => {
                  navigator.clipboard.writeText([aiPopup.title, "", ...(aiPopup.content ?? [])].join("\n\n"));
                  setAiCopied(true); setTimeout(() => setAiCopied(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-white border border-slate-200 text-slate-700 shadow-sm active:scale-95">
                {aiCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />} 
                {aiCopied ? "Tersalin!" : "Salin Artikel"}
              </button>

              {aiCloudUrl ? (
                <button onClick={() => { navigator.clipboard.writeText(aiCloudUrl); showToast("Link cloud disalin!"); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-green-500 text-white shadow-sm hover:bg-green-600 active:scale-95">
                  <Share2 size={16} /> Copy Link Publik
                </button>
              ) : (
                <button onClick={handleAiCloudSave} disabled={aiCloudSaving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-blue-500 text-white shadow-sm hover:bg-blue-600 active:scale-95 disabled:opacity-50">
                  {aiCloudSaving ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {aiCloudSaving ? "Menyimpan..." : "Simpan Offline ke Cloud"}
                </button>
              )}

              <div className="flex gap-2 mt-1">
                <button onClick={() => {
                    draftStore.create({
                      articleTitle: article!.title, aiTitle: aiPopup.title, aiContent: aiPopup.content,
                      source: article!.source ?? "", imageUrl: article!.image ?? "", template: null,
                    });
                    setAiPopup(null); setAiCloudUrl(null); onClose(); navigate("/jelajahi");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold bg-white border border-slate-200 text-slate-600">
                  <BookmarkPlus size={14} /> Simpan Draft
                </button>
                <button onClick={() => {
                    onClose();
                    navigate("/editor", { state: { titleHtml: aiPopup.title, aiContent: aiPopup.content, source: article!.source, bgUrl: article!.image, fromDraft: true, articleTitle: article!.title, imageUrl: article!.image } });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold bg-gradient-to-br from-orange-500 to-orange-400 text-white">
                  <Edit3 size={14} /> Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
