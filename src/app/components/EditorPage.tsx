import { useState, useRef, useEffect, useCallback, useId } from "react";
import { useLocation, useNavigate } from "react-router";
import { toPng } from "html-to-image";
import svgPaths from "../../imports/svg-0zf9wwjyvn";
// Menggunakan figma:asset (Pastikan vite.config.ts sudah di-set alias-nya)
import imgImage1 from "figma:asset/8acdc84a856693a878bcf009f2c9faadb518a733.png";
import imgRectangle7 from "figma:asset/3faeab794066e6a5837760291e83a4cac94d2503.png";
import imgContent from "figma:asset/dd1da5fc74964e99895149508d6205a4d1bf1cb6.png";
import imgIdentityBar from "figma:asset/de21bf7c4db25ef35876a6b7b4b21eaa1919be07.png";

// Import FFmpeg for MP4 export
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import {
  Bold, Italic, Download, RotateCcw, ImagePlus, ChevronDown,
  Plus, Trash2, Type, Image as ImageIcon, Layers, FileImage, Link, ArrowLeft, X
} from "lucide-react";

// ── Dimensi template ──────────────────────────────────────────────────────────
const POST_W = 1740;
const POST_H = 2320;
const VIDEO_W = 1855;
const VIDEO_H = 3298;

type TemplateType = "post" | "video";

const DEFAULT_BG         = imgImage1 as string;
const DEFAULT_TITLE_HTML = 'Fanart <strong>"Dandadan"</strong> Versi Kulit Hitam Picu Perang Rasial';
const LABEL_OPTIONS      = ["Discuss","Hot Topic","Breaking","Trending","Opinion","Review","Analisis","Berita","Exclusive","Reels"];
const FONT_BOLD          = "'Gilroy-Bold', 'Nunito', sans-serif";
const FONT_HEAVY         = "'Gilroy-Heavy', 'Nunito', sans-serif";
const FONT_BOLD_ITALIC   = "'Gilroy-BoldItalic', 'Nunito', sans-serif";

interface BgTransform { x: number; y: number; scale: number; }
const DEFAULT_BG_TRANSFORM: BgTransform = { x: 0, y: 0, scale: 1.0 };

