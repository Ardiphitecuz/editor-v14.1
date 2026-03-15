import { useState, useRef, useEffect, useCallback, useId } from "react";
import { useLocation, useNavigate } from "react-router";
import { exportCardToCanvas } from "../services/canvasExport";
import { toPng } from "html-to-image";
import { draftStore } from "../store/draftStore";
import { CatOverlay } from "./LoadingCat";
import svgPaths from "../../imports/svg-0zf9wwjyvn";
// Menggunakan figma:asset (Pastikan vite.config.ts sudah di-set alias-nya)
import imgImage1 from "figma:asset/8acdc84a856693a878bcf009f2c9faadb518a733.png";
import imgRectangle7 from "figma:asset/3faeab794066e6a5837760291e83a4cac94d2503.png";
import imgContent from "figma:asset/dd1da5fc74964e99895149508d6205a4d1bf1cb6.png";
import imgIdentityBar from "figma:asset/de21bf7c4db25ef35876a6b7b4b21eaa1919be07.png";

// Import FFmpeg for MP4 export
// FFmpeg removed - export now handled in DraftPage

import {
  Bold, Italic, Download, RotateCcw, ImagePlus, ChevronDown,
  Plus, Trash2, Type, Image as ImageIcon, Layers, FileImage, Link, ArrowLeft, X, Sparkles, Cloud
} from "lucide-react";
import { upscaleImage } from "../services/imageUpscaler";
import {
  PostCard, VideoCard, Background, Overlay, NotifBadge,
  POST_W, POST_H, VIDEO_W, VIDEO_H,
  FONT_REGULAR, FONT_BOLD, FONT_ITALIC, FONT_BOLD_ITALIC,
  DEFAULT_BG, LINK_BG, DEFAULT_TITLE_HTML, DEFAULT_BG_TRANSFORM, LABEL_OPTIONS,
  type BgTransform, type BgMode, type Sticker, type ExtraText
} from "./CardTemplates";

