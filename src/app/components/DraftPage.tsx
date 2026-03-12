import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  FileText, Image as ImageIcon, Trash2, PlusCircle,
  Download, Send, Copy, Check, ChevronDown, ChevronUp,
  Clock, X, Share2, Instagram,
} from "lucide-react";
import { draftStore, type Draft } from "../store/draftStore";
import { exportCardToCanvas } from "../services/canvasExport";

import imgRectangle7 from "figma:asset/3faeab794066e6a5837760291e83a4cac94d2503.png";
import imgContent from "figma:asset/dd1da5fc74964e99895149508d6205a4d1bf1cb6.png";
import imgIdentityBar from "figma:asset/de21bf7c4db25ef35876a6b7b4b21eaa1919be07.png";

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
function DraftPreviewModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [articleExpanded, setArticleExpanded] = useState(false);

  const articleText = [
    stripHtml(draft.aiTitle),
    "",
    ...(draft.aiContent ?? []),
    "",
    `Sumber: ${draft.source}`,
  ].join("\n");

  async function handleDownload() {
    if (!draft.template) return;
    setDownloading(true);
    try {
      // Re-generate canvas (template.imageDataUrl sudah ada, tapi kita pakai yang disimpan)
      const dataUrl = draft.template.imageDataUrl!;
      const filename = `draft-${draft.id.slice(6, 14)}.png`;

      // Salin teks artikel ke clipboard
      await navigator.clipboard.writeText(articleText).catch(() => {});

      // Download gambar
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
        }
      }
      const link = document.createElement("a");
      link.href = dataUrl; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyArticle() {
    await navigator.clipboard.writeText(articleText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePostToInstagram() {
    // Salin teks dulu, lalu buka Instagram
    navigator.clipboard.writeText(articleText).catch(() => {});
    window.open("https://www.instagram.com", "_blank");
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
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="relative flex flex-col w-full max-w-sm mx-auto my-auto rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "92vh", background: "#0f0f0f" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <X size={14} color="white" />
        </button>

        {/* Instagram-style header */}
        <div className="flex items-center gap-2.5 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)" }}>
            <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ fontSize: 12 }}>OC</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold" style={{ fontSize: 12 }}>otakucafe.id</p>
            <p className="text-white/40" style={{ fontSize: 10 }}>{relativeTime(draft.createdAt)}</p>
          </div>
        </div>

        {/* Image preview */}
        <div className="relative w-full shrink-0" style={{ aspectRatio: "1563/2320", background: "#1a1a1a" }}>
          {draft.template?.imageDataUrl ? (
            <img src={draft.template.imageDataUrl} alt="preview" className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/30">
              <ImageIcon size={40} strokeWidth={1} />
              <span style={{ fontSize: 13 }}>Template belum dibuat</span>
              <button
                onClick={handleEditTemplate}
                className="px-4 py-2 rounded-xl text-white font-bold active:scale-95 transition-transform"
                style={{ background: "#ff742f", fontSize: 13 }}
              >
                Buat Template Sekarang
              </button>
            </div>
          )}
        </div>

        {/* Caption / artikel preview */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <button
            onClick={() => setArticleExpanded(!articleExpanded)}
            className="w-full flex items-start gap-2 px-4 py-3 text-left"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-white/90 font-bold" style={{ fontSize: 11, lineHeight: 1.4 }}>
                {stripHtml(draft.aiTitle)}
              </p>
              {articleExpanded && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {draft.aiContent?.map((p, i) => (
                    <p key={i} className="text-white/50" style={{ fontSize: 10.5, lineHeight: 1.6 }}>{p}</p>
                  ))}
                  <p className="text-white/30 mt-1" style={{ fontSize: 10 }}>Sumber: {draft.source}</p>
                </div>
              )}
            </div>
            <div className="shrink-0 mt-0.5">
              {articleExpanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
            </div>
          </button>
        </div>

        {/* Action bar */}
        <div className="shrink-0 px-4 py-3 flex flex-col gap-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "#0f0f0f" }}>
          {/* Row 1: Download + Salin Artikel */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!draft.template?.imageDataUrl || downloading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <Download size={14} color="white" />
              <span className="text-white font-bold" style={{ fontSize: 12 }}>
                {downloading ? "Mengunduh..." : "Download"}
              </span>
            </button>
            <button
              onClick={handleCopyArticle}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95"
              style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)", border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}` }}
            >
              {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} color="white" />}
              <span style={{ fontSize: 12, fontWeight: 700, color: copied ? "#22c55e" : "white" }}>
                {copied ? "Tersalin!" : "Salin Artikel"}
              </span>
            </button>
          </div>

          {/* Row 2: Edit Template + Post ke Instagram */}
          <div className="flex gap-2">
            {draft.template?.imageDataUrl ? (
              <button
                onClick={handleEditTemplate}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <FileText size={13} color="rgba(255,255,255,0.6)" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Edit</span>
              </button>
            ) : (
              <button
                onClick={handleEditTemplate}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95"
                style={{ background: "rgba(255,116,47,0.15)", border: "1px solid rgba(255,116,47,0.35)" }}
              >
                <PlusCircle size={13} color="#ff742f" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ff742f" }}>Buat Template</span>
              </button>
            )}
            <button
              onClick={handlePostToInstagram}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" }}
            >
              <Instagram size={15} color="white" />
              <span className="text-white font-bold" style={{ fontSize: 12 }}>Post</span>
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

  useEffect(() => {
    return draftStore.subscribe(() => setDrafts(draftStore.getAll()));
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

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md" style={{ borderBottom: "1px solid #f0ede9" }}>
        <div className="px-4 pt-5 pb-4">
          <p className="text-neutral-400" style={{ fontSize: 13 }}>Artikel & Template</p>
          <div className="flex items-end justify-between">
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1 }}>
              Draft
            </h1>
            <span
              className="px-2.5 py-1 rounded-full"
              style={{ fontSize: 11, fontWeight: 700, background: drafts.length ? "#ff742f" : "#f0ede9", color: drafts.length ? "white" : "#999" }}
            >
              {drafts.length} draft
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-28">
        {drafts.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-24 px-8 gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: "#f0ede9" }}>
              <FileText size={36} className="text-neutral-300" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>Belum ada draft</p>
              <p className="text-neutral-400 mt-1" style={{ fontSize: 13, lineHeight: 1.5 }}>
                Buat artikel AI dari berita, lalu pilih "Simpan ke Draft" atau "Buat Postingan"
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-2 px-5 py-3 rounded-2xl text-white font-bold active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)", fontSize: 13 }}
            >
              Cari Artikel →
            </button>
          </div>
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
    </div>
  );
}
