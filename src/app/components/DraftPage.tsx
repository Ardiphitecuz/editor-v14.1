import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  FileText, Image as ImageIcon, Trash2, PlusCircle,
  Download, Copy, Check, Cloud, CloudDownload,
  Clock, X, Share2, Play, Pencil
} from "lucide-react";
import { draftStore, type Draft } from "../store/draftStore";
import { MascotEmptyState } from "./MascotEmptyState";
import {
  PostCard, VideoCard,
  POST_W, POST_H, VIDEO_W, VIDEO_H,
} from "./CardTemplates";
import { exportVideo } from "../services/videoExporter";


// ─── helpers ─────────────────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

// ─── DraftCard ─────────────────────────────────────────────────────────────
function DraftCard({ draft, onClick, onDelete }: {
  draft: Draft;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const isVideo = draft.template?.template === "video";
  const aspectRatio = "3/4"; // Force 3:4 for list preview
  const hasTemplate = !!draft.template?.imageDataUrl;

  return (
    <div
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
      style={{ border: "1px solid #f0ede9" }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
    >
      {/* Thumbnail area */}
      <div className="relative w-full" style={{ aspectRatio, background: "#f5f5f5" }}>
        {hasTemplate ? (
          <img
            src={draft.template!.imageDataUrl!}
            alt="preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-300">
            <ImageIcon size={32} strokeWidth={1.5} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Belum ada template</span>
          </div>
        )}
        {/* Badge status */}
        <div
          className="absolute top-2 left-2 px-2 py-1 rounded-full"
          style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
            background: hasTemplate ? "rgba(255,116,47,0.9)" : "rgba(0,0,0,0.45)",
            color: "white", backdropFilter: "blur(4px)",
          }}
        >
          {hasTemplate ? "SIAP POST" : "DRAFT"}
        </div>
        {/* Delete */}
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        >
          <Trash2 size={12} color="white" />
        </button>

        {/* Video Icon Overlay */}
        {draft.videoUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: "rgba(0,0,0,0.2)" }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/25 backdrop-blur-md border border-white/30 shadow-xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))", marginLeft: 2 }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="font-bold text-neutral-800 line-clamp-2" style={{ fontSize: 12, lineHeight: 1.4 }}>
          {stripHtml(draft.aiTitle) || draft.articleTitle}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock size={9} className="text-neutral-400" />
          <span className="text-neutral-400" style={{ fontSize: 10 }}>{relativeTime(draft.updatedAt)}</span>
          {!hasTemplate && (
            <>
              <span className="text-neutral-300 mx-0.5">·</span>
              <span style={{ fontSize: 10, color: "#ff742f", fontWeight: 600 }}>Buat template →</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DraftPreviewModal ──────────────────────────────────────────────────────
function DraftPreviewModal({ draft: initialDraft, onClose, draftCount }: { draft: Draft; onClose: () => void; draftCount: number }) {
  const navigate = useNavigate();

  // Bisa update draft lokal setelah rewrite
  const [draft, setDraft] = useState(initialDraft);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadDone, setDownloadDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Caption state
  const [captionMode, setCaptionMode] = useState<"view" | "edit">("view");
  const [captionText, setCaptionText] = useState<string>(() =>
    [...(initialDraft.aiContent ?? []), "", `Sumber: ${initialDraft.source}`].join("\n")
  );
  // Cloud save state
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudId, setCloudId] = useState<string | null>(null);

  const [rewriting, setRewriting] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const isVideo = draft.template?.template === "video";

  // Sync jika draft berubah dari luar
  useEffect(() => {
    setDraft(initialDraft);
    setCaptionText(
      [...(initialDraft.aiContent ?? []), "", `Sumber: ${initialDraft.source}`].join("\n")
    );
  }, [initialDraft.id]);

  useEffect(() => {
    if (captionMode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = 0;
    }
  }, [captionMode]);

  // Auto-play video on mount
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
    }
  }, [isVideo]);

  async function handleRewrite() {
    setRewriting(true);
    try {
      const { getAIConfig } = await import("../services/rewriter");
      const cfg = getAIConfig();
      const prompt = `Tulis ulang caption Instagram berikut dalam Bahasa Indonesia yang engaging, informatif, dan cocok untuk postingan media sosial. Sertakan 3-5 hashtag relevan di akhir. Jangan ubah nama orang/produk/judul. Langsung tulis hasilnya tanpa preamble.\n\n${captionText}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const newText = data.content?.[0]?.text?.trim();
      if (newText) setCaptionText(newText);
    } catch (e) {
      console.error("Rewrite error", e);
    } finally {
      setRewriting(false);
    }
  }

  async function handleDownload() {
    const videoUrl = draft.videoUrl || draft.template?.videoUrl;
    const isVideo = draft.template?.template === "video" && videoUrl;

    if (isVideo && videoUrl && !videoUrl.includes('youtube')) {
      if (!videoRef.current) return;
      setExporting(true);
      setExportProgress(0);
      try {
        const blob = await exportVideo(videoRef.current, overlayRef.current, {
          cardWidth: ((draft.template?.videoAspectRatio ?? "9:16") === "9:16") ? VIDEO_W : POST_W,
          cardHeight: ((draft.template?.videoAspectRatio ?? "9:16") === "9:16") ? VIDEO_H : POST_H,
          outWidth: 1080,
          outHeight: ((draft.template?.videoAspectRatio ?? "9:16") === "9:16") ? 1920 : 1440,
          onProgress: (p) => setExportProgress(p)
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `otaku_video_${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        setDownloadDone(true);
        setTimeout(() => setDownloadDone(false), 2500);
      } catch (e: any) {
        alert("Gagal ekspor video: " + e.message);
      } finally {
        setExporting(false);
        setExportProgress(0);
      }
      return;
    }

    if (draft.template?.template === "video" && draft.videoUrl?.includes('youtube')) {
      alert("Video YouTube tidak dapat di-download langsung. Silakan download video asli lalu upload ke editor.");
      return;
    }

    if (!draft.template?.imageDataUrl) return;
    setExporting(true);
    try {
      const dataUrl = draft.template.imageDataUrl;
      const filename = `draft-${draft.id.slice(6, 14)}.png`;
      const link = document.createElement("a");
      link.href = dataUrl; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 2500);
    } finally { setExporting(false); }
  }

  async function handleShare() {
    if (draft.template?.template === "video") {
      const videoUrl = draft.videoUrl || draft.template?.videoUrl;
      if (videoUrl && !videoUrl.includes('youtube')) {
        if (!videoRef.current) return;
        setExporting(true);
        setExportProgress(0);
        try {
          const blob = await exportVideo(videoRef.current, overlayRef.current, {
            cardWidth: ((draft.template?.videoAspectRatio ?? "9:16") === "9:16") ? VIDEO_W : POST_W,
            cardHeight: ((draft.template?.videoAspectRatio ?? "9:16") === "9:16") ? VIDEO_H : POST_H,
            outWidth: 1080,
            outHeight: ((draft.template?.videoAspectRatio ?? "9:16") === "9:16") ? 1920 : 1440,
            onProgress: (p) => setExportProgress(p)
          });
          const file = new File([blob], `otaku_video_${Date.now()}.mp4`, { type: "video/mp4" });
          setShareFile(file);
          // Navigator.share won't work here due to lost user gesture (async).
          // user must click the "Share Ready" button that appears.
        } catch (e: any) {
          alert("Gagal ekspor video: " + e.message);
        } finally {
          setExporting(false);
          setExportProgress(0);
        }
        return;
      }
      alert("Video YouTube tidak dapat di-share langsung.");
      return;
    }
    // 1. Salin caption otomatis ke clipboard
    await navigator.clipboard.writeText(captionText).catch(() => { });

    if (!draft.template?.imageDataUrl) {
      alert("Caption disalin! (Tidak ada gambar untuk di-share)");
      return;
    }

    // 2. Siapkan file gambar
    const dataUrl = draft.template.imageDataUrl;
    const filename = `draft-${draft.id.slice(6, 14)}.png`;

    // 3. Cek dukungan Web Share API dengan fungsi pembagian file
    if (navigator.canShare) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Share error:", e);
      }
    }

    // 4. Fallback jika gagal/tidak didukung
    alert("Caption berhasil disalin! Silakan gunakan tombol Download untuk menyimpan gambar.");
  }

  function handleEditTemplate(additionalState = {}) {
    onClose();
    navigate("/editor", {
      state: {
        ...draft.template, // Includes template, videoUrl, stickers, extraTexts, etc.
        ...additionalState,
        titleHtml: draft.aiTitle,
        aiContent: draft.aiContent,
        source: draft.source,
        bgUrl: draft.imageUrl,
        draftId: draft.id,
        fromDraft: true,
        articleTitle: draft.articleTitle,
        imageUrl: draft.imageUrl,
        videoUrl: draft.videoUrl,
      }
    });
  }

  async function handleCloudSave() {
    setCloudSaving(true);
    setCloudId(null);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCloudId(data.id);
      } else {
        alert("Gagal simpan ke cloud: " + (data.error || "Unknown"));
      }
    } catch (e) {
      alert("Error network: " + e);
    } finally {
      setCloudSaving(false);
    }
  }

  function handleCopyCloudId() {
    if (!cloudId) return;
    navigator.clipboard.writeText(cloudId).catch(() => { });
    alert("Kode berhasil disalin: " + cloudId);
  }

  const hasImage = !!draft.template?.imageDataUrl;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Redesigned Card Container */}
      <div
        className="relative w-full max-w-[360px] bg-[#18181b] border border-white/10 rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col transform transition-all scale-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[100] p-2.5 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full text-white/90 hover:text-white transition-all border border-white/10 shadow-lg"
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        {/* Status Badge */}
        <div className="absolute top-5 left-5 z-50 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5 shadow-lg">
          <div className={`w-2 h-2 rounded-full ${isVideo ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}></div>
          <span className="text-white text-[10px] font-bold tracking-widest uppercase">
            {isVideo ? 'Video Draft' : 'Draft Post'}
          </span>
        </div>

        {/* Media Preview Section */}
        <div className="relative w-full aspect-[4/5] bg-black flex items-center justify-center overflow-hidden group">
          <div className="flex items-center justify-center transition-transform group-hover:scale-[1.02] duration-500"
            style={{
              transform: `scale(${isVideo && (draft.template?.videoAspectRatio ?? "9:16") === "9:16" ? 0.21 : 0.22})`,
              transformOrigin: "center center",
              width: isVideo && (draft.template?.videoAspectRatio ?? "9:16") === "9:16" ? VIDEO_W : POST_W,
              height: isVideo && (draft.template?.videoAspectRatio ?? "9:16") === "9:16" ? VIDEO_H : POST_H,
              flexShrink: 0
            }}>
            {isVideo ? (
              <VideoCard
                {...draft.template}
                videoRef={videoRef}
                overlayRef={overlayRef}
                cardRef={cardRef}
                interactive={false}
              />
            ) : (
              <PostCard
                {...draft.template}
                interactive={false}
              />
            )}
          </div>

          {/* Play/Pause control overlay if it's a video - REMOVED per user request */}

          {/* Bottom Fade Gradient for text contrast */}
          <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-[#18181b] to-transparent pointer-events-none"></div>
        </div>

        {/* Information Section */}
        <div className="p-5 pt-0 flex flex-col gap-4 bg-[#18181b] relative z-10">
          <div className="space-y-1.5">
            <h3 className="text-white font-extrabold text-lg leading-tight line-clamp-2">
              {stripHtml(draft.aiTitle) || draft.articleTitle}
            </h3>
            <div className="relative">
              {captionMode === "view" ? (
                <p
                  onClick={() => setCaptionMode('edit')}
                  className="text-zinc-400 text-sm line-clamp-3 leading-relaxed whitespace-pre-wrap cursor-pointer hover:text-zinc-300 transition-colors"
                  title="Klik untuk edit caption"
                >
                  {captionText}
                </p>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={captionText}
                  onChange={e => setCaptionText(e.target.value)}
                  onBlur={() => setCaptionMode('view')}
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-zinc-300 text-sm focus:outline-none focus:border-white/20 resize-none font-sans"
                />
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-3 pt-2">
            {/* Primary Action Header: Download */}
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2.5 bg-white text-black hover:bg-zinc-200 active:bg-zinc-300 font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] text-[15px] disabled:opacity-50"
            >
              {exporting ? (
                <div className="flex flex-col items-center">
                  <span className="text-xs">Exporting {exportProgress}%</span>
                </div>
              ) : (
                <>
                  <Download size={20} strokeWidth={2.5} />
                  <span>{isVideo ? 'Unduh Video' : 'Unduh Gambar'}</span>
                </>
              )}
            </button>

            {/* Share Button / Share Ready */}
            {shareFile ? (
              <button 
                onClick={async () => {
                   try {
                     await navigator.share({ files: [shareFile], title: "Video Otaku" });
                     setShareFile(null);
                   } catch(e) { console.error(e); }
                }}
                className="flex items-center justify-center px-4 py-3.5 bg-[#4ade80] hover:bg-[#22c55e] text-white rounded-xl transition-all border border-white/5 font-bold gap-2 animate-bounce flex-1"
                title="Bagikan Sekarang"
              >
                <Share2 size={20} strokeWidth={2.5} />
                <span className="text-[12px]">Share Sekarang!</span>
              </button>
            ) : (
              <button 
                onClick={handleShare}
                disabled={exporting}
                className="flex items-center justify-center p-3.5 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl transition-all border border-white/5 disabled:opacity-50" 
                title="Bagikan"
              >
                <Share2 size={20} strokeWidth={2.5} />
              </button>
            )}

            {/* Edit Template Button (Replacing Copy) */}
            {!shareFile && (
              <button 
                onClick={() => handleEditTemplate()}
                className="flex items-center justify-center p-3.5 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl transition-all border border-white/5" 
                title="Edit di Editor"
              >
                <Pencil size={20} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div className="flex justify-center items-center px-1">
            <button
              onClick={() => setCaptionMode(captionMode === 'view' ? 'edit' : 'view')}
              className="text-white/20 text-[9px] font-bold hover:text-white/40 transition-colors uppercase tracking-widest"
            >
              {captionMode === 'view' ? '✎ Klik teks untuk edit caption' : '✓ Selesai'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DraftPage ──────────────────────────────────────────────────────────────
export function DraftPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>(() => draftStore.getAll());
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Cloud Load State
  const [showCloudInput, setShowCloudInput] = useState(false);
  const [cloudInputId, setCloudInputId] = useState("");
  const [cloudLoading, setCloudLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    // Reload imageDataUrl dari IDB setiap mount — handle iOS GC atau navigasi kembali
    draftStore.reloadImages().catch(() => { });
  }, []);

  // Ukur tinggi header + navbar untuk empty state height
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!headerRef.current) return;
    const totalOffset = headerRef.current.offsetHeight + 84; // 84 = bottom nav
    document.documentElement.style.setProperty("--header-h", `${totalOffset}px`);
    return () => {
      document.documentElement.style.removeProperty("--header-h");
    };
  }, []);

  useEffect(() => {
    const unsubscribe = draftStore.subscribe(() => setDrafts(draftStore.getAll()));
    return () => { unsubscribe(); };
  }, []);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteConfirm(id);
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    if (selectedDraft?.id === deleteConfirm) setSelectedDraft(null);
    draftStore.delete(deleteConfirm);
    setDeleteConfirm(null);
  }

  async function handleLoadFromCloud() {
    if (!cloudInputId.trim()) return;
    setCloudLoading(true);
    try {
      const res = await fetch(`/api/drafts?id=${cloudInputId.trim()}`);
      const data = await res.json();
      if (res.ok && data) {
        // Jika ID belum ada di lokal, tambahkan prefix biar tidak crash
        const newDraft = { ...data, id: `cloud_${Date.now()}` };
        draftStore.save(newDraft);
        setShowCloudInput(false);
        setCloudInputId("");
        alert("Draf berhasil diunduh dari cloud!");
      } else {
        alert("Gagal load draft: " + (data.error || "Not found"));
      }
    } catch (e) {
      alert("Network error: " + e);
    } finally {
      setCloudLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      {/* Header */}
      <div ref={headerRef} className="sticky top-0 z-30 bg-white/95 backdrop-blur-md" style={{ borderBottom: "1px solid #f0ede9" }}>
        <div className="px-4 pt-5 pb-4">
          <p className="text-neutral-400" style={{ fontSize: 13 }}>Artikel & Template</p>
          <div className="flex items-end justify-between">
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1 }}>
              Draft
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloudInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-transform active:scale-95"
                style={{ background: "rgba(255,116,47,0.1)", border: "1px solid rgba(255,116,47,0.2)" }}
              >
                <CloudDownload size={14} color="#ff742f" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff742f" }}>Unduh Cloud</span>
              </button>
              <span
                className="px-2.5 py-1 rounded-full flex items-center justify-center"
                style={{ fontSize: 11, fontWeight: 700, background: drafts.length ? "#ff742f" : "#f0ede9", color: drafts.length ? "white" : "#999" }}
              >
                {drafts.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-28">
        {drafts.length === 0 ? (
          <MascotEmptyState
            expr="nunjuk"
            title="Belum ada draft"
            desc='Buat artikel AI dari berita, lalu pilih "Simpan ke Draft" atau "Buat Postingan"'
            action={
              <button
                onClick={() => navigate("/")}
                className="px-5 py-3 rounded-2xl text-white font-bold active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)", fontSize: 13 }}
              >Cari Artikel →</button>
            }
          />
        ) : (
          <>
            {/* Hint */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-neutral-400" style={{ fontSize: 12 }}>
                Ketuk draft untuk preview & download
              </p>
            </div>

            {/* Grid */}
            <div className="px-4 grid grid-cols-2 gap-3">
              {drafts.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onClick={() => setSelectedDraft(draft)}
                  onDelete={(e) => handleDelete(draft.id, e)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Preview Modal */}
      {selectedDraft && (
        <DraftPreviewModal
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          draftCount={drafts.length}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm mx-4 mb-6 rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "white" }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>Hapus draft ini?</p>
            <p className="text-neutral-500" style={{ fontSize: 13 }}>Template dan artikel akan terhapus permanen.</p>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-bold"
                style={{ background: "#f5f5f5", color: "#555", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl font-bold"
                style={{ background: "#ef4444", color: "white", fontSize: 13 }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Cloud ID */}
      {showCloudInput && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !cloudLoading && setShowCloudInput(false)}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-[#1a1a1a] text-lg">Unduh Draf Cloud</h3>
              <p className="text-neutral-500 text-xs mt-1">Masukkan 6 digit kode draf dari perangkat lain untuk melanjutkan editing di perangkat ini.</p>
            </div>
            <input
              type="text"
              placeholder="Contoh: a8x9f2"
              value={cloudInputId}
              onChange={e => setCloudInputId(e.target.value)}
              className="w-full bg-[#f8f5f1] border border-[#f0ede9] rounded-xl px-4 py-3 text-sm font-bold tracking-[2px] text-center focus:outline-none focus:border-[#ff742f]"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloudInput(false)}
                disabled={cloudLoading}
                className="flex-1 py-3 rounded-xl font-bold text-neutral-500 bg-[#f5f5f5]"
              >
                Batal
              </button>
              <button
                onClick={handleLoadFromCloud}
                disabled={cloudLoading || !cloudInputId.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#ff742f] to-[#ff9a5c] disabled:opacity-50"
              >
                {cloudLoading ? 'Mencari...' : 'Unduh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}