type TemplateType = "post" | "video";
type SidebarTab = "content" | "background" | "stickers" | "texts";

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Components Helper ────────────────────────────────────────────────────────
function BgUrlInput({ placeholder, onApply, onSourceApply }: { placeholder: string; onApply: (url: string) => void; onSourceApply?: (domain: string) => void }) {
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handleApply() {
    const url = val.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setErr("URL harus diawali https://"); return; }
    setLoading(true); setErr(null);
    const img = new Image();
    img.onload = () => {
      setLoading(false); onApply(url); setVal("");
      if (onSourceApply) {
        try { const domain = new URL(url).hostname.replace(/^www\./, ""); onSourceApply(domain); } catch { }
      }
    };
    img.onerror = () => { setLoading(false); setErr("Gagal memuat gambar."); };
    img.crossOrigin = "anonymous";
    img.src = url;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5 items-center rounded-lg border border-neutral-200 px-2.5 py-1.5 focus-within:border-[#ff742f]">
        <Link size={12} className="text-neutral-400 shrink-0" />
        <input type="url" value={val} onChange={(e) => { setVal(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }} placeholder={placeholder} className="flex-1 bg-transparent text-[12px] text-neutral-700 focus:outline-none placeholder-neutral-300" />
        {val && <button onClick={handleApply} disabled={loading} className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md text-white bg-[#ff742f] disabled:opacity-50">{loading ? "..." : "OK"}</button>}
      </div>
      {err && <p className="text-[11px] text-red-500">{err}</p>}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center"><span className="text-[12px] text-neutral-500">{label}</span><span className="text-[12px] text-neutral-400 tabular-nums">{value}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#ff742f] cursor-pointer h-5 touch-none" />
    </div>
  );
}


// ── Crop Modal ───────────────────────────────────────────────────────────────
function CropModal({ src, shape, onDone, onClose }: { src: string; shape: "original" | "square" | "circle"; onDone: (cropped: string) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 100 }); // % of rendered image
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const dragStart = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = new Image(); i.onload = () => {
      setImg(i);
      const minD = Math.min(i.width, i.height);
      setCrop({ x: (i.width - minD) / 2, y: (i.height - minD) / 2, size: minD });
    }; i.src = src;
  }, [src]);

  // draw preview
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d")!;
    const D = 240;
    cvs.width = D; cvs.height = D;
    ctx.clearRect(0, 0, D, D);
    ctx.save();
    if (shape === "circle") { ctx.beginPath(); ctx.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2); ctx.clip(); }
    else if (shape === "square") { ctx.beginPath(); const r = 16; ctx.moveTo(r, 0); ctx.lineTo(D - r, 0); ctx.arcTo(D, 0, D, r, r); ctx.lineTo(D, D - r); ctx.arcTo(D, D, D - r, D, r); ctx.lineTo(r, D); ctx.arcTo(0, D, 0, D - r, r); ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r); ctx.clip(); }
    ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, D, D);
    ctx.restore();
  }, [img, crop, shape]);

  const imgDisplay = img ? Math.min(300, img.width) : 300;
  const imgScale = img ? imgDisplay / img.width : 1;

  const startInteract = (e: React.MouseEvent | React.TouchEvent, mode: "move" | "resize") => {
    e.preventDefault(); e.stopPropagation();
    const pt = "touches" in e ? e.touches[0] : e;
    setDragging(mode);
    dragStart.current = { cx: pt.clientX, cy: pt.clientY, crop: { ...crop } };
  };

  useEffect(() => {
    if (!img) return;
    const move = (cx: number, cy: number) => {
      if (!dragging || !dragStart.current) return;
      const dx = (cx - dragStart.current.cx) / imgScale;
      const dy = (cy - dragStart.current.cy) / imgScale;
      const { crop: c0 } = dragStart.current;
      if (dragging === "move") {
        setCrop({ ...c0, x: Math.max(0, Math.min(img.width - c0.size, c0.x + dx)), y: Math.max(0, Math.min(img.height - c0.size, c0.y + dy)) });
      } else {
        const ns = Math.max(40, Math.min(Math.min(img.width - c0.x, img.height - c0.y), c0.size + Math.max(dx, dy)));
        setCrop({ ...c0, size: ns });
      }
    };
    const onMM = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTM = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
    const onEnd = () => setDragging(null);
    document.addEventListener("mousemove", onMM); document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTM, { passive: false }); document.addEventListener("touchend", onEnd);
    return () => { document.removeEventListener("mousemove", onMM); document.removeEventListener("mouseup", onEnd); document.removeEventListener("touchmove", onTM); document.removeEventListener("touchend", onEnd); };
  }, [dragging, img, imgScale]);

  const handleApply = () => {
    if (!img) return;
    const out = document.createElement("canvas"); out.width = crop.size; out.height = crop.size;
    const ctx = out.getContext("2d")!; ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, crop.size, crop.size);
    onDone(out.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-neutral-900">Crop Stiker</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"><X size={14} /></button>
        </div>
        {/* Image with crop overlay */}
        {img && (
          <div ref={containerRef} className="relative overflow-hidden rounded-xl bg-neutral-100 mx-auto" style={{ width: imgDisplay, height: imgDisplay * (img.height / img.width) }}>
            <img src={src} style={{ width: imgDisplay, height: "auto", display: "block", userSelect: "none", pointerEvents: "none" }} draggable={false} />
            {/* crop rect */}
            <div style={{ position: "absolute", left: crop.x * imgScale, top: crop.y * imgScale, width: crop.size * imgScale, height: crop.size * imgScale, border: "2px solid #ff742f", borderRadius: shape === "circle" ? "50%" : shape === "square" ? "8px" : 0, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)", cursor: dragging === "move" ? "grabbing" : "grab", touchAction: "none" }}
              onMouseDown={(e) => startInteract(e, "move")} onTouchStart={(e) => startInteract(e, "move")}>
              {/* resize handle */}
              <div style={{ position: "absolute", right: -8, bottom: -8, width: 18, height: 18, background: "#ff742f", borderRadius: "50%", border: "2px solid white", cursor: "se-resize", touchAction: "none" }}
                onMouseDown={(e) => startInteract(e, "resize")} onTouchStart={(e) => startInteract(e, "resize")} />
            </div>
          </div>
        )}
        {/* Preview */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-neutral-400 shrink-0">Preview:</span>
          <canvas ref={canvasRef} className="rounded-lg" style={{ width: 60, height: 60, imageRendering: "crisp-edges" }} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-500">Batal</button>
          <button onClick={handleApply} className="flex-1 py-2.5 rounded-xl bg-[#ff742f] text-white text-sm font-bold">Terapkan</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR PAGE (MAIN REVISION)
// ═══════════════════════════════════════════════════════════════════════════════
export function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as {
    template?: TemplateType;
    videoAspectRatio?: "3:4" | "9:16";
    label?: string;
    titleHtml?: string;
    source?: string;
    articleSource?: string;
    bgSrc?: string;
    bgUrl?: string;
    bgMode?: BgMode;
    bgT?: BgTransform;
    bg2Src?: string;
    bg2T?: BgTransform;
    splitAngle?: number;
    videoUrl?: string | null;
    stickers?: Sticker[];
    extraTexts?: ExtraText[];

    aiContent?: string[];
    fromDraft?: boolean;
    draftId?: string;
    articleTitle?: string;
    imageUrl?: string;

    // Auto-export flags
    autoExport?: boolean;
    exportMode?: "download" | "share";
  } | null;
  const INIT_TITLE = locationState?.titleHtml ?? DEFAULT_TITLE_HTML;

  const [template, setTemplate] = useState<TemplateType>(locationState?.template ?? "post");
  const [videoAspectRatio, setVideoAspectRatio] = useState<"3:4" | "9:16">("9:16");

  const CARD_W = template === "post" ? POST_W : (videoAspectRatio === "3:4" ? POST_W : VIDEO_W);
  const CARD_H = template === "post" ? POST_H : (videoAspectRatio === "3:4" ? POST_H : VIDEO_H);

  const [activeTab, setActiveTab] = useState<SidebarTab | null>(null);

  const [label, setLabel] = useState("Discuss");
  const [titleHtml, setTitleHtml] = useState(INIT_TITLE);
  const [source, setSource] = useState(locationState?.source ?? "");
  const [articleSource, setArticleSource] = useState(locationState?.articleSource ?? "");

  const [bgMode, setBgMode] = useState<BgMode>(locationState?.bgMode ?? "single");
  const [bgSrc, setBgSrc] = useState<string>(locationState?.bgSrc ?? locationState?.bgUrl ?? locationState?.imageUrl ?? DEFAULT_BG);
  const [bgT, setBgT] = useState<BgTransform>(locationState?.bgT ?? { ...DEFAULT_BG_TRANSFORM });
  const [bg2Src, setBg2Src] = useState<string>(locationState?.bg2Src ?? DEFAULT_BG);
  const [bg2T, setBg2T] = useState<BgTransform>(locationState?.bg2T ?? { ...DEFAULT_BG_TRANSFORM });
  const [splitAngle, setSplitAngle] = useState(10);
  const [videoUrl, setVideoUrl] = useState<string | null>(locationState?.videoUrl ?? null);

  const [stickers, setStickers] = useState<Sticker[]>(locationState?.stickers ?? []);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [extraTexts, setExtraTexts] = useState<ExtraText[]>(locationState?.extraTexts ?? []);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [bgDragActive, setBgDragActive] = useState<1 | 2 | null>(null);
  const [cropStickerId, setCropStickerId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "loading" | "info" } | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: "success" | "error" | "loading" | "info" = "info", duration = 3000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    if (duration > 0) toastTimer.current = setTimeout(() => setToast(null), duration);
  };
  const hideToast = () => { if (toastTimer.current) clearTimeout(toastTimer.current); setToast(null); };

  // ── Upscale state ──────────────────────────────────────────────────────────
  const [upscaling, setUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaleStatus, setUpscaleStatus] = useState("");

  // Responsive: detect desktop (≥1024px)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Formatting state
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

  // Mobile UI state
  const [mobileBubbleTab, setMobileBubbleTab] = useState<SidebarTab | null>(null);
  const [showZoomSlider, setShowZoomSlider] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<"bg1" | "bg2" | string>("bg1");
  const [showSourcePopup, setShowSourcePopup] = useState(false);
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [sourceUrlLoading, setSourceUrlLoading] = useState(false);
  const [sourceUrlErr, setSourceUrlErr] = useState<string | null>(null);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showTextEditPopup, setShowTextEditPopup] = useState(false);
  const [showBgSubBubbles, setShowBgSubBubbles] = useState(false);
  const [showBgSub2Bubbles, setShowBgSub2Bubbles] = useState(false);
  const [showBg2UrlPopup, setShowBg2UrlPopup] = useState(false);
  const [showSumberPopup, setShowSumberPopup] = useState(false);
  const [bg2UrlInput, setBg2UrlInput] = useState("");
  const [bg2UrlLoading, setBg2UrlLoading] = useState(false);
  const [bg2UrlErr, setBg2UrlErr] = useState<string | null>(null);

  const [showVideoUrlPopup, setShowVideoUrlPopup] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoUrlLoading, setVideoUrlLoading] = useState(false);
  const [videoUrlErr, setVideoUrlErr] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startScale1: number; startScale2: number; touchedBg?: 1 | 2 } | null>(null);
  const currentBgTRef = useRef(DEFAULT_BG_TRANSFORM);
  const currentBg2TRef = useRef(DEFAULT_BG_TRANSFORM);
  const bgModeRef = useRef<BgMode>("single");
  const cardDimRef = useRef({ w: POST_W, h: POST_H });

  // Media Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fix mobile: prevent auto-zoom on input focus, disable page scroll
  useEffect(() => {
    if (isDesktop) return;
    // Prevent iOS auto-zoom on input focus
    const existing = document.querySelector('meta[name="viewport"]');
    const content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
    if (existing) existing.setAttribute("content", content);
    else { const m = document.createElement("meta"); m.name = "viewport"; m.content = content; document.head.appendChild(m); }
    // Prevent body scroll
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isDesktop]);
  useEffect(() => { currentBg2TRef.current = bg2T; }, [bg2T]);
  useEffect(() => { bgModeRef.current = bgMode; }, [bgMode]);
  useEffect(() => { cardDimRef.current = { w: CARD_W, h: CARD_H }; }, [CARD_W, CARD_H]);
  // Removed auto-redirect to allow direct access to editor for blank creation
  // Auto-sync zoom target when selection changes
  useEffect(() => { if (selectedStickerId) { setZoomTarget(selectedStickerId); setShowZoomSlider(true); } }, [selectedStickerId]);
  useEffect(() => { if (selectedTextId) { setZoomTarget(selectedTextId); setShowZoomSlider(true); } }, [selectedTextId]);
  useEffect(() => {
    const initialTitle = locationState?.titleHtml || INIT_TITLE;
    if (editorRef.current) {
      editorRef.current.innerHTML = initialTitle;
    }
    setTitleHtml(initialTitle);

    // Jika datang dari ArticlePage (ada titleHtml), langsung buka panel Konten
    if (locationState?.titleHtml) {
      setActiveTab("content");
    }
  }, []);


  const handleExportVideo = async () => {
    // Logic moved to DraftPage and videoExporter service
    showToast("Gunakan tombol download di halaman Draft untuk mengekspor video", "info");
  };


  const updateFormatState = useCallback(() => { setIsBoldActive(document.queryCommandState("bold")); setIsItalicActive(document.queryCommandState("italic")); }, []);
  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setTitleHtml(typeof html === 'string' ? html : String(html));
    }
    updateFormatState();
  }, [updateFormatState]);

  const applyFormat = useCallback((cmd: "bold" | "italic") => {
    editorRef.current?.focus();
    document.execCommand(cmd);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setTitleHtml(typeof html === 'string' ? html : String(html));
    }
    updateFormatState();
  }, [updateFormatState]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>, which: 1 | 2) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (ev) => { const r = ev.target?.result as string; if (which === 1) { setBgSrc(r); setBgT({ ...DEFAULT_BG_TRANSFORM }); } else { setBg2Src(r); setBg2T({ ...DEFAULT_BG_TRANSFORM }); } }; reader.readAsDataURL(file); e.target.value = "";
  };

  // ── Upscale BG dengan ESRGAN ───────────────────────────────────────────────
  const handleUpscaleBg = async (which: 1 | 2 = 1) => {
    const src = which === 1 ? bgSrc : bg2Src;
    if (!src) { showToast("Upload gambar BG terlebih dahulu", "error"); return; }
    if (upscaling) return;
    setUpscaling(true);
    setUpscaleProgress(0);
    setUpscaleStatus("Mempersiapkan...");
    try {
      const result = await upscaleImage(src, {
        onProgress: (pct) => setUpscaleProgress(pct),
        onStatus: (msg) => setUpscaleStatus(msg),
      });
      if (which === 1) { setBgSrc(result); setBgT({ ...DEFAULT_BG_TRANSFORM }); }
      else { setBg2Src(result); setBg2T({ ...DEFAULT_BG_TRANSFORM }); }
      showToast("Gambar berhasil di-upscale 4x!", "success");
    } catch (err: any) {
      showToast("Upscale gagal: " + (err?.message ?? "error"), "error");
    } finally {
      setUpscaling(false);
      setUpscaleProgress(0);
      setUpscaleStatus("");
    }
  };
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; if (videoUrl) URL.revokeObjectURL(videoUrl); setVideoUrl(URL.createObjectURL(file)); e.target.value = ""; };
  const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => { const reader = new FileReader(); reader.onload = (ev) => { const src = ev.target?.result as string; const s: Sticker = { id: uid(), src, x: 50, y: 30, size: 300, rotation: 0, shape: "original", outlineColor: "#ffffff", outlineWidth: 0, shadowBlur: 20 }; setStickers((p) => [...p, s]); setSelectedStickerId(s.id); setActiveTab("stickers"); }; reader.readAsDataURL(file); }); e.target.value = "";
  };

  const updateSticker = (id: string, patch: Partial<Sticker>) => setStickers((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
  const deleteSticker = (id: string) => { setStickers((p) => p.filter((s) => s.id !== id)); if (selectedStickerId === id) setSelectedStickerId(null); };
  const addExtraText = () => { const t: ExtraText = { id: uid(), text: "Teks Baru", x: 50, y: 20, fontSize: 80, color: "#ffffff", fontWeight: "bold", rotation: 0, shadowBlur: 15 }; setExtraTexts((p) => [...p, t]); setSelectedTextId(t.id); setActiveTab("texts"); };
  const updateText = (id: string, patch: Partial<ExtraText>) => setExtraTexts((p) => p.map((t) => t.id === id ? { ...t, ...patch } : t));
  const deleteText = (id: string) => { setExtraTexts((p) => p.filter((t) => t.id !== id)); if (selectedTextId === id) setSelectedTextId(null); };

  const snapBgAxis = (v: number) => Math.abs(v) < 40 ? { val: 0, snapped: true } : { val: v, snapped: false };
  const activeDrag = useRef<any>(null);
  const startDrag = useCallback((target: any, clientX: number, clientY: number) => {
    activeDrag.current = { target, lastX: clientX, lastY: clientY, startX: clientX, startY: clientY };
    if (target.type === "bg") setBgDragActive(target.which);
  }, []);

  useEffect(() => {
    const getPreviewScale = () => previewRef.current ? previewRef.current.getBoundingClientRect().width / CARD_W : 1;
    let rafId: number | null = null;
    let pendingCx = 0, pendingCy = 0;

    const applyMove = (cx: number, cy: number) => {
      if (!activeDrag.current) return;
      const sc = getPreviewScale();
      const dx = (cx - activeDrag.current.lastX) / sc;
      const dy = (cy - activeDrag.current.lastY) / sc;
      const { target } = activeDrag.current;

      if (target.type === "bg") {
        const setter = target.which === 1 ? setBgT : setBg2T;
        setter(p => { const rx = snapBgAxis(p.x + dx), ry = snapBgAxis(p.y + dy); setSnapIndicator({ x: rx.snapped, y: ry.snapped }); return { ...p, x: rx.val, y: ry.val }; });
      } else if (target.type === "sticker" && target.mode === "move") {
        const { w, h } = cardDimRef.current;
        setStickers(p => p.map(s => s.id !== target.id ? s : { ...s, x: Math.max(0, Math.min(100, s.x + (dx / w) * 100)), y: Math.max(0, Math.min(100, s.y + (dy / h) * 100)) }));
      } else if (target.type === "sticker" && target.mode === "transform") {
        setStickers(p => p.map(s => {
          if (s.id !== target.id) return s;
          const rect = previewContainerRef.current?.getBoundingClientRect();
          if (!rect) return s;
          const centerScreenX = rect.left + (s.x / 100) * rect.width;
          const centerScreenY = rect.top + (s.y / 100) * rect.height;
          const prevAngle = Math.atan2(activeDrag.current!.lastY - centerScreenY, activeDrag.current!.lastX - centerScreenX) * 180 / Math.PI;
          const currAngle = Math.atan2(cy - centerScreenY, cx - centerScreenX) * 180 / Math.PI;
          let dAngle = currAngle - prevAngle;
          if (dAngle > 180) dAngle -= 360;
          if (dAngle < -180) dAngle += 360;
          return { ...s, rotation: s.rotation + dAngle };
        }));
      } else if (target.type === "text" && target.mode === "move") {
        const { w, h } = cardDimRef.current;
        setExtraTexts(p => p.map(t => t.id !== target.id ? t : { ...t, x: t.x + (dx / w) * 100, y: t.y + (dy / h) * 100 }));
      } else if (target.type === "text" && target.mode === "transform") {
        setExtraTexts(p => p.map(t => {
          if (t.id !== target.id) return t;
          const rect = previewContainerRef.current?.getBoundingClientRect();
          if (!rect) return t;
          const centerScreenX = rect.left + (t.x / 100) * rect.width;
          const centerScreenY = rect.top + (t.y / 100) * rect.height;
          const prevAngle = Math.atan2(activeDrag.current!.lastY - centerScreenY, activeDrag.current!.lastX - centerScreenX) * 180 / Math.PI;
          const currAngle = Math.atan2(cy - centerScreenY, cx - centerScreenX) * 180 / Math.PI;
          let dAngle = currAngle - prevAngle;
          if (dAngle > 180) dAngle -= 360;
          if (dAngle < -180) dAngle += 360;
          return { ...t, rotation: t.rotation + dAngle };
        }));
      }
      activeDrag.current.lastX = cx;
      activeDrag.current.lastY = cy;
    };

    const onMove = (cx: number, cy: number) => {
      if (!activeDrag.current) return;
      pendingCx = cx; pendingCy = cy;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        applyMove(pendingCx, pendingCy);
      });
    };

    const onEnd = () => {
      activeDrag.current = null; setBgDragActive(null); setSnapIndicator({ x: false, y: false }); pinchRef.current = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch — hanya proses jika target menyentuh area preview (bukan slider)
        const target = e.target as Element;
        const isOnSlider = target?.closest?.('[data-slider]');
        if (isOnSlider) return; // biarkan slider handle sendiri
        e.preventDefault();
        const getD = (t: TouchList) => Math.sqrt((t[0].clientX - t[1].clientX) ** 2 + (t[0].clientY - t[1].clientY) ** 2);
        const dist = getD(e.touches);
        const rect = previewContainerRef.current?.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const rectMidX = rect ? rect.left + rect.width / 2 : 9999;
        const isCollage = bgModeRef.current === "collage";
        const touchedBg: 1 | 2 = (isCollage && midX > rectMidX) ? 2 : 1;
        if (!pinchRef.current) {
          pinchRef.current = { startDist: dist, startScale1: currentBgTRef.current.scale, startScale2: currentBg2TRef.current.scale, touchedBg };
        } else {
          const r = dist / pinchRef.current.startDist;
          if (pinchRef.current.touchedBg === 2 && isCollage) {
            const s2 = pinchRef.current.startScale2;
            setBg2T(p => ({ ...p, scale: Math.max(0.3, Math.min(3, s2 * r)) }));
          } else {
            const s1 = pinchRef.current.startScale1;
            setBgT(p => ({ ...p, scale: Math.max(0.3, Math.min(3, s1 * r)) }));
          }
        }
        return;
      }
      // Single touch drag — hanya preventDefault jika ada drag aktif
      if (activeDrag.current) {
        const target = e.target as Element;
        const isOnSlider = target?.closest?.('[data-slider]');
        if (isOnSlider) return; // slider handle sendiri via pointer capture
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onMouseMove = (e: MouseEvent) => { if (activeDrag.current) { e.preventDefault(); onMove(e.clientX, e.clientY); } };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, []);

  const handleBgTouch = useCallback((which: 1 | 2, e: React.TouchEvent) => { e.preventDefault(); startDrag({ type: "bg", which }, e.touches[0].clientX, e.touches[0].clientY); }, [startDrag]);
  const handleBgMouse = useCallback((which: 1 | 2, e: React.MouseEvent) => { e.preventDefault(); startDrag({ type: "bg", which }, e.clientX, e.clientY); }, [startDrag]);
  const handleStickerTouch = useCallback((id: string, mode: string, e: React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedStickerId(id);
    startDrag({ type: "sticker", id, mode }, e.touches[0].clientX, e.touches[0].clientY);
  }, [startDrag]);
  const handleStickerMouse = useCallback((id: string, mode: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedStickerId(id);
    startDrag({ type: "sticker", id, mode }, e.clientX, e.clientY);
  }, [startDrag]);
  const handleTextTouch = useCallback((id: string, mode: string, e: React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); setSelectedTextId(id); startDrag({ type: "text", id, mode }, e.touches[0].clientX, e.touches[0].clientY); }, [startDrag]);
  const handleTextMouse = useCallback((id: string, mode: string, e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setSelectedTextId(id); startDrag({ type: "text", id, mode }, e.clientX, e.clientY); }, [startDrag]);


  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();

  const handleSaveDraft = async (returnOnly = false) => {
    if (!source.trim()) { showToast("Isi sumber gambar terlebih dahulu", "error"); return; }
    if (label === "Discuss" && !titleHtml.trim()) { showToast("Isi judul terlebih dahulu", "error"); return; }

    try {
      if (!returnOnly) showToast("Menyimpan draft...", "loading", 0);

      const el = hiddenCardRef.current;
      let titleBoxMeasure: { x: number; y: number; w: number; h: number } | undefined;
      if (el) {
        el.style.visibility = "visible";
        el.style.zIndex = "9999";
        el.style.pointerEvents = "none";
        await new Promise(r => setTimeout(r, 80));
        const cardRect = el.getBoundingClientRect();
        const titleBoxEl = el.querySelector<HTMLElement>('[style*="borderRadius: 30"]');
        if (titleBoxEl) {
          const r = titleBoxEl.getBoundingClientRect();
          const scaleX = CARD_W / cardRect.width;
          const scaleY = CARD_H / cardRect.height;
          titleBoxMeasure = { x: (r.left - cardRect.left) * scaleX, y: (r.top - cardRect.top) * scaleY, w: r.width * scaleX, h: r.height * scaleY };
        }
        el.style.visibility = "hidden";
        el.style.zIndex = "-9999";
      }

      const dataUrl = await exportCardToCanvas({
        template, label, titleHtml, source, articleSource,
        bgMode, bgSrc, bgT, bg2Src, bg2T, splitAngle,
        stickers, extraTexts,
        assetRect7: imgRectangle7 as string,
        assetContent: imgContent as string,
        assetIdentityBar: imgIdentityBar as string,
        videoUrl,
        titleBoxMeasure,
      });

      let finalBgSrc = bgSrc;
      if ((!finalBgSrc || finalBgSrc === DEFAULT_BG) && videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        const ytIdMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
        if (ytIdMatch && ytIdMatch[1]) { finalBgSrc = `https://img.youtube.com/vi/${ytIdMatch[1]}/maxresdefault.jpg`; }
      }

      const draftTemplate = {
        imageDataUrl: dataUrl,
        template, label, titleHtml, source, articleSource,
        bgSrc, bgMode, bgT, bg2Src, bg2T, splitAngle,
        videoUrl, videoAspectRatio, stickers, extraTexts
      };

      const existingDraftId = locationState?.draftId;
      const now = Date.now();
      const draftData = {
        articleTitle: locationState?.articleTitle ?? stripHtml(titleHtml),
        aiTitle: titleHtml,
        aiContent: locationState?.aiContent ?? [],
        source,
        articleSource,
        imageUrl: locationState?.imageUrl ?? (videoUrl || finalBgSrc),
        videoUrl: videoUrl || undefined,
        template: draftTemplate,
        timestamp: now,
      };

      if (existingDraftId && draftStore.get(existingDraftId)) {
        await draftStore.updateDraft(existingDraftId, draftData);
      } else {
        await draftStore.create(draftData);
      }

      if (!returnOnly) {
        showToast("✅ Tersimpan!", "success");
        navigate("/jelajahi");
      }
      return draftData;
    } catch (e: any) {
      console.error("Save error full object:", e);
      if (!returnOnly) showToast("Gagal simpan: " + (e?.message ?? "coba lagi"), "error");
    } finally {
      if (hiddenCardRef.current) {
        hiddenCardRef.current.style.visibility = "hidden";
        hiddenCardRef.current.style.zIndex = "-9999";
      }
    }
  };

  const handleReset = () => { setShowConfirmReset(true); };
  const doReset = () => { setLabel("Discuss"); setTitleHtml(DEFAULT_TITLE_HTML); setBgSrc(DEFAULT_BG); setBgT({ ...DEFAULT_BG_TRANSFORM }); setStickers([]); setExtraTexts([]); if (editorRef.current) editorRef.current.innerHTML = DEFAULT_TITLE_HTML; setShowConfirmReset(false); };

  const applySourceUrl = () => {
    const url = sourceUrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setSourceUrlErr("URL harus diawali https://"); return; }
    setSourceUrlLoading(true); setSourceUrlErr(null);
    const img = new Image();
    img.onload = () => {
      setBgSrc(url); setBgT({ ...DEFAULT_BG_TRANSFORM });
      try {
        const u = new URL(url);
        const domain = u.hostname.replace(/^www\./, "");
        setSource(domain);
      } catch { }
      setSourceUrlLoading(false); setSourceUrlInput(""); setShowSourcePopup(false);
    };
    img.onerror = () => { setSourceUrlLoading(false); setSourceUrlErr("Gagal memuat gambar dari URL ini."); };
    img.crossOrigin = "anonymous"; img.src = url;
  };

  const applyBg2Url = () => {
    const url = bg2UrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setBg2UrlErr("URL harus diawali https://"); return; }
    setBg2UrlLoading(true); setBg2UrlErr(null);
    const img = new Image();
    img.onload = () => {
      setBg2Src(url); setBg2T({ ...DEFAULT_BG_TRANSFORM });
      setBg2UrlLoading(false); setBg2UrlInput(""); setShowBg2UrlPopup(false);
    };
    img.onerror = () => { setBg2UrlLoading(false); setBg2UrlErr("Gagal memuat gambar dari URL ini."); };
    img.crossOrigin = "anonymous"; img.src = url;
  };

  const applyVideoUrl = async () => {
    const url = videoUrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setVideoUrlErr("URL harus valid"); return; }

    setVideoUrlLoading(true);
    setVideoUrlErr(null);
    try {
      const res = await fetch("/api/video-dl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil video otomatis.");
      }
      if (data.url) {
        setVideoUrl(data.url);

        let newSource = "TikTok Video";
        const tikTokMatch = url.match(/tiktok\.com\/@([^/]+)/i);
        if (tikTokMatch) {
          newSource = `TikTok: @${tikTokMatch[1]}`;
        } else if (url.includes('instagram.com')) {
          newSource = "Instagram Reels";
        }
        setSource(newSource);

        setVideoUrlInput("");
        setShowVideoUrlPopup(false);
      }
    } catch (err: any) {
      setVideoUrlErr(err.message);
    } finally {
      setVideoUrlLoading(false);
    }
  };

  const PREVIEW_W = 340; const PREVIEW_H = Math.round(PREVIEW_W * (CARD_H / CARD_W)); const scale = PREVIEW_W / CARD_W;
  const commonProps = { label, titleHtml, source, articleSource, bgMode, bgSrc, bgT, bg2Src, bg2T, splitAngle, stickers, extraTexts };
  const handleInlineTitleChange = useCallback((html: string) => {
    setTitleHtml(html);
    // keep panel editor ref in sync without moving cursor
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = html;
    }
  }, []);
  const renderCard = (interactive: boolean) => {
    const p = interactive ? { ...commonProps, snapIndicator, bgDragActive, onBgTouch: handleBgTouch, onBgMouseDown: handleBgMouse, onStickerTouch: handleStickerTouch, onStickerMouseDown: handleStickerMouse, onTextTouch: handleTextTouch, onTextMouseDown: handleTextMouse, selectedStickerId, selectedTextId, onTitleChange: handleInlineTitleChange } : commonProps;
    return template === "post" ? <PostCard {...p} /> : <VideoCard {...p} videoUrl={videoUrl} videoRef={videoRef} overlayRef={overlayRef} videoAspectRatio={videoAspectRatio} />;
  };

  const TABS: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: "content", label: "Konten", icon: <FileImage size={18} /> },
    { id: "background", label: template === "video" ? "Video" : "BG", icon: <ImageIcon size={18} /> },
    { id: "stickers", label: "Stiker", icon: <Layers size={18} /> },
    { id: "texts", label: "Teks +", icon: <Type size={18} /> },
  ];

  return (
    <div className="h-[100dvh] bg-[#f8f9fa] flex flex-col overflow-hidden font-sans">
      <div ref={hiddenCardRef} style={{ position: "fixed", top: 0, left: 0, width: CARD_W, height: CARD_H, pointerEvents: "none", zIndex: -9999, visibility: "hidden" }}>{renderCard(false)}</div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBgUpload(e, 1)} />
      <input ref={file2InputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleBgUpload(e, 2)} />
      <input ref={stickerInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleStickerUpload} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />

      {/* ── HEADER ── */}
      <header className="fixed top-0 inset-x-0 h-14 bg-white/80 backdrop-blur-md z-30 flex items-center justify-between px-4 border-b border-neutral-100/50">
        <button onClick={() => navigate("/")} className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 transition text-neutral-600"><ArrowLeft size={18} /></button>
        <div className="flex bg-neutral-100 rounded-full p-1">
          <button onClick={() => setTemplate("post")} className={`px-3 py-1 text-[11px] font-bold rounded-full transition ${template === "post" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}>Post</button>
          <button onClick={() => setTemplate("video")} className={`px-3 py-1 text-[11px] font-bold rounded-full transition ${template === "video" ? "bg-white shadow-sm text-black" : "text-neutral-400"}`}>Video</button>
        </div>
        <button onClick={handleReset} title="Reset Editor" className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-red-50 hover:text-red-400 transition text-neutral-400 ml-auto mr-1"><RotateCcw size={15} /></button>

        <button
          onClick={() => handleSaveDraft()}
          disabled={exporting}
          className="flex items-center gap-2 px-3 h-9 rounded-full transition text-white shadow-sm text-xs font-bold bg-[#ff742f] active:scale-95 disabled:opacity-50"
        >
          {exporting ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{exportProgress}%</span>
            </>
          ) : (
            <>
              <Cloud size={14} />
              <span>Simpan</span>
            </>
          )}
        </button>
      </header>

      {/* ── EXPORTING OVERLAY ── */}
      {exporting && (
        <CatOverlay
          label={`Mengekspor Video... ${exportProgress}%`}
          progress={exportProgress > 0 ? exportProgress : undefined}
        />
      )}

      {/* ── PANEL CONTENT BUILDER ── rendered once to preserve refs/state */}
      {(() => {
        const panelInner = (isMobile: boolean) => (
          <>
            {/* Header */}
            <div className="h-11 flex items-center justify-between px-5 border-b border-neutral-100 shrink-0">
              <div className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                {activeTab && <span className="text-[#ff742f]">{TABS.find(t => t.id === activeTab)?.icon}</span>}
                {activeTab && TABS.find(t => t.id === activeTab)?.label}
              </div>
              <button className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:bg-neutral-200 transition" onClick={(e) => { e.stopPropagation(); setActiveTab(null); }}><X size={13} /></button>
            </div>

            <div className={`flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 ${isMobile ? "pb-6" : "pb-3"}`} style={{ overscrollBehavior: "contain" }}>
              {/* ── CONTENT ── */}
              {activeTab === "content" && (
                <>
                  {/* Label — compact dropdown row */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-medium shrink-0 w-14">Label</span>
                    <div className="relative flex-1">
                      <select className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#ff742f] focus:border-transparent pr-8"
                        value={label} onChange={(e) => setLabel(e.target.value)}>
                        {LABEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>




                  {/* Judul */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-neutral-400 font-medium">Judul</span>
                      <div className="flex gap-1">
                        {(["bold", "italic"] as const).map(c => (
                          <button key={c} onMouseDown={(e) => { e.preventDefault(); applyFormat(c) }}
                            className={`w-6 h-6 rounded flex items-center justify-center transition ${(c === "bold" ? isBoldActive : isItalicActive) ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-400 hover:text-neutral-700"}`}>
                            {c === "bold" ? <Bold size={11} /> : <Italic size={11} />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div ref={editorRef} contentEditable suppressContentEditableWarning
                      onInput={handleEditorInput} onKeyUp={updateFormatState} onMouseUp={updateFormatState}
                      className="w-full min-h-[52px] bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff742f] focus:border-transparent"
                      style={{ lineHeight: 1.5 }} />
                  </div>

                  {/* Sumber */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-medium shrink-0 w-14">Sumber</span>
                    <input
                      className={`flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff742f] border ${!source.trim() ? "bg-red-50 border-red-200 placeholder-red-300" : "bg-neutral-50 border-neutral-200"}`}
                      placeholder="Wajib diisi..." value={source} onChange={(e) => setSource(e.target.value)} />
                  </div>

                  {/* Sumber Artikel */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-medium shrink-0 w-14">Sumber Artikel</span>
                    <input
                      className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff742f] border bg-neutral-50 border-neutral-200"
                      placeholder="Opsional..." value={articleSource} onChange={(e) => setArticleSource(e.target.value)} />
                  </div>

                  {/* Konten AI dari ArticlePage */}
                  {locationState?.aiContent && locationState.aiContent.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                        Isi Artikel AI
                      </span>
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 max-h-48 overflow-y-auto flex flex-col gap-2">
                        {locationState.aiContent.map((p, i) => (
                          <p key={i} className="text-xs text-neutral-600" style={{ lineHeight: 1.7 }}>{p}</p>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const text = locationState.aiContent!.join("\n\n");
                          navigator.clipboard.writeText(text).then(() => showToast("Konten AI disalin!", "success"));
                        }}
                        className="w-full py-2 rounded-lg border border-dashed border-neutral-300 text-neutral-500 text-xs font-medium hover:border-[#ff742f] hover:text-[#ff742f] transition flex items-center justify-center gap-1.5"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        Salin Isi Artikel
                      </button>
                    </div>
                  )}

                  {template === "video" && (
                    <button onClick={() => videoInputRef.current?.click()} className="w-full py-2 border border-dashed border-neutral-300 rounded-lg text-neutral-500 text-xs font-medium hover:border-[#ff742f] hover:text-[#ff742f] transition">
                      {videoUrl ? "Ganti Video" : "+ Upload Video"}
                    </button>
                  )}
                </>
              )}

              {/* ── BACKGROUND ── */}
              {activeTab === "background" && (
                <>
                  {!videoUrl && (
                    <div className="flex bg-neutral-100 p-0.5 rounded-lg">
                      {["single", "collage"].map(m => (
                        <button key={m} onClick={() => setBgMode(m as any)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${bgMode === m ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400"}`}>
                          {m === "single" ? "1 Gambar" : "2 Gambar"}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2.5">
                    <p className="text-xs text-neutral-400 font-medium">{videoUrl ? "Video" : "Gambar Utama"}</p>
                    {!videoUrl && (
                      <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="shrink-0 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-500 hover:border-[#ff742f] hover:text-[#ff742f] transition">
                          📁 Upload
                        </button>
                        <BgUrlInput placeholder="Link URL..." onApply={(u) => { setBgSrc(u); setBgT({ ...DEFAULT_BG_TRANSFORM }); }} onSourceApply={(d) => { setSource(d); }} />
                      </div>
                    )}
                    {/* Pinch hint — gantikan slider Zoom */}
                    {!videoUrl && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
                        <span style={{ fontSize: 16 }}>🤏</span>
                        <span className="text-[11px] text-neutral-400 font-medium">Pinch di preview untuk zoom & geser gambar</span>
                      </div>
                    )}
                    {/* ── Upscale BG1 Button ── */}
                    {!videoUrl && (
                      <button
                        onClick={() => handleUpscaleBg(1)}
                        disabled={upscaling}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                        style={{ background: upscaling ? "linear-gradient(135deg,#7c3aed55,#a78bfa55)" : "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "white" }}
                      >
                        {upscaling ? (
                          <>
                            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            <span>{upscaleStatus || "Upscaling..."} {upscaleProgress > 0 ? `${upscaleProgress}%` : ""}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>Upscale Gambar 4x (ESRGAN)</span>
                          </>
                        )}
                      </button>
                    )}
                    {/* Progress bar */}
                    {upscaling && upscaleProgress > 0 && (
                      <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${upscaleProgress}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)" }}
                        />
                      </div>
                    )}
                  </div>
                  {bgMode === "collage" && !videoUrl && (
                    <div className="space-y-2.5 pt-1 border-t border-neutral-100">
                      <p className="text-xs text-neutral-400 font-medium">Gambar Kedua</p>
                      <div className="flex gap-2">
                        <button onClick={() => file2InputRef.current?.click()} className="shrink-0 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-xs text-neutral-500 hover:border-[#ff742f] hover:text-[#ff742f] transition">
                          📁 Upload
                        </button>
                        <BgUrlInput placeholder="Link URL..." onApply={(u) => { setBg2Src(u); setBg2T({ ...DEFAULT_BG_TRANSFORM }); }} />
                      </div>
                      {/* Pinch hint BG2 */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200">
                        <span style={{ fontSize: 16 }}>🤏</span>
                        <span className="text-[11px] text-neutral-400 font-medium">Pinch di sisi kanan preview untuk zoom gambar kedua</span>
                      </div>
                      {/* ── Upscale BG2 Button ── */}
                      <button
                        onClick={() => handleUpscaleBg(2)}
                        disabled={upscaling}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "white" }}
                      >
                        <Sparkles size={13} />
                        <span>Upscale Gambar 4x (ESRGAN)</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── STICKERS ── */}
              {activeTab === "stickers" && (
                <>
                  <button onClick={() => stickerInputRef.current?.click()} className="w-full py-3 bg-[#ff742f]/10 text-[#ff742f] rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-dashed border-[#ff742f]/30">
                    <Plus size={16} /> Upload Stiker
                  </button>
                  {stickers.length > 0 && (
                    <div className="grid grid-cols-5 gap-2">
                      {stickers.map(s => (
                        <button key={s.id} onClick={() => setSelectedStickerId(s.id)}
                          className={`aspect-square rounded-xl relative overflow-hidden bg-neutral-100 transition ${selectedStickerId === s.id ? "ring-2 ring-[#ff742f] ring-offset-1" : ""}`}>
                          <img src={s.src} className="w-full h-full object-cover" />
                          <button onClick={(e) => { e.stopPropagation(); deleteSticker(s.id) }} className="absolute top-0 right-0 p-0.5 bg-black/60 text-white rounded-bl"><X size={9} /></button>
                        </button>
                      ))}
                    </div>
                  )}
                  {stickers.find(s => s.id === selectedStickerId) && (() => {
                    const sel = stickers.find(s => s.id === selectedStickerId)!;
                    return (
                      <div className="bg-neutral-50 rounded-2xl p-3 space-y-3">
                        {/* Shape */}
                        <div>
                          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block mb-2">Bentuk Frame</span>
                          <div className="flex gap-2">
                            <button onClick={() => updateSticker(selectedStickerId!, { shape: "original" })}
                              className={`flex-1 py-2 flex items-center justify-center rounded-xl border-2 transition ${sel.shape === "original" ? "bg-[#ff742f] border-[#ff742f]" : "bg-white border-neutral-200"}`}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sel.shape === "original" ? "white" : "#aaa"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                            </button>
                            <button onClick={() => updateSticker(selectedStickerId!, { shape: "square" })}
                              className={`flex-1 py-2 flex items-center justify-center rounded-xl border-2 transition ${sel.shape === "square" ? "bg-[#ff742f] border-[#ff742f]" : "bg-white border-neutral-200"}`}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sel.shape === "square" ? "white" : "#aaa"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                            </button>
                            <button onClick={() => updateSticker(selectedStickerId!, { shape: "circle" })}
                              className={`flex-1 py-2 flex items-center justify-center rounded-xl border-2 transition ${sel.shape === "circle" ? "bg-[#ff742f] border-[#ff742f]" : "bg-white border-neutral-200"}`}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sel.shape === "circle" ? "white" : "#aaa"} strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
                            </button>
                          </div>
                        </div>
                        {/* Crop */}
                        <button onClick={() => setCropStickerId(selectedStickerId)}
                          className="w-full py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-600 flex items-center justify-center gap-1.5 hover:border-[#ff742f] hover:text-[#ff742f] transition">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>
                          Crop Gambar
                        </button>
                        {/* Stroke */}
                        <div>
                          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block mb-2">Stroke / Border</span>
                          <div className="flex items-center gap-2">
                            <input type="color" value={sel.outlineColor} onChange={(e) => updateSticker(selectedStickerId!, { outlineColor: e.target.value })} className="w-9 h-9 rounded-xl border-none cursor-pointer shrink-0 p-0.5 bg-white border border-neutral-200" />
                            <input type="range" min={0} max={40} value={sel.outlineWidth} onChange={(e) => updateSticker(selectedStickerId!, { outlineWidth: Number(e.target.value) })} className="flex-1 accent-[#ff742f]" />
                            <span className="text-[11px] text-neutral-400 tabular-nums w-8 text-right font-medium">{sel.outlineWidth}px</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-neutral-400 text-center pt-1">Seret stiker · Handle 🟠 untuk ukuran & putar</p>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ── TEXTS ── */}
              {activeTab === "texts" && (
                <>
                  <button onClick={addExtraText} className="w-full py-3 bg-[#ff742f]/10 text-[#ff742f] rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 border-dashed border-[#ff742f]/30">
                    <Plus size={16} /> Tambah Teks
                  </button>
                  <div className="space-y-2">
                    {extraTexts.map(t => (
                      <div key={t.id} onClick={() => setSelectedTextId(t.id)}
                        className={`p-3 rounded-xl border-2 flex items-center gap-3 bg-white transition ${selectedTextId === t.id ? "border-[#ff742f]" : "border-neutral-100"}`}>
                        <span className="text-[10px] font-bold text-neutral-300 uppercase shrink-0">T</span>
                        <input value={t.text} onChange={(e) => updateText(t.id, { text: e.target.value })} className="flex-1 text-sm bg-transparent outline-none font-medium" />
                        <button onClick={() => deleteText(t.id)} className="text-neutral-300 hover:text-red-400 transition"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                  {extraTexts.find(t => t.id === selectedTextId) && (
                    <div className="bg-neutral-50 rounded-2xl p-3 space-y-3">
                      <div className="flex gap-2">
                        <input type="color" value={extraTexts.find(t => t.id === selectedTextId)!.color} onChange={(e) => updateText(selectedTextId!, { color: e.target.value })} className="w-9 h-9 rounded-xl border border-neutral-200 p-0.5" />
                        <button onClick={() => updateText(selectedTextId!, { fontWeight: extraTexts.find(t => t.id === selectedTextId)!.fontWeight === "bold" ? "normal" : "bold" })}
                          className={`px-3 rounded-xl border text-xs font-bold transition ${extraTexts.find(t => t.id === selectedTextId)!.fontWeight === "bold" ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-500 border-neutral-200"}`}>
                          Bold
                        </button>
                      </div>
                      <Slider label="Ukuran" value={extraTexts.find(t => t.id === selectedTextId)!.fontSize} min={20} max={300} onChange={(v) => updateText(selectedTextId!, { fontSize: v })} />
                      <Slider label="Rotasi" value={extraTexts.find(t => t.id === selectedTextId)!.rotation} min={-180} max={180} onChange={(v) => updateText(selectedTextId!, { rotation: v })} suffix="°" />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        );

        const navButtons = (vertical: boolean) => TABS.map(t => (
          <button key={t.id} onClick={(e) => { e.stopPropagation(); setActiveTab(activeTab === t.id ? null : t.id); }}
            className={`flex flex-col items-center justify-center rounded-full hover:bg-neutral-50 transition gap-1 group
              ${vertical ? "w-12 h-12" : "w-16 h-12"}
              ${activeTab === t.id ? "bg-[#ff742f]/8" : ""}
            `}>
            <div className={`transition ${activeTab === t.id ? "text-[#ff742f]" : "text-neutral-400 group-hover:text-[#ff742f]"}`}>{t.icon}</div>
            <span className={`text-[9px] font-bold transition ${activeTab === t.id ? "text-[#ff742f]" : "text-neutral-400 group-hover:text-[#ff742f]"}`}>{t.label}</span>
          </button>
        ));

        if (isDesktop) {
          return (
            /* ── DESKTOP LAYOUT: centered flex row [nav] [preview] [panel] ── */
            <div className="flex-1 flex items-center justify-center pt-14 overflow-hidden">
              <div className="flex items-center gap-4">
                {/* Left floating vertical nav pill */}
                <div className="bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl px-2 py-3 flex flex-col items-center gap-1 shrink-0">
                  {navButtons(true)}
                </div>

                {/* Preview card + handle layer */}
                <div className="relative shrink-0" style={{ width: PREVIEW_W, height: PREVIEW_H }}>
                  <div ref={previewContainerRef} className="absolute inset-0 shadow-2xl shadow-neutral-200/50 rounded-lg overflow-hidden">
                    <div ref={previewRef} style={{ transformOrigin: "top left", transform: `scale(${scale})`, width: CARD_W, height: CARD_H }}>
                      {renderCard(true)}
                    </div>
                  </div>
                  {/* Sticker handles — rendered outside overflow-hidden card */}
                  {stickers.filter(s => s.id === selectedStickerId).map(s => {
                    const cx = (s.x / 100) * PREVIEW_W;
                    const cy = (s.y / 100) * PREVIEW_H;
                    const displaySize = s.size * scale;
                    const hx = cx + displaySize / 2 - 16;
                    const hy = cy + displaySize / 2 - 16;
                    return (
                      <div key={s.id + "-handle"} style={{ position: "absolute", left: hx, top: hy, width: 32, height: 32, background: "#ff742f", borderRadius: "50%", border: "3px solid white", zIndex: 20, cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.35)", transform: `rotate(${s.rotation}deg)` }}
                        onTouchStart={(e) => { e.stopPropagation(); handleStickerTouch(s.id, "transform", e); }}
                        onMouseDown={(e) => { e.stopPropagation(); handleStickerMouse(s.id, "transform", e); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-9-9" /><polyline points="16 3 21 3 21 8" /></svg>
                      </div>
                    );
                  })}
                </div>

                {/* Right floating panel */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl flex flex-col overflow-hidden shrink-0 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ width: activeTab ? 272 : 0, height: PREVIEW_H, opacity: activeTab ? 1 : 0, pointerEvents: activeTab ? "auto" : "none" }}
                >
                  {panelInner(false)}
                </div>
              </div>
            </div>
          );
        }

        // ── Smooth vertical slider component for mobile ──
        const VerticalSlider = ({ value, min, max, height, onChange, onClose, label, color = "#ff742f" }: {
          value: number; min: number; max: number; height: number;
          onChange: (v: number) => void; onClose: () => void; label: string; color?: string;
        }) => {
          const trackRef = useRef<HTMLDivElement>(null);
          const activePointerId = useRef<number | null>(null);
          const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

          const getValueFromClientY = (clientY: number) => {
            const rect = trackRef.current?.getBoundingClientRect();
            if (!rect) return value;
            const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
            return Math.round(min + ratio * (max - min));
          };

          const onPointerDown = (e: React.PointerEvent) => {
            e.preventDefault(); e.stopPropagation();
            activePointerId.current = e.pointerId;
            trackRef.current?.setPointerCapture(e.pointerId);
            onChange(getValueFromClientY(e.clientY));
          };
          const onPointerMove = (e: React.PointerEvent) => {
            if (activePointerId.current !== e.pointerId) return;
            e.preventDefault(); e.stopPropagation();
            onChange(getValueFromClientY(e.clientY));
          };
          const onPointerUp = (e: React.PointerEvent) => {
            if (activePointerId.current !== e.pointerId) return;
            activePointerId.current = null;
            trackRef.current?.releasePointerCapture(e.pointerId);
          };

          return (
            <div className="zoom-slide flex flex-col items-center gap-1.5 pointer-events-auto" style={{ height: height + 72 }}
              data-slider="true"
              onClick={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}>
              <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(20,20,20,0.5)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                <X size={11} className="text-white/80" />
              </button>
              <div className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
                style={{ background: "rgba(20,20,20,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {value}{label === "SPLIT" ? "°" : "%"}
              </div>
              {/* Track — pointer events captured on track, touch events stopped on wrapper */}
              <div ref={trackRef} className="relative rounded-full shrink-0"
                style={{ width: 24, height, background: "rgba(255,255,255,0.12)", touchAction: "none", cursor: "ns-resize", boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 3px rgba(0,0,0,0.3)" }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                {/* Fill — pointer-events none so track captures all events */}
                <div className="absolute bottom-0 left-0 right-0 rounded-full"
                  style={{ height: `${pct}%`, background: `linear-gradient(to top, ${color}, ${color}cc)`, transition: "none", pointerEvents: "none" }} />
                {/* Thumb — pointer-events none */}
                <div className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-[2.5px] border-white"
                  style={{ bottom: `calc(${pct}% - 14px)`, background: color, boxShadow: "0 3px 14px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)", transition: "none", pointerEvents: "none" }} />
              </div>
              <div className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
                style={{ background: "rgba(20,20,20,0.5)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", color, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {label}
              </div>
            </div>
          );
        };

        return (
          /* ── MOBILE LAYOUT ── */
          <>
            <style>{`
              @keyframes bubblePop {
                0% { transform: scale(0); opacity: 0; }
                70% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes zoomSlideIn {
                0% { opacity: 0; transform: translateX(16px); }
                100% { opacity: 1; transform: translateX(0); }
              }
              .bubble-pop { animation: bubblePop 0.22s cubic-bezier(0.34,1.56,0.64,1) both; }
              .zoom-slide { animation: zoomSlideIn 0.2s ease both; }
              * { -webkit-user-select: none; user-select: none; }
              input, textarea, [contenteditable], .pc-title, .vc-title { 
                -webkit-user-select: text !important; 
                user-select: text !important; 
              }
            `}</style>

            {/* ── SOURCE URL POPUP ── */}
            {showSourcePopup && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                onClick={() => setShowSourcePopup(false)}>
                <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
                  style={{ background: "rgba(22,22,22,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Gambar via Link</span>
                    <button onClick={() => setShowSourcePopup(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}><X size={13} className="text-white" /></button>
                  </div>
                  <p className="text-white/40 text-xs -mt-1">Domain akan otomatis mengisi kolom Sumber.</p>
                  <div className="flex gap-2 items-center rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <Link size={13} className="text-white/40 shrink-0" />
                    <input type="url" value={sourceUrlInput}
                      onChange={e => { setSourceUrlInput(e.target.value); setSourceUrlErr(null); }}
                      onKeyDown={e => { if (e.key === "Enter") applySourceUrl(); }}
                      placeholder="https://..." className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-white/25" autoFocus
                      style={{ fontSize: 16 }} />
                  </div>
                  {sourceUrlErr && <p className="text-red-400 text-xs">{sourceUrlErr}</p>}
                  <button onClick={applySourceUrl} disabled={sourceUrlLoading || !sourceUrlInput.trim()}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold transition disabled:opacity-40"
                    style={{ background: "#ff742f" }}>
                    {sourceUrlLoading ? "Memuat..." : "Terapkan"}
                  </button>
                </div>
              </div>
            )}

            {/* ── SUMBER POPUP ── */}
            {showSumberPopup && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                onClick={() => setShowSumberPopup(false)}>
                <div className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
                  style={{ background: "rgba(22,22,22,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Sumber Gambar</span>
                    <button onClick={() => setShowSumberPopup(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}><X size={13} className="text-white" /></button>
                  </div>
                  <div className="flex gap-2 items-center rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z" /></svg>
                    <input
                      type="text"
                      value={source}
                      onChange={e => setSource(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") setShowSumberPopup(false); }}
                      placeholder="contoh: kompas.com"
                      className="flex-1 bg-transparent text-white focus:outline-none placeholder-white/25"
                      style={{ fontSize: 16 }}
                      autoFocus
                    />
                    {source && (
                      <button onClick={() => setSource("")} className="text-white/30 hover:text-white/60 transition">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <button onClick={() => setShowSumberPopup(false)}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold"
                    style={{ background: "#ff742f" }}>Simpan</button>
                </div>
              </div>
            )}

            {/* ── BG2 URL POPUP ── */}
            {showBg2UrlPopup && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                onClick={() => setShowBg2UrlPopup(false)}>
                <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
                  style={{ background: "rgba(22,22,22,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Gambar Kedua via Link</span>
                    <button onClick={() => setShowBg2UrlPopup(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}><X size={13} className="text-white" /></button>
                  </div>
                  <div className="flex gap-2 items-center rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <Link size={13} className="text-white/40 shrink-0" />
                    <input type="url" value={bg2UrlInput}
                      onChange={e => { setBg2UrlInput(e.target.value); setBg2UrlErr(null); }}
                      onKeyDown={e => { if (e.key === "Enter") applyBg2Url(); }}
                      placeholder="https://..." className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-white/25" autoFocus
                      style={{ fontSize: 16 }} />
                  </div>
                  {bg2UrlErr && <p className="text-red-400 text-xs">{bg2UrlErr}</p>}
                  <button onClick={applyBg2Url} disabled={bg2UrlLoading || !bg2UrlInput.trim()}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold transition disabled:opacity-40"
                    style={{ background: "#ff742f" }}>
                    {bg2UrlLoading ? "Memuat..." : "Terapkan"}
                  </button>
                </div>
              </div>
            )}

            {/* ── VIDEO URL POPUP ── */}
            {showVideoUrlPopup && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                onClick={() => setShowVideoUrlPopup(false)}>
                <div className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3 shadow-2xl"
                  style={{ background: "rgba(22,22,22,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Video via Link</span>
                    <button onClick={() => setShowVideoUrlPopup(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}><X size={13} className="text-white" /></button>
                  </div>
                  <p className="text-white/40 text-xs -mt-1">Tempel link TikTok atau link mentah .mp4.</p>
                  <div className="flex gap-2 items-center rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <Link size={13} className="text-white/40 shrink-0" />
                    <input type="url" value={videoUrlInput}
                      onChange={e => { setVideoUrlInput(e.target.value); setVideoUrlErr(null); }}
                      onKeyDown={e => { if (e.key === "Enter") applyVideoUrl(); }}
                      placeholder="https://tiktok.com/..." className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-white/25" autoFocus
                      style={{ fontSize: 16 }} />
                  </div>
                  {videoUrlErr && <p className="text-red-400 text-xs">{videoUrlErr}</p>}
                  <button onClick={applyVideoUrl} disabled={videoUrlLoading || !videoUrlInput.trim()}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold transition disabled:opacity-40"
                    style={{ background: "#ff742f" }}>
                    {videoUrlLoading ? "Memuat..." : "Terapkan"}
                  </button>
                </div>
              </div>
            )}

            {showLabelPicker && (
              <div className="fixed inset-0 z-[100] flex items-end justify-center pb-24 px-4"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
                onClick={() => setShowLabelPicker(false)}>
                <div className="w-64 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: "rgba(22,22,22,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}
                  onClick={e => e.stopPropagation()}>
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                    <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Label</span>
                    <button onClick={() => setShowLabelPicker(false)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}><X size={11} className="text-white" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-0 pb-2">
                    {LABEL_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => { setLabel(opt); setShowLabelPicker(false); }}
                        className="px-3 py-2.5 text-left text-xs font-semibold transition flex items-center gap-1.5"
                        style={{ color: label === opt ? "#ff742f" : "rgba(255,255,255,0.8)", background: label === opt ? "rgba(255,116,47,0.12)" : "transparent" }}>
                        {label === opt && <div className="w-1.5 h-1.5 rounded-full bg-[#ff742f] shrink-0" />}
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TEXT EDIT POPUP ── */}
            {showTextEditPopup && selectedTextId && (() => {
              const t = extraTexts.find(x => x.id === selectedTextId);
              if (!t) return null;
              return (
                <div className="fixed inset-0 z-[100] flex items-end justify-center pb-24"
                  style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
                  onClick={() => setShowTextEditPopup(false)}>
                  <div className="w-full max-w-sm rounded-2xl p-4 flex flex-col gap-3 shadow-2xl"
                    style={{ background: "rgba(22,22,22,0.94)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)" }}
                    onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-sm">Edit Teks</span>
                      <button onClick={() => setShowTextEditPopup(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}><X size={13} className="text-white" /></button>
                    </div>
                    <textarea value={t.text} onChange={e => updateText(t.id, { text: e.target.value })}
                      rows={3} autoFocus
                      className="w-full rounded-xl px-3 py-2.5 text-white resize-none focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", fontSize: 16 }} />
                    <div className="flex gap-2">
                      <input type="color" value={t.color} onChange={e => updateText(t.id, { color: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer p-0.5" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)" }} />
                      <button onClick={() => updateText(t.id, { fontWeight: t.fontWeight === "bold" ? "normal" : "bold" })}
                        className="px-4 h-10 rounded-xl text-xs font-bold transition"
                        style={{ background: t.fontWeight === "bold" ? "#ff742f" : "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.14)" }}>
                        Bold
                      </button>
                    </div>
                    <button onClick={() => setShowTextEditPopup(false)}
                      className="w-full py-2.5 rounded-xl text-white text-sm font-bold"
                      style={{ background: "#ff742f" }}>Selesai</button>
                  </div>
                </div>
              );
            })()}

            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pt-14 pb-6">

              {/* Preview wrapper */}
              <div className="relative" style={{ width: PREVIEW_W, height: PREVIEW_H }}>

                {/* Preview card */}
                <div ref={previewContainerRef} className="absolute inset-0 shadow-2xl shadow-neutral-200/50 rounded-lg overflow-hidden">
                  <div ref={previewRef} style={{ transformOrigin: "top left", transform: `scale(${scale})`, width: CARD_W, height: CARD_H }}>
                    {renderCard(true)}
                  </div>
                </div>

                {/* Sticker rotate handles */}
                {stickers.filter(s => s.id === selectedStickerId).map(s => {
                  const cx = (s.x / 100) * PREVIEW_W;
                  const cy = (s.y / 100) * PREVIEW_H;
                  const displaySize = s.size * scale;
                  const hx = cx + displaySize / 2 - 16;
                  const hy = cy + displaySize / 2 - 16;
                  return (
                    <div key={s.id + "-rh"} style={{ position: "absolute", left: hx, top: hy, width: 32, height: 32, background: "#ff742f", borderRadius: "50%", border: "3px solid white", zIndex: 20, cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
                      onTouchStart={(e) => { e.stopPropagation(); handleStickerTouch(s.id, "transform", e); }}
                      onMouseDown={(e) => { e.stopPropagation(); handleStickerMouse(s.id, "transform", e); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-9-9" /><polyline points="16 3 21 3 21 8" /></svg>
                    </div>
                  );
                })}

                {/* Text rotate handles */}
                {extraTexts.filter(t => t.id === selectedTextId).map(t => {
                  const cx = (t.x / 100) * PREVIEW_W;
                  const cy = (t.y / 100) * PREVIEW_H;
                  const approxW = Math.min(t.fontSize * scale * t.text.length * 0.55, PREVIEW_W * 0.85);
                  const approxH = t.fontSize * scale * 1.3;
                  return (
                    <div key={t.id + "-rh"} style={{ position: "absolute", left: cx + approxW / 2 - 16, top: cy + approxH / 2 - 16, width: 32, height: 32, background: "#ff742f", borderRadius: "50%", border: "3px solid white", zIndex: 20, cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
                      onTouchStart={(e) => { e.stopPropagation(); handleTextTouch(t.id, "transform", e); }}
                      onMouseDown={(e) => { e.stopPropagation(); handleTextMouse(t.id, "transform", e); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-9-9" /><polyline points="16 3 21 3 21 8" /></svg>
                    </div>
                  );
                })}

                {/* ── FLOATING BUBBLE MENUS — left edge of preview ── */}
                {mobileBubbleTab && (() => {
                  type BubbleItem = { icon: React.ReactNode; action: () => void; danger?: boolean; active?: boolean };
                  const glassStyle = (danger?: boolean, active?: boolean) => ({
                    background: danger ? "rgba(200,38,38,0.5)" : active ? "rgba(255,116,47,0.5)" : "rgba(20,20,20,0.45)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    border: `1.5px solid ${danger ? "rgba(255,100,100,0.3)" : active ? "rgba(255,160,80,0.4)" : "rgba(255,255,255,0.18)"}`,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                    color: danger ? "#fca5a5" : "rgba(255,255,255,0.92)"
                  });

                  const configs: Record<SidebarTab, BubbleItem[]> = {
                    content: [
                      {
                        icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
                        action: () => setShowLabelPicker(true),
                        active: showLabelPicker
                      },
                      {
                        icon: <Bold size={17} />,
                        action: () => applyFormat("bold"),
                        active: isBoldActive
                      },
                      {
                        icon: <Italic size={17} />,
                        action: () => applyFormat("italic"),
                        active: isItalicActive
                      },
                      {
                        icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
                        action: () => setShowSumberPopup(true),
                        active: showSumberPopup
                      },
                    ],
                    background: template === "video" ? [
                      {
                        icon: <Plus size={17} />,
                        action: () => videoInputRef.current?.click()
                      },
                      {
                        icon: <Link size={17} />,
                        action: () => setShowVideoUrlPopup(true) // We will create this state
                      }
                    ] : [
                      {
                        icon: <ImagePlus size={17} />,
                        action: () => setShowBgSubBubbles(p => !p),
                        active: showBgSubBubbles
                      },
                      ...(bgMode === "collage" ? [{
                        icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="13" y="3" width="9" height="18" rx="2" /><path d="M13 8l-4 4 4 4" /></svg>,
                        action: () => setShowBgSub2Bubbles((p: boolean) => !p),
                        active: showBgSub2Bubbles
                      }] : []),
                      {
                        icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="9" height="18" rx="2" /><rect x="13" y="3" width="9" height="18" rx="2" /></svg>,
                        action: () => { setBgMode(p => p === "collage" ? "single" : "collage"); setShowBgSubBubbles(false); },
                        active: bgMode === "collage"
                      },
                      {
                        icon: upscaling
                          ? <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          : <Sparkles size={17} />,
                        action: () => { if (!upscaling) handleUpscaleBg(1); },
                        active: upscaling
                      },
                    ],
                    stickers: [
                      {
                        icon: <Plus size={17} />,
                        action: () => stickerInputRef.current?.click()
                      },
                      ...(selectedStickerId ? [{
                        icon: <Trash2 size={17} />,
                        action: () => { deleteSticker(selectedStickerId); },
                        danger: true
                      }] : []),
                    ],
                    texts: [
                      {
                        icon: <Type size={17} />,
                        action: () => addExtraText()
                      },
                      ...(selectedTextId ? [
                        {
                          icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
                          action: () => setShowTextEditPopup(true)
                        },
                        {
                          icon: <Trash2 size={17} />,
                          action: () => deleteText(selectedTextId),
                          danger: true
                        }
                      ] : []),
                    ],
                  };

                  const items = configs[mobileBubbleTab] ?? [];
                  return (
                    <div className="absolute left-2 flex flex-col items-center gap-2.5 z-30 pointer-events-auto"
                      style={{
                        top: "50%",
                        transform: "translateY(-50%)",
                        maxHeight: "90%",
                        overflowY: "visible",
                        opacity: bgDragActive ? 0.1 : 1,
                        transition: "opacity 0.18s ease"
                      }}
                      onClick={e => e.stopPropagation()}>
                      {items.map((b, i) => (
                        <div key={i} className="relative flex items-center gap-2">
                          <button className="bubble-pop w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90"
                            style={{ animationDelay: `${i * 0.04}s`, ...glassStyle(b.danger, b.active) }}
                            onClick={(e) => { e.stopPropagation(); b.action(); }}>
                            {b.icon}
                          </button>
                          {/* Sub-bubbles for BG1 add button */}
                          {mobileBubbleTab === "background" && i === 0 && showBgSubBubbles && (
                            <div className="flex gap-2 items-center">
                              <button className="bubble-pop w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
                                style={{ animationDelay: "0.05s", ...glassStyle() }}
                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); setShowBgSubBubbles(false); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                              </button>
                              <button className="bubble-pop w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
                                style={{ animationDelay: "0.1s", ...glassStyle() }}
                                onClick={(e) => { e.stopPropagation(); setShowSourcePopup(true); setShowBgSubBubbles(false); }}>
                                <Link size={16} />
                              </button>
                            </div>
                          )}
                          {/* Sub-bubbles for BG2 add button (collage mode) */}
                          {mobileBubbleTab === "background" && i === 1 && bgMode === "collage" && showBgSub2Bubbles && (
                            <div className="flex gap-2 items-center">
                              <button className="bubble-pop w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
                                style={{ animationDelay: "0.05s", ...glassStyle() }}
                                onClick={(e) => { e.stopPropagation(); file2InputRef.current?.click(); setShowBgSub2Bubbles(false); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                              </button>
                              <button className="bubble-pop w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
                                style={{ animationDelay: "0.1s", ...glassStyle() }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Open a separate BG2 URL popup by reusing source popup with a flag
                                  setShowBg2UrlPopup(true); setShowBgSub2Bubbles(false);
                                }}>
                                <Link size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}


                {/* ── UPSCALE PROGRESS OVERLAY ── */}
                {upscaling && (
                  <CatOverlay
                    label={upscaleStatus || "Upscaling 4x..."}
                    progress={upscaleProgress > 0 ? upscaleProgress : undefined}
                  />
                )}

                {/* ── VERTICAL ZOOM SLIDER — right edge of preview (stiker & teks saja, BG pakai pinch) ── */}
                {showZoomSlider && (() => {
                  const isSticker = stickers.some(s => s.id === zoomTarget);
                  const isText = extraTexts.some(t => t.id === zoomTarget);
                  // BG tidak pakai slider — langsung return null, pakai pinch
                  if (!isSticker && !isText) return null;
                  const zMin = 20;
                  const zMax = 200;
                  const getVal = () => {
                    const s = stickers.find(s => s.id === zoomTarget);
                    if (s) return Math.round((s.size / 300) * 100);
                    const t = extraTexts.find(t => t.id === zoomTarget);
                    if (t) return Math.round((t.fontSize / 80) * 100);
                    return 100;
                  };
                  const setVal = (v: number) => {
                    if (isSticker) { updateSticker(zoomTarget, { size: Math.max(50, Math.min(900, (v / 100) * 300)) }); return; }
                    if (isText) { updateText(zoomTarget, { fontSize: Math.max(20, Math.min(300, (v / 100) * 80)) }); return; }
                  };
                  return (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30"
                      onClick={e => e.stopPropagation()}>
                      <VerticalSlider
                        value={getVal()} min={zMin} max={zMax}
                        height={Math.round(PREVIEW_H * 0.5)}
                        onChange={setVal}
                        onClose={() => setShowZoomSlider(false)}
                        label="ZOOM"
                      />
                    </div>
                  );
                })()}
              </div>

              {/* ── MOBILE BOTTOM NAV ── */}
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-2 rounded-full"
                style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.4)" }}
                onClick={e => e.stopPropagation()}>
                {TABS.map(t => {
                  const isActive = mobileBubbleTab === t.id;
                  return (
                    <button key={t.id}
                      onClick={() => {
                        if (isActive) {
                          setMobileBubbleTab(null);
                          setActiveTab(null);
                          setShowZoomSlider(false);
                          setShowBgSubBubbles(false);
                        } else {
                          setMobileBubbleTab(t.id);
                          setActiveTab(t.id);
                          setShowBgSubBubbles(false);
                          setShowBgSub2Bubbles(false);
                          // BG tidak pakai zoom slider — pakai pinch langsung di preview
                          if (t.id === "background") { setShowZoomSlider(false); }
                          else if (t.id === "stickers") { if (selectedStickerId) { setZoomTarget(selectedStickerId); setShowZoomSlider(true); } else setShowZoomSlider(false); }
                          else if (t.id === "texts") { if (selectedTextId) { setZoomTarget(selectedTextId); setShowZoomSlider(true); } else setShowZoomSlider(false); }
                          else setShowZoomSlider(false);
                        }
                      }}
                      className="flex flex-col items-center justify-center rounded-full gap-0.5 w-14 h-12 transition-all"
                      style={{ background: isActive ? "rgba(255,116,47,0.12)" : "transparent" }}>
                      <div style={{ color: isActive ? "#ff742f" : "#9ca3af" }}>{t.icon}</div>
                      <span className="text-[9px] font-bold" style={{ color: isActive ? "#ff742f" : "#9ca3af" }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── CONFIRM RESET MODAL ── */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowConfirmReset(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl flex flex-col gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1.5">
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>Reset Editor?</span>
              <span style={{ fontSize: 13, color: "#777", lineHeight: 1.5 }}>Semua perubahan — judul, background, stiker, dan teks — akan dihapus dan tidak bisa dikembalikan.</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-3 rounded-2xl bg-neutral-100 text-neutral-700 font-bold transition active:scale-95"
                style={{ fontSize: 13 }}>Batal</button>
              <button onClick={doReset}
                className="flex-1 py-3 rounded-2xl text-white font-bold transition active:scale-95"
                style={{ fontSize: 13, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (() => {
        const cfg = {
          success: { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>, color: "#22c55e" },
          error: { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>, color: "#ef4444" },
          loading: { icon: <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>, color: "#ff742f" },
          info: { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>, color: "#a3a3a3" },
        }[toast.type];
        return (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-[fadeInDown_0.2s_ease] pointer-events-none"
            style={{ filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.35))" }}>
            <div className="bg-neutral-900 text-white text-sm font-semibold px-4 py-3 rounded-2xl flex items-center gap-2.5 whitespace-nowrap"
              style={{ border: `1px solid ${cfg.color}33` }}>
              <span style={{ color: cfg.color, display: "flex", flexShrink: 0 }}>{cfg.icon}</span>
              <span className="text-neutral-100">{toast.msg}</span>
            </div>
          </div>
        );
      })()}

      {/* ── CROP MODAL ── */}
      {cropStickerId && (() => {
        const s = stickers.find(st => st.id === cropStickerId);
        if (!s) return null;
        return <CropModal src={s.src} shape={s.shape} onDone={(cropped) => { updateSticker(cropStickerId, { src: cropped }); setCropStickerId(null); }} onClose={() => setCropStickerId(null)} />;
      })()}
    </div>
  );
}