interface Sticker {
  id: string; src: string;
  x: number; y: number; size: number; rotation: number;
  shape: "original" | "circle";
  outlineColor: string; outlineWidth: number; shadowBlur: number;
}
interface ExtraText {
  id: string; text: string;
  x: number; y: number; fontSize: number; color: string;
  fontWeight: "normal" | "bold"; rotation: number; shadowBlur: number;
}
type BgMode     = "single" | "collage";
type SidebarTab = "content" | "background" | "stickers" | "texts";

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Components Helper ────────────────────────────────────────────────────────
function BgUrlInput({ placeholder, onApply }: { placeholder: string; onApply: (url: string) => void }) {
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handleApply() {
    const url = val.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setErr("URL harus diawali https://"); return; }
    setLoading(true); setErr(null);
    const img = new Image();
    img.onload = () => { setLoading(false); onApply(url); setVal(""); };
    img.onerror = () => { setLoading(false); setErr("Gagal memuat gambar."); };
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

function BgImage({ src, transform, cardH }: { src: string; transform: BgTransform; cardH: number }) {
  return <img alt="" src={src} style={{ position: "absolute", height: Math.round(cardH * transform.scale), width: "auto", maxWidth: "none", left: "50%", top: "50%", transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px))`, pointerEvents: "none", userSelect: "none" }} />;
}

function Background({ mode, src1, t1, src2, t2, splitAngle, cardW, cardH }: { mode: BgMode; src1: string; t1: BgTransform; src2: string; t2: BgTransform; splitAngle: number; cardW: number; cardH: number; }) {
  const id1 = useId().replace(/:/g, ""), id2 = useId().replace(/:/g, "");
  if (mode === "single") return <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}><BgImage src={src1} transform={t1} cardH={cardH} /></div>;
  const cx = cardW / 2, dy = Math.tan((splitAngle * Math.PI) / 180) * (cardH / 2);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <svg width="0" height="0" style={{ position: "absolute" }}><defs><clipPath id={`cl-${id1}`}><polygon points={`0,0 ${cx - dy},0 ${cx + dy},${cardH} 0,${cardH}`} /></clipPath><clipPath id={`cl-${id2}`}><polygon points={`${cx - dy},0 ${cardW},0 ${cardW},${cardH} ${cx + dy},${cardH}`} /></clipPath></defs></svg>
      <div style={{ position: "absolute", inset: 0, clipPath: `url(#cl-${id1})` }}><BgImage src={src1} transform={t1} cardH={cardH} /></div>
      <div style={{ position: "absolute", inset: 0, clipPath: `url(#cl-${id2})` }}><BgImage src={src2} transform={t2} cardH={cardH} /></div>
    </div>
  );
}

function Overlay({ cardW, cardH, stickers, extraTexts, selectedStickerId, selectedTextId, onStickerTouch, onStickerMouseDown, onTextTouch, onTextMouseDown, bgDragActive, snapIndicator }: any) {
  const snap = snapIndicator ?? { x: false, y: false };
  return (
    <>
      {stickers.map((s: any) => {
        const isSel = selectedStickerId === s.id;
        return (
          <div key={s.id} style={{ position: "absolute", left: (s.x / 100) * cardW - s.size / 2, top: (s.y / 100) * cardH - s.size / 2, width: s.size, height: s.size, zIndex: 5, transform: `rotate(${s.rotation}deg)`, filter: s.shadowBlur > 0 ? `drop-shadow(0 4px ${s.shadowBlur}px rgba(0,0,0,0.65))` : "none", borderRadius: s.shape === "circle" ? "50%" : 0, overflow: s.shape === "circle" ? "hidden" : "visible", outline: isSel ? "4px solid #ff742f" : s.outlineWidth > 0 ? `${s.outlineWidth}px solid ${s.outlineColor}` : "none", pointerEvents: (onStickerTouch || onStickerMouseDown) ? "auto" : "none", touchAction: "none" }}
            onTouchStart={onStickerTouch ? (e) => { e.stopPropagation(); onStickerTouch(s.id, e); } : undefined} onMouseDown={onStickerMouseDown ? (e) => { e.stopPropagation(); onStickerMouseDown(s.id, e); } : undefined}>
            <img alt="" src={s.src} style={{ width: "100%", height: "100%", objectFit: s.shape === "circle" ? "cover" : "contain" }} />
          </div>
        );
      })}
      {extraTexts.map((t: any) => {
        const isSel = selectedTextId === t.id;
        return (
          <div key={t.id} style={{ position: "absolute", left: `${t.x}%`, top: `${t.y}%`, zIndex: 5, transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`, fontSize: t.fontSize, fontWeight: t.fontWeight, color: t.color, whiteSpace: "pre-wrap", textAlign: "center", fontFamily: FONT_BOLD, lineHeight: 1.2, filter: t.shadowBlur > 0 ? `drop-shadow(0 2px ${t.shadowBlur}px rgba(0,0,0,0.85))` : "none", outline: isSel ? "4px solid #ff742f" : "none", outlineOffset: "8px", borderRadius: "4px", pointerEvents: (onTextTouch || onTextMouseDown) ? "auto" : "none", touchAction: "none" }}
            onTouchStart={onTextTouch ? (e) => { e.stopPropagation(); onTextTouch(t.id, e); } : undefined} onMouseDown={onTextMouseDown ? (e) => { e.stopPropagation(); onTextMouseDown(t.id, e); } : undefined}>
            {t.text}
          </div>
        );
      })}
      {bgDragActive && (
        <>
          <div style={{ position: "absolute", left: "50%", top: 0, width: snap.x ? 3 : 1, height: "100%", background: snap.x ? "#ff742f" : "rgba(255,255,255,0.3)", pointerEvents: "none", zIndex: 30, transform: "translateX(-50%)" }} />
          <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: snap.y ? 3 : 1, background: snap.y ? "#ff742f" : "rgba(255,255,255,0.3)", pointerEvents: "none", zIndex: 30, transform: "translateY(-50%)" }} />
        </>
      )}
    </>
  );
}

function NotifBadge({ label }: { label: string }) {
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "max-content", gridTemplateRows: "max-content", position: "relative" }}>
      <div style={{ gridColumn: 1, gridRow: 1, display: "flex", alignItems: "center", marginLeft: 82, marginTop: 10 }}>
        <div style={{ backgroundColor: "white", display: "flex", height: 62, alignItems: "center", paddingLeft: 24, paddingTop: 20, paddingBottom: 20 }}>
          <span style={{ fontFamily: FONT_BOLD_ITALIC, fontStyle: "italic", fontSize: 33, letterSpacing: "-0.18px", lineHeight: "22px", color: "#060200", whiteSpace: "nowrap" }}>{label}</span>
        </div>
        <div style={{ width: 36.486, height: 62, flexShrink: 0, marginLeft: -1 }}>
          <svg width="100%" height="100%" viewBox="0 0 32.0528 62" fill="none" preserveAspectRatio="none"><path d={svgPaths.p18776b80} fill="white" /></svg>
        </div>
      </div>
      <div style={{ gridColumn: 1, gridRow: 1, position: "relative", width: 82, height: 82, borderRadius: 10 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 10, backgroundColor: "#ff742f" }} />
        <img alt="" src={imgRectangle7} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, mixBlendMode: "multiply", opacity: 0.45 }} />
      </div>
      <div style={{ gridColumn: 1, gridRow: 1, marginLeft: 12, marginTop: 12, width: 58, height: 58, position: "relative" }}>
        <div style={{ position: "absolute", inset: "16.67%" }}>
          <svg width="100%" height="100%" viewBox="0 0 41.667 41.6667" fill="none" preserveAspectRatio="none"><path d={svgPaths.p29f60d00} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
        </div>
      </div>
    </div>
  );
}

// ── Card Components ──────────────────────────────────────────────────────────
function PostCard(props: any) {
  const { label, titleHtml, source, bgMode, bgSrc, bgT, bg2Src, bg2T, splitAngle, stickers, extraTexts, onBgTouch, onBgMouseDown, bgDragActive, snapIndicator, onStickerTouch, onStickerMouseDown, onTextTouch, onTextMouseDown, selectedStickerId, selectedTextId } = props;
  const interactive = !!(onBgTouch || onBgMouseDown);
  return (
    <div style={{ position: "relative", backgroundColor: "#000", overflow: "hidden", width: POST_W, height: POST_H }}>
      <style>{`.pc-title strong,.pc-title b{font-family:${FONT_HEAVY};font-style:normal;font-weight:900;}.pc-title em,.pc-title i{font-family:${FONT_BOLD_ITALIC};font-style:italic;}`}</style>
      {interactive && (<><div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(1, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(1, e) : undefined} style={{ position: "absolute", zIndex: 20, left: 0, top: 0, width: bgMode === "collage" ? "50%" : "100%", height: "100%", cursor: bgDragActive === 1 ? "grabbing" : "grab", touchAction: "none" }} />
        {bgMode === "collage" && <div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(2, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(2, e) : undefined} style={{ position: "absolute", zIndex: 20, right: 0, top: 0, width: "50%", height: "100%", cursor: bgDragActive === 2 ? "grabbing" : "grab", touchAction: "none" }} />}</>)}
      <Background mode={bgMode} src1={bgSrc} t1={bgT} src2={bg2Src} t2={bg2T} splitAngle={splitAngle} cardW={POST_W} cardH={POST_H} />
      <Overlay cardW={POST_W} cardH={POST_H} stickers={stickers} extraTexts={extraTexts} selectedStickerId={selectedStickerId} selectedTextId={selectedTextId} onStickerTouch={onStickerTouch} onStickerMouseDown={onStickerMouseDown} onTextTouch={onTextTouch} onTextMouseDown={onTextMouseDown} bgDragActive={bgDragActive} snapIndicator={snapIndicator} />
      <div style={{ position: "absolute", left: 0, top: 1600, width: "100%", height: POST_H - 1600, zIndex: 3, background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "50%", bottom: 469, transform: "translateX(-50%)", width: 1563, zIndex: 6, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 85 }}>
        <NotifBadge label={label} />
        <div style={{ position: "relative", width: "100%", borderRadius: 30, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#ff742f" }} /><img alt="" src={imgContent} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", mixBlendMode: "multiply", opacity: 0.25 }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "61px 112px 69px" }}><div className="pc-title" style={{ fontFamily: FONT_BOLD, fontSize: 90, lineHeight: "112px", color: "white", width: 1339, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: titleHtml }} /></div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 89, top: 1812.55, width: 1562.246, height: 133.453, borderRadius: 18, overflow: "hidden", zIndex: 6, pointerEvents: "none" }}><img alt="" src={imgIdentityBar} style={{ position: "absolute", left: 0, width: "100%", maxWidth: "none", top: "-1076.47%", height: "1176.47%" }} /></div>
      <div style={{ position: "absolute", left: 89, top: 2034, zIndex: 6, display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 10, backdropFilter: "blur(18.9px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", pointerEvents: "none" }}>
        <div style={{ width: 30, height: 30, flexShrink: 0 }}><svg width="100%" height="100%" viewBox="0 0 24.5 24.5" fill="none"><path d={svgPaths.p3eb20f0} fill="white" /></svg></div>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: "-0.18px", lineHeight: "22px", color: "white", whiteSpace: "nowrap" }}>{source}</span>
      </div>
    </div>
  );
}

function VideoCard(props: any) {
  const { label, titleHtml, source, bgMode, bgSrc, bgT, bg2Src, bg2T, splitAngle, videoSrc, stickers, extraTexts, onBgTouch, onBgMouseDown, bgDragActive, snapIndicator, onStickerTouch, onStickerMouseDown, onTextTouch, onTextMouseDown, selectedStickerId, selectedTextId, videoRef, overlayRef } = props;
  const interactive = !!(onBgTouch || onBgMouseDown);
  
  const togglePlay = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!videoRef?.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); }
    else { videoRef.current.pause(); }
  };

  return (
    <div style={{ position: "relative", backgroundColor: "#000", overflow: "hidden", width: VIDEO_W, height: VIDEO_H }} onClick={togglePlay}>
      <style>{`.vc-title strong,.vc-title b{font-family:${FONT_HEAVY};font-style:normal;font-weight:900;}.vc-title em,.vc-title i{font-family:${FONT_BOLD_ITALIC};font-style:italic;}`}</style>
      
      {/* ── LAYER 0: VIDEO ── */}
      {videoSrc ? (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <video ref={videoRef} src={videoSrc} loop playsInline crossOrigin="anonymous" style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(calc(-50% + ${bgT.x}px), calc(-50% + ${bgT.y}px))`, height: Math.round(VIDEO_H * bgT.scale), width: "auto", maxWidth: "none", pointerEvents: "none" }} />
          {interactive && <div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(1, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(1, e) : undefined} style={{ position: "absolute", inset: 0, zIndex: 20, cursor: bgDragActive === 1 ? "grabbing" : "grab", touchAction: "none" }} />}
        </div>
      ) : (
        <>
          {interactive && (<><div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(1, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(1, e) : undefined} style={{ position: "absolute", zIndex: 20, left: 0, top: 0, width: bgMode === "collage" ? "50%" : "100%", height: "100%", cursor: bgDragActive === 1 ? "grabbing" : "grab", touchAction: "none" }} />
            {bgMode === "collage" && <div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(2, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(2, e) : undefined} style={{ position: "absolute", zIndex: 20, right: 0, top: 0, width: "50%", height: "100%", cursor: bgDragActive === 2 ? "grabbing" : "grab", touchAction: "none" }} />}</>)}
          <Background mode={bgMode} src1={bgSrc} t1={bgT} src2={bg2Src} t2={bg2T} splitAngle={splitAngle} cardW={VIDEO_W} cardH={VIDEO_H} />
        </>
      )}

      {/* ── LAYER 1: OVERLAYS (WRAPPED FOR EXPORT) ── */}
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
        <Overlay cardW={VIDEO_W} cardH={VIDEO_H} stickers={stickers} extraTexts={extraTexts} selectedStickerId={selectedStickerId} selectedTextId={selectedTextId} onStickerTouch={onStickerTouch} onStickerMouseDown={onStickerMouseDown} onTextTouch={onTextTouch} onTextMouseDown={onTextMouseDown} bgDragActive={bgDragActive} snapIndicator={snapIndicator} />
        <div style={{ position: "absolute", left: 0, top: VIDEO_H * 0.55, width: "100%", height: VIDEO_H * 0.45, zIndex: 3, background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.82) 100%)" }} />
        <div style={{ position: "absolute", left: "50%", bottom: 949, transform: "translateX(-50%)", width: 1563, zIndex: 6, display: "flex", flexDirection: "column", gap: 85 }}>
          <NotifBadge label={label} />
          <div style={{ position: "relative", width: "100%", borderRadius: 30, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundColor: "#ff742f" }} /><img alt="" src={imgContent} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", mixBlendMode: "multiply", opacity: 0.25 }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "61px 112px 69px" }}><div className="vc-title" style={{ fontFamily: FONT_HEAVY, fontSize: 85, lineHeight: "108px", color: "white", width: 1339, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: titleHtml }} /></div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 146, top: 2310.55, width: 1562.25, height: 133.45, borderRadius: 18, overflow: "hidden", zIndex: 6 }}><img alt="" src={imgIdentityBar} style={{ position: "absolute", left: 0, width: "100%", maxWidth: "none", top: "-1076.47%", height: "1176.47%" }} /></div>
        <div style={{ position: "absolute", left: 136, top: 2544, zIndex: 7, display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 10, backdropFilter: "blur(18.9px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg><span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 22, letterSpacing: "-0.18px", lineHeight: "22px", textDecoration: "underline", color: "white", whiteSpace: "nowrap" }}>{source}</span>
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
  const locationState = location.state as { titleHtml?: string; bgUrl?: string } | null;
  const INIT_TITLE = locationState?.titleHtml ?? DEFAULT_TITLE_HTML;

  const [template, setTemplate] = useState<TemplateType>("post");
  const CARD_W = template === "post" ? POST_W : VIDEO_W;
  const CARD_H = template === "post" ? POST_H : VIDEO_H;

  const [activeTab, setActiveTab] = useState<SidebarTab | null>(null);

  const [label, setLabel]           = useState("Discuss");
  const [titleHtml, setTitleHtml]   = useState(INIT_TITLE);
  const [source, setSource]         = useState("X.com/@Lynn6Thorex");

  const [bgMode, setBgMode]         = useState<BgMode>("single");
  const [bgSrc, setBgSrc]           = useState<string>(locationState?.bgUrl ?? DEFAULT_BG);
  const [bgT, setBgT]               = useState<BgTransform>({ ...DEFAULT_BG_TRANSFORM });
  const [bg2Src, setBg2Src]         = useState<string>(DEFAULT_BG);
  const [bg2T, setBg2T]             = useState<BgTransform>({ ...DEFAULT_BG_TRANSFORM });
  const [splitAngle, setSplitAngle] = useState(8);
  const [videoSrc, setVideoSrc]     = useState<string | null>(null);

  const [stickers, setStickers]                   = useState<Sticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [extraTexts, setExtraTexts]               = useState<ExtraText[]>([]);
  const [selectedTextId, setSelectedTextId]       = useState<string | null>(null);
  const [downloading, setDownloading]             = useState(false);
  const [renderProgress, setRenderProgress]       = useState(0); // 0-100 for progress bar
  const [snapIndicator, setSnapIndicator] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const [bgDragActive, setBgDragActive] = useState<1 | 2 | null>(null);

  // Formatting state
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDist: number; startScale1: number; startScale2: number } | null>(null);
  const currentBgTRef = useRef(DEFAULT_BG_TRANSFORM);
  const currentBg2TRef = useRef(DEFAULT_BG_TRANSFORM);
  
  // Specific refs for video export
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // FFmpeg State for MP4 export
  const ffmpegRef = useRef<FFmpeg>(new FFmpeg());
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // Load FFmpeg WASM with retry and multiple CDN fallbacks
  const loadFfmpeg = async () => {
    if (ffmpegLoaded) return;
    
    const CDN_URLS = [
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core/dist/umd',
      'https://esm.sh/@ffmpeg/core@0.12.6/dist/umd',
    ];
    
    for (let attempt = 0; attempt < CDN_URLS.length; attempt++) {
      try {
        const baseURL = CDN_URLS[attempt];
        const ffmpeg = ffmpegRef.current;
        
        console.log(`Loading FFmpeg from: ${baseURL}`);
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        console.log('FFmpeg loaded successfully');
        setFfmpegLoaded(true);
        return;
      } catch (error) {
        console.error(`Failed to load FFmpeg from ${CDN_URLS[attempt]}:`, error);
        if (attempt === CDN_URLS.length - 1) {
          throw new Error('Failed to load FFmpeg from all CDN sources');
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  useEffect(() => { currentBgTRef.current = bgT; }, [bgT]);
  useEffect(() => { currentBg2TRef.current = bg2T; }, [bg2T]);
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = INIT_TITLE;
      setTitleHtml(INIT_TITLE);
    }
    // Jika datang dari ArticlePage (ada titleHtml), langsung buka panel Konten
    if (locationState?.titleHtml) {
      setActiveTab("content");
    }
  }, []);

  const updateFormatState = useCallback(() => { setIsBoldActive(document.queryCommandState("bold")); setIsItalicActive(document.queryCommandState("italic")); }, []);
  const handleEditorInput = useCallback(() => { if (editorRef.current) setTitleHtml(editorRef.current.innerHTML); updateFormatState(); }, [updateFormatState]);
  const applyFormat = useCallback((cmd: "bold" | "italic") => { editorRef.current?.focus(); document.execCommand(cmd); if (editorRef.current) setTitleHtml(editorRef.current.innerHTML); updateFormatState(); }, [updateFormatState]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>, which: 1 | 2) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (ev) => { const r = ev.target?.result as string; if (which === 1) { setBgSrc(r); setBgT({ ...DEFAULT_BG_TRANSFORM }); } else { setBg2Src(r); setBg2T({ ...DEFAULT_BG_TRANSFORM }); } }; reader.readAsDataURL(file); e.target.value = "";
  };
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; if (videoSrc) URL.revokeObjectURL(videoSrc); setVideoSrc(URL.createObjectURL(file)); e.target.value = ""; };
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
  const startDrag = useCallback((target: any, clientX: number, clientY: number) => { activeDrag.current = { target, lastX: clientX, lastY: clientY }; if (target.type === "bg") setBgDragActive(target.which); }, []);
  
  useEffect(() => {
    const onMove = (cx: number, cy: number) => { if (!activeDrag.current) return; const sc = previewRef.current ? previewRef.current.getBoundingClientRect().width / CARD_W : 1; const dx = (cx - activeDrag.current.lastX) / sc, dy = (cy - activeDrag.current.lastY) / sc; const { target } = activeDrag.current;
      if (target.type === "bg") { const setter = target.which === 1 ? setBgT : setBg2T; setter(p => { const rx = snapBgAxis(p.x + dx), ry = snapBgAxis(p.y + dy); setSnapIndicator({ x: rx.snapped, y: ry.snapped }); return { ...p, x: rx.val, y: ry.val }; }); }
      else if (target.type === "sticker") setStickers(p => p.map(s => s.id !== target.id ? s : { ...s, x: s.x + (dx/CARD_W)*100, y: s.y + (dy/CARD_H)*100 }));
      else setExtraTexts(p => p.map(t => t.id !== target.id ? t : { ...t, x: t.x + (dx/CARD_W)*100, y: t.y + (dy/CARD_H)*100 }));
      activeDrag.current.lastX = cx; activeDrag.current.lastY = cy;
    };
    const onEnd = () => { activeDrag.current = null; setBgDragActive(null); setSnapIndicator({x:false,y:false}); pinchRef.current = null; };
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 2) { e.preventDefault(); if (!pinchRef.current) { const getD = (t:TouchList)=>Math.sqrt((t[0].clientX-t[1].clientX)**2+(t[0].clientY-t[1].clientY)**2); pinchRef.current = { startDist: getD(e.touches), startScale1: currentBgTRef.current.scale, startScale2: currentBg2TRef.current.scale }; } else { const dist = Math.sqrt((e.touches[0].clientX-e.touches[1].clientX)**2+(e.touches[0].clientY-e.touches[1].clientY)**2); const r = dist / pinchRef.current.startDist; setBgT(p=>({...p, scale: Math.max(0.3,Math.min(3, pinchRef.current!.startScale1*r))})); setBg2T(p=>({...p, scale: Math.max(0.3,Math.min(3, pinchRef.current!.startScale2*r))})); } return; } if (activeDrag.current) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } };
    const onMouseMove = (e: MouseEvent) => { if(activeDrag.current) { e.preventDefault(); onMove(e.clientX, e.clientY); } };
    document.addEventListener("touchmove", onTouchMove, { passive: false }); document.addEventListener("touchend", onEnd); document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onEnd);
    return () => { document.removeEventListener("touchmove", onTouchMove); document.removeEventListener("touchend", onEnd); document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onEnd); };
  }, []);

  const handleBgTouch = useCallback((which: 1|2, e: React.TouchEvent) => { e.preventDefault(); startDrag({ type: "bg", which }, e.touches[0].clientX, e.touches[0].clientY); }, [startDrag]);
  const handleBgMouse = useCallback((which: 1|2, e: React.MouseEvent) => { e.preventDefault(); startDrag({ type: "bg", which }, e.clientX, e.clientY); }, [startDrag]);
  const handleStickerTouch = useCallback((id: string, e: React.TouchEvent) => { e.preventDefault(); setSelectedStickerId(id); setActiveTab("stickers"); startDrag({ type: "sticker", id }, e.touches[0].clientX, e.touches[0].clientY); }, [startDrag]);
  const handleStickerMouse = useCallback((id: string, e: React.MouseEvent) => { e.preventDefault(); setSelectedStickerId(id); setActiveTab("stickers"); startDrag({ type: "sticker", id }, e.clientX, e.clientY); }, [startDrag]);
  const handleTextTouch = useCallback((id: string, e: React.TouchEvent) => { e.preventDefault(); setSelectedTextId(id); setActiveTab("texts"); startDrag({ type: "text", id }, e.touches[0].clientX, e.touches[0].clientY); }, [startDrag]);
  const handleTextMouse = useCallback((id: string, e: React.MouseEvent) => { e.preventDefault(); setSelectedTextId(id); setActiveTab("texts"); startDrag({ type: "text", id }, e.clientX, e.clientY); }, [startDrag]);

  // ── EXPORT VIDEO WITH FFMPEG ──
  const handleExportVideo = async () => {
    if (!videoRef.current || !overlayRef.current) return;
    setDownloading(true);
    setRenderProgress(0);

    let ffmpegAvailable = false;
    try {
      // Phase 1: Try to Load FFmpeg
      setRenderProgress(10);
      if (!ffmpegLoaded) {
        try {
          await loadFfmpeg();
          ffmpegAvailable = true;
        } catch (ffmpegError) {
          console.warn("FFmpeg loading failed, will export as WebM", ffmpegError);
          ffmpegAvailable = false;
        }
      } else {
        ffmpegAvailable = true;
      }
      setRenderProgress(20);
      const ffmpeg = ffmpegRef.current;

      const video = videoRef.current;
      
      // Phase 2: Render Overlay
      setRenderProgress(30);
      const overlayDataUrl = await toPng(overlayRef.current, { cacheBust: true, width: VIDEO_W, height: VIDEO_H });
      const overlayImg = new Image();
      overlayImg.src = overlayDataUrl;
      await new Promise(r => overlayImg.onload = r);

      // Phase 3: Prepare Recording Canvas
      setRenderProgress(35);
      const canvas = document.createElement("canvas");
      canvas.width = VIDEO_W;
      canvas.height = VIDEO_H;
      const ctx = canvas.getContext("2d");

      // Phase 4: Capture Stream
      setRenderProgress(40);
      const stream = canvas.captureStream(30);
      if ((video as any).captureStream) {
          const vStream = (video as any).captureStream();
          const audioTracks = vStream.getAudioTracks();
          if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
      }

      // Phase 5: Record as WebM first
      let mimeType = "video/webm;codecs=vp8";
      const codecs = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];
      for (const codec of codecs) {
        if (MediaRecorder.isTypeSupported(codec)) {
          mimeType = codec;
          break;
        }
      }
      
      setRenderProgress(45);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = async () => {
            try {
                const webmBlob = new Blob(chunks, { type: "video/webm" });
                resolve(webmBlob);
            } catch (e) {
                console.error("Recording save failed:", e);
                reject(e);
            }
        };
      });
      
      recorder.start();
      setRenderProgress(50);
      video.currentTime = 0;
      await video.play();

      const totalFrames = Math.ceil(video.duration * 30);
      let frameCount = 0;
      
      const draw = () => {
        if (video.paused || video.ended) {
          recorder.stop();
          return;
        }
        ctx?.drawImage(video, 0, 0, VIDEO_W, VIDEO_H);
        ctx?.drawImage(overlayImg, 0, 0, VIDEO_W, VIDEO_H);
        frameCount++;
        // Update progress during recording (50-75%)
        setRenderProgress(50 + Math.floor((frameCount / totalFrames) * 25));
        requestAnimationFrame(draw);
      };
      draw();

      // Phase 6: Get recorded WebM blob
      setRenderProgress(75);
      const webmBlob = await recordingPromise;
      
      // Phase 7: Try to transcode to MP4 if FFmpeg available, otherwise export WebM
      if (ffmpegAvailable) {
        setRenderProgress(80);
        try {
          const webmData = await fetchFile(webmBlob);
          await ffmpeg.writeFile('input.webm', webmData);
          
          // Setup progress tracking for FFmpeg
          let lastProgress = 0;
          ffmpeg.on('progress', ({ progress }) => {
            const newProgress = 80 + Math.floor(progress * 20); // 80-100%
            if (newProgress > lastProgress) {
              lastProgress = newProgress;
              setRenderProgress(newProgress);
            }
          });
          
          // Convert to MP4 with H.264 codec (high quality, no quality loss)
          await ffmpeg.exec([
            '-i', 'input.webm',
            '-c:v', 'libx264',
            '-preset', 'slow',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
            'output.mp4'
          ]);
          
          setRenderProgress(95);
          const mp4Data = await ffmpeg.readFile('output.mp4');
          const mp4Blob = new Blob([new Uint8Array(mp4Data as any)], { type: 'video/mp4' });
          
          // Download MP4
          setRenderProgress(99);
          const url = URL.createObjectURL(mp4Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `discuss-video-${Date.now()}.mp4`;
          a.click();
          
          // Cleanup
          await ffmpeg.deleteFile('input.webm');
          await ffmpeg.deleteFile('output.mp4');
          
          setRenderProgress(100);
        } catch (transcodeError) {
          console.warn("FFmpeg transcode failed, exporting as WebM", transcodeError);
          // Fallback to WebM export
          throw new Error("FALLBACK_TO_WEBM");
        }
      } else {
        throw new Error("FALLBACK_TO_WEBM");
      }

    } catch (err) {
      // If error is fallback or FFmpeg not available, export as WebM
      if (err instanceof Error && err.message === "FALLBACK_TO_WEBM") {
        // Get the WebM blob again
        const video = videoRef.current;
        if (!video || !overlayRef.current) {
          throw new Error("Video or overlay not found");
        }
        
        setRenderProgress(80);
        
        // Re-record as WebM since we need it
        const overlayDataUrl = await toPng(overlayRef.current, { cacheBust: true, width: VIDEO_W, height: VIDEO_H });
        const overlayImg = new Image();
        overlayImg.src = overlayDataUrl;
        await new Promise(r => overlayImg.onload = r);

        const canvas = document.createElement("canvas");
        canvas.width = VIDEO_W;
        canvas.height = VIDEO_H;
        const ctx = canvas.getContext("2d");

        const stream = canvas.captureStream(30);
        if ((video as any).captureStream) {
          const vStream = (video as any).captureStream();
          const audioTracks = vStream.getAudioTracks();
          if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
        }

        let mimeType = "video/webm;codecs=vp8";
        const codecs = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];
        for (const codec of codecs) {
          if (MediaRecorder.isTypeSupported(codec)) {
            mimeType = codec;
            break;
          }
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        const recordingPromise = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const webmBlob = new Blob(chunks, { type: "video/webm" });
            const url = URL.createObjectURL(webmBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `discuss-video-${Date.now()}.webm`;
            a.click();
            resolve();
          };
        });

        recorder.start();
        setRenderProgress(85);
        video.currentTime = 0;
        await video.play();

        const totalFrames = Math.ceil(video.duration * 30);
        let frameCount = 0;

        const draw = () => {
          if (video.paused || video.ended) {
            recorder.stop();
            return;
          }
          ctx?.drawImage(video, 0, 0, VIDEO_W, VIDEO_H);
          ctx?.drawImage(overlayImg, 0, 0, VIDEO_W, VIDEO_H);
          frameCount++;
          setRenderProgress(85 + Math.floor((frameCount / totalFrames) * 15));
          requestAnimationFrame(draw);
        };
        draw();

        await recordingPromise;
        setRenderProgress(100);
        console.log("Video exported as WebM format");
      } else {
        console.error("Video export error:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        alert(`Video export error:\n${errorMsg}\n\nMake sure:\n1. Your internet connection is stable\n2. You have enough disk space`);
        setRenderProgress(0);
      }
    } finally {
      setDownloading(false);
      setTimeout(() => setRenderProgress(0), 500);
    }
  };

  const handleDownload = async () => {
    if (template === "video") {
        await handleExportVideo();
        return;
    }
    // IMAGE EXPORT
    if (!hiddenCardRef.current) return; setDownloading(true);
    try {
      const el = hiddenCardRef.current; el.style.visibility = "visible"; el.style.zIndex = "9999";
      await new Promise(r => setTimeout(r, 500));
      const dataUrl = await toPng(el, { width: CARD_W, height: CARD_H, cacheBust: true });
      const link = document.createElement("a"); link.download = `discuss-${template}-${label}.png`; link.href = dataUrl; link.click();
    } catch (e) { alert("Gagal export."); } finally { if (hiddenCardRef.current) { hiddenCardRef.current.style.visibility = "hidden"; hiddenCardRef.current.style.zIndex = "-9999"; } setDownloading(false); }
  };
  
  const handleReset = () => { setLabel("Discuss"); setTitleHtml(DEFAULT_TITLE_HTML); setBgSrc(DEFAULT_BG); setBgT({...DEFAULT_BG_TRANSFORM}); setStickers([]); setExtraTexts([]); if(editorRef.current) editorRef.current.innerHTML = DEFAULT_TITLE_HTML; };

  const PREVIEW_W = 340; const PREVIEW_H = Math.round(PREVIEW_W * (CARD_H / CARD_W)); const scale = PREVIEW_W / CARD_W;
  const commonProps = { label, titleHtml, source, bgMode, bgSrc, bgT, bg2Src, bg2T, splitAngle, stickers, extraTexts };
  const renderCard = (interactive: boolean) => {
    const p = interactive ? { ...commonProps, snapIndicator, bgDragActive, onBgTouch: handleBgTouch, onBgMouseDown: handleBgMouse, onStickerTouch: handleStickerTouch, onStickerMouseDown: handleStickerMouse, onTextTouch: handleTextTouch, onTextMouseDown: handleTextMouse, selectedStickerId, selectedTextId } : commonProps;
    return template === "post" ? <PostCard {...p} /> : <VideoCard {...p} videoSrc={videoSrc} videoRef={videoRef} overlayRef={overlayRef} />;
  };

  const TABS: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: "content",    label: "Konten",  icon: <FileImage size={18} /> },
    { id: "background", label: "BG",      icon: <ImageIcon size={18} /> },
    { id: "stickers",   label: "Stiker",  icon: <Layers size={18} /> },
    { id: "texts",      label: "Teks +",  icon: <Type size={18} /> },
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
        
        {/* Download/Render Button with Circular Progress */}
        <div className="relative">
          {renderProgress > 0 && (
            <svg className="absolute -inset-1.5" viewBox="0 0 36 36" style={{ width: 36, height: 36 }}>
              {/* Background circle */}
              <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="2" />
              {/* Progress circle */}
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#ff742f"
                strokeWidth="2"
                strokeDasharray={`${(renderProgress / 100) * 94.2} 94.2`}
                strokeLinecap="round"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                  transition: 'stroke-dasharray 0.3s ease'
                }}
              />
            </svg>
          )}
          <button 
            onClick={handleDownload} 
            disabled={downloading} 
            className={`relative z-10 flex items-center gap-2 px-3 h-9 rounded-full transition text-white shadow-sm text-xs font-bold ${downloading ? "bg-neutral-300" : "bg-[#ff742f]"}`}
          >
            <Download size={14} />
            {downloading ? (template === "video" ? `${renderProgress}%` : "Menyimpan...") : "Download"}
          </button>
        </div>
      </header>

      {/* ── PREVIEW ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pt-14 pb-24" onClick={() => setActiveTab(null)}>
        <div className="relative shadow-2xl shadow-neutral-200/50 rounded-lg overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" 
             style={{ 
               width: PREVIEW_W, 
               height: PREVIEW_H, 
               transform: activeTab ? "translateY(-22vh) scale(0.85)" : "translateY(0) scale(1)",
               transformOrigin: "center center"
             }}>
          <div ref={previewRef} style={{ transformOrigin: "top left", transform: `scale(${scale})`, width: CARD_W, height: CARD_H }}>
            {renderCard(true)}
          </div>
        </div>
        {!activeTab && <div className="absolute bottom-28 px-4 py-2 bg-black/5 backdrop-blur rounded-full text-[10px] font-medium text-neutral-500 pointer-events-none">Cubit layar untuk zoom · Seret untuk geser</div>}
      </div>

      {/* ── FLOATING NAV ── */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full px-2 py-2 flex items-center gap-1 transition-all duration-300 ${activeTab ? "translate-y-[150%] opacity-0" : "translate-y-0 opacity-100"}`}>
        {TABS.map(t => (
          <button key={t.id} onClick={(e) => { e.stopPropagation(); setActiveTab(t.id); }} className="flex flex-col items-center justify-center w-16 h-12 rounded-full hover:bg-neutral-50 transition gap-1 group">
            <div className="text-neutral-400 group-hover:text-[#ff742f] transition">{t.icon}</div>
            <span className="text-[9px] font-bold text-neutral-400 group-hover:text-[#ff742f] transition">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── BOTTOM SHEET CONTENT (INLINED) ── */}
      <div className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-[0_-4px_30px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out flex flex-col ${activeTab ? "translate-y-0" : "translate-y-[100%]"}`} style={{ height: "45vh" }}>
        <div className="h-12 flex items-center justify-between px-6 border-b border-neutral-100 shrink-0" onClick={() => setActiveTab(null)}>
          <div className="text-xs font-bold text-neutral-900 flex items-center gap-2">
             {activeTab && TABS.find(t => t.id === activeTab)?.icon} 
             {activeTab && TABS.find(t => t.id === activeTab)?.label}
          </div>
          <button className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500"><X size={14}/></button>
        </div>
        
        {/* PANEL CONTENT - DI-RENDER LANGSUNG AGAR STATE AMAN */}
        <div className="flex-1 overflow-y-auto p-5 pb-20 flex flex-col gap-5">
            {activeTab === "content" && (
                <>
                <div><label className="text-xs text-neutral-400 font-medium mb-1.5 block">Label</label><div className="relative"><select className="w-full bg-neutral-50 border-none rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-700 appearance-none focus:ring-2 focus:ring-[#ff742f]" value={label} onChange={(e) => setLabel(e.target.value)}>{LABEL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" /></div></div>
                <div><label className="text-xs text-neutral-400 font-medium mb-1.5 block">Judul</label>
                    <div className="flex gap-2 mb-2">{["bold","italic"].map(c => <button key={c} onMouseDown={(e)=>{e.preventDefault(); applyFormat(c as any)}} className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${((c==="bold"?isBoldActive:isItalicActive))?"bg-neutral-800 text-white":"bg-neutral-100 text-neutral-500"}`}>{c==="bold"?<Bold size={14}/>:<Italic size={14}/>}</button>)}</div>
                    <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={handleEditorInput} onKeyUp={updateFormatState} onMouseUp={updateFormatState} className="w-full min-h-[80px] bg-neutral-50 rounded-xl px-3 py-3 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff742f]" style={{lineHeight:1.6}} />
                </div>
                <div><label className="text-xs text-neutral-400 font-medium mb-1.5 block">Sumber</label><input className="w-full bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:ring-[#ff742f]" value={source} onChange={(e) => setSource(e.target.value)} /></div>
                {template === "video" && <button onClick={() => videoInputRef.current?.click()} className="w-full py-3 border border-dashed border-neutral-300 rounded-xl text-neutral-500 text-xs font-medium hover:border-[#ff742f] hover:text-[#ff742f]">{videoSrc ? "Ganti Video" : "Upload Video"}</button>}
                </>
            )}
            {activeTab === "background" && (
                <>
                {!videoSrc && <div className="flex bg-neutral-100 p-1 rounded-xl">{["single","collage"].map((m) => <button key={m} onClick={() => setBgMode(m as any)} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${bgMode === m ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400"}`}>{m === "single" ? "1 Gambar" : "2 Gambar"}</button>)}</div>}
                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold text-neutral-900 mb-2">{videoSrc ? "Video" : "Gambar Utama"}</div>
                        {!videoSrc && <div className="flex gap-2 mb-3"><button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs text-neutral-500 hover:border-[#ff742f]">Upload</button><div className="flex-1"><BgUrlInput placeholder="Link..." onApply={(u) => { setBgSrc(u); setBgT({...DEFAULT_BG_TRANSFORM}); }} /></div></div>}
                        <Slider label="Zoom" value={Math.round(bgT.scale*100)} min={30} max={300} onChange={(v)=>setBgT(p=>({...p, scale:v/100}))} suffix="%" />
                    </div>
                    {bgMode === "collage" && !videoSrc && (
                        <div>
                        <div className="text-xs font-semibold text-neutral-900 mb-2">Gambar Kedua</div>
                        <div className="flex gap-2 mb-3"><button onClick={() => file2InputRef.current?.click()} className="flex-1 py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs text-neutral-500 hover:border-[#ff742f]">Upload</button><div className="flex-1"><BgUrlInput placeholder="Link..." onApply={(u) => { setBg2Src(u); setBg2T({...DEFAULT_BG_TRANSFORM}); }} /></div></div>
                        <Slider label="Zoom" value={Math.round(bg2T.scale*100)} min={30} max={300} onChange={(v)=>setBg2T(p=>({...p, scale:v/100}))} suffix="%" />
                        <div className="mt-3"><Slider label="Kemiringan" value={splitAngle} min={-30} max={30} onChange={setSplitAngle} suffix="°" /></div>
                        </div>
                    )}
                </div>
                </>
            )}
            {activeTab === "stickers" && (
                <>
                <button onClick={() => stickerInputRef.current?.click()} className="w-full py-3 bg-[#ff742f]/10 text-[#ff742f] rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Plus size={16}/> Upload Stiker</button>
                {stickers.length > 0 && <div className="grid grid-cols-4 gap-2">{stickers.map((s,i) => <button key={s.id} onClick={() => setSelectedStickerId(s.id)} className={`aspect-square rounded-xl border-2 flex items-center justify-center relative overflow-hidden bg-white ${selectedStickerId===s.id?"border-[#ff742f]":"border-transparent"}`}><img src={s.src} className="w-full h-full object-cover"/><button onClick={(e)=>{e.stopPropagation();deleteSticker(s.id)}} className="absolute top-0 right-0 p-1 bg-black/50 text-white"><X size={10}/></button></button>)}</div>}
                {stickers.find(s=>s.id===selectedStickerId) && (
                    <div className="bg-neutral-50 p-3 rounded-xl space-y-3">
                        <Slider label="Ukuran" value={stickers.find(s=>s.id===selectedStickerId)!.size} min={50} max={600} onChange={(v)=>updateSticker(selectedStickerId!, {size:v})} />
                        <Slider label="Rotasi" value={stickers.find(s=>s.id===selectedStickerId)!.rotation} min={-180} max={180} onChange={(v)=>updateSticker(selectedStickerId!, {rotation:v})} suffix="°" />
                    </div>
                )}
                </>
            )}
            {activeTab === "texts" && (
                <>
                <button onClick={addExtraText} className="w-full py-3 bg-[#ff742f]/10 text-[#ff742f] rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Plus size={16}/> Tambah Teks</button>
                {extraTexts.map((t) => <div key={t.id} onClick={()=>setSelectedTextId(t.id)} className={`p-3 rounded-xl border flex items-center gap-3 bg-white ${selectedTextId===t.id?"border-[#ff742f]":"border-neutral-100"}`}><span className="text-xs font-bold text-neutral-400 flex-shrink-0">Teks</span><input value={t.text} onChange={(e)=>updateText(t.id, {text:e.target.value})} className="flex-1 text-sm bg-transparent outline-none font-medium"/><button onClick={()=>deleteText(t.id)} className="text-neutral-300 hover:text-red-500"><Trash2 size={14}/></button></div>)}
                {extraTexts.find(t=>t.id===selectedTextId) && (
                    <div className="bg-neutral-50 p-3 rounded-xl space-y-3">
                        <div className="flex gap-2"><input type="color" value={extraTexts.find(t=>t.id===selectedTextId)!.color} onChange={(e)=>updateText(selectedTextId!, {color:e.target.value})} className="w-8 h-8 rounded-lg border-none"/><button onClick={()=>updateText(selectedTextId!, {fontWeight: extraTexts.find(t=>t.id===selectedTextId)!.fontWeight==="bold"?"normal":"bold"})} className="px-3 rounded-lg bg-white border text-xs font-bold">Bold</button></div>
                        <Slider label="Ukuran" value={extraTexts.find(t=>t.id===selectedTextId)!.fontSize} min={20} max={300} onChange={(v)=>updateText(selectedTextId!, {fontSize:v})} />
                        <Slider label="Rotasi" value={extraTexts.find(t=>t.id===selectedTextId)!.rotation} min={-180} max={180} onChange={(v)=>updateText(selectedTextId!, {rotation:v})} suffix="°" />
                    </div>
                )}
                </>
            )}
        </div>
      </div>
    </div>
  );
}