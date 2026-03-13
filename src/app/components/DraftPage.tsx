import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  FileText, Image as ImageIcon, Trash2, PlusCircle,
  Download, Copy, Check, Cloud, CloudDownload,
  Clock, X, Instagram,
} from "lucide-react";
import { draftStore, type Draft } from "../store/draftStore";
import { MascotEmptyState } from "./MascotEmptyState";


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
  const hasTemplate = !!draft.template?.imageDataUrl;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
      style={{ border: "1px solid #f0ede9" }}
    >
      {/* Thumbnail area */}
      <div className="relative w-full" style={{ aspectRatio: "1563/2320", background: "#f5f5f5" }}>
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
    </button>
  );
}

// ─── DraftPreviewModal ──────────────────────────────────────────────────────
function DraftPreviewModal({ draft: initialDraft, onClose }: { draft: Draft; onClose: () => void }) {
  const navigate = useNavigate();

  // Bisa update draft lokal setelah rewrite
  const [draft, setDraft] = useState(initialDraft);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  // Caption state
  const [captionMode, setCaptionMode] = useState<"view" | "edit">("view");
  const [captionText, setCaptionText] = useState<string>(() =>
    [...(initialDraft.aiContent ?? []), "", `Sumber: ${initialDraft.source}`].join("\n")
  );
  // Cloud save state
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudId, setCloudId] = useState<string | null>(null);

  const [rewriting, setRewriting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!draft.template?.imageDataUrl) return;
    setDownloading(true);
    try {
      await navigator.clipboard.writeText(captionText).catch(() => {});
      const dataUrl = draft.template.imageDataUrl;
      const filename = `draft-${draft.id.slice(6, 14)}.png`;
      if (navigator.canShare) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            setDownloadDone(true);
            setTimeout(() => setDownloadDone(false), 2500);
            return;
          }
        } catch (e: any) { if (e?.name === "AbortError") return; }
      }
      const link = document.createElement("a");
      link.href = dataUrl; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 2500);
    } finally { setDownloading(false); }
  }

  function handlePostToInstagram() {
    navigator.clipboard.writeText(captionText).catch(() => {});
    // Buka Instagram dengan deep link ke new post, fallback ke web
    const igDeepLink = "instagram://camera";
    const igWeb = "https://www.instagram.com";
    // Coba deep link dulu (mobile app), fallback ke web setelah 500ms
    window.location.href = igDeepLink;
    setTimeout(() => { window.open(igWeb, "_blank"); }, 600);
  }

  function handleEditTemplate() {
    onClose();
    navigate("/editor", {
      state: {
        titleHtml: draft.aiTitle,
        aiContent: draft.aiContent,
        source: draft.source,
        bgUrl: draft.imageUrl,
        draftId: draft.id,
        fromDraft: true,
        articleTitle: draft.articleTitle,
        imageUrl: draft.imageUrl,
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
    navigator.clipboard.writeText(cloudId).catch(() => {});
    alert("Kode berhasil disalin: " + cloudId);
  }

  const hasImage = !!draft.template?.imageDataUrl;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-3 pb-safe"
      style={{ background: "rgba(0,0,0,0.9)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      onClick={onClose}
    >
      {/* Floating sheet / dialog */}
      <div
        className="w-full max-w-lg flex flex-col rounded-[2rem] overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-8 duration-300"
        style={{ maxHeight: "calc(96dvh - env(safe-area-inset-top, 0px))", background: "#111" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-4 pb-1 shrink-0 z-10 absolute left-0 right-0 top-0 pointer-events-none">
          <div className="w-12 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.4)", backdropFilter: "blur(4px)" }} />
        </div>

        {/* Header - now absolute and transparent/blurred over the image for immersive feel */}
        <div className="flex items-center justify-between px-5 pt-7 pb-4 shrink-0 absolute top-0 left-0 right-0 z-10"
             style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black shrink-0 shadow-lg border border-white/10"
              style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)", fontSize: 13 }}>OC</div>
            <div>
              <p className="text-white font-bold tracking-wide" style={{ fontSize: 14, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>otakucafe.id</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{relativeTime(draft.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg border border-white/10 active:scale-95 transition-transform"
            style={{ background: "rgba(0,0,0,0.5)" }}>
            <X size={15} color="white" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 container-snap" style={{ WebkitOverflowScrolling: "touch" }}>

          {/* ── Image preview (Fullscreen bleed, no gaps left/right) ── */}
          <div className="relative w-full shrink-0 flex items-center justify-center bg-[#0a0a0a]" style={{ minHeight: "45vh" }}>
            {hasImage ? (
              <img src={draft.template!.imageDataUrl!} alt="preview"
                className="w-full h-auto max-h-[75vh]" style={{ objectFit: "cover", display: "block" }} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <ImageIcon size={36} strokeWidth={1} color="rgba(255,255,255,0.2)" />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Template belum dibuat</span>
                <button onClick={handleEditTemplate}
                  className="px-4 py-2 rounded-xl text-white font-bold active:scale-95 transition-transform"
                  style={{ background: "#ff742f", fontSize: 13 }}>
                  Buat Template
                </button>
              </div>
            )}
            {/* Edit template overlay jika sudah ada gambar */}
            {hasImage && (
              <button onClick={handleEditTemplate}
                className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-full active:scale-95 transition-transform"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
                <PlusCircle size={11} color="rgba(255,255,255,0.8)" />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>Edit template</span>
              </button>
            )}
          </div>

          {/* ── Caption section ── */}
          <div className="px-4 pt-4 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Label + tombol Rewrite / Edit / Simpan */}
            <div className="flex items-center justify-between mb-2.5">
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>CAPTION</span>
              <div className="flex items-center gap-1.5">
                {captionMode === "view" ? (
                  <>
                    <button
                      onClick={handleRewrite}
                      disabled={rewriting}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: "rgba(255,116,47,0.15)", border: "1px solid rgba(255,116,47,0.35)" }}>
                      {rewriting
                        ? <span style={{ fontSize: 10, color: "#ff742f", fontWeight: 700 }}>✦ Menulis ulang...</span>
                        : <><span style={{ fontSize: 15 }}>✦</span><span style={{ fontSize: 10, color: "#ff742f", fontWeight: 700 }}>Rewrite</span></>
                      }
                    </button>
                    <button
                      onClick={() => setCaptionMode("edit")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>✎ Edit</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setCaptionMode("view")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full transition-all active:scale-95"
                    style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}>
                    <Check size={11} color="#22c55e" />
                    <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>Simpan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tombol Simpan ke Cloud */}
            {captionMode === "view" && (
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!cloudId ? (
                  <button 
                    onClick={handleCloudSave}
                    disabled={cloudSaving}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    <Cloud size={14} color="white" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>
                      {cloudSaving ? "Mengunggah..." : "Simpan Draf ke Cloud"}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <div>
                      <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, display: 'block', marginBottom: 2 }}>KODE DRAF CLOUD</span>
                      <span style={{ fontSize: 16, color: "white", fontWeight: 900, letterSpacing: '2px' }}>{cloudId}</span>
                    </div>
                    <button onClick={handleCopyCloudId} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.2)" }}>
                      <Copy size={13} color="#22c55e" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Teks caption */}
            {captionMode === "view" ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {captionText}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={captionText}
                onChange={e => setCaptionText(e.target.value)}
                className="w-full rounded-2xl px-3 py-3 focus:outline-none resize-none"
                style={{
                  minHeight: 180,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              />
            )}
          </div>

          {/* spacer agar tidak tertutup tombol fixed */}
          <div style={{ height: 100 }} />
        </div>

        {/* ── Action buttons — fixed di bawah ── */}
        <div className="shrink-0 px-4 py-3 flex gap-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "#111", paddingBottom: "calc(12px + env(safe-area-inset-bottom,0px))" }}>

          {/* Download (+ salin otomatis) */}
          <button
            onClick={handleDownload}
            disabled={!hasImage || downloading}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: downloadDone ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)",
              border: `1.5px solid ${downloadDone ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.15)"}`,
            }}>
            {downloadDone
              ? <><Check size={16} color="#22c55e" /><span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>Tersimpan!</span></>
              : <><Download size={16} color="white" /><span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{downloading ? "Menyimpan..." : "Download"}</span></>
            }
          </button>

          {/* Post ke Instagram */}
          <button
            onClick={handlePostToInstagram}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#833ab4 0%,#fd1d1d 50%,#fcb045 100%)" }}>
            <Instagram size={16} color="white" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Posting</span>
          </button>
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
    draftStore.reloadImages().catch(() => {});
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
