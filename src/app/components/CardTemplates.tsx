import { useRef, useEffect, useId } from "react";
import svgPaths from "../../imports/svg-0zf9wwjyvn";
import imgImage1 from "figma:asset/8acdc84a856693a878bcf009f2c9faadb518a733.png";
import imgRectangle7 from "figma:asset/3faeab794066e6a5837760291e83a4cac94d2503.png";
import imgContent from "figma:asset/dd1da5fc74964e99895149508d6205a4d1bf1cb6.png";
import imgIdentityBar from "figma:asset/de21bf7c4db25ef35876a6b7b4b21eaa1919be07.png";

export const POST_W = 1740;
export const POST_H = 2320;
export const VIDEO_W = 1856;
export const VIDEO_H = 3298;

export interface BgTransform { x: number; y: number; scale: number; }
export type BgMode = "single" | "collage";

export interface Sticker {
  id: string;
  src: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  shape: "original" | "square" | "circle";
  outlineWidth: number;
  outlineColor: string;
  shadowBlur: number;
}

export interface ExtraText {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  fontWeight: string;
  fontStyle?: string;
  color: string;
  shadowBlur: number;
}

export const DEFAULT_BG = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1764&auto=format&fit=crop";
export const LINK_BG = "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1740&auto=format&fit=crop";
export const DEFAULT_TITLE_HTML = "Update Hari Ini <b>Otaku</b> Terlengkap <i>Simak Disini!</i>";

export const DEFAULT_BG_TRANSFORM: BgTransform = { x: 0, y: 0, scale: 1 };

export const LABEL_OPTIONS = [
  "Discuss", "Fact", "Teori", "Update", "Info", "News", "Hot", "Viral", "Special", "Misteri"
];

export const FONT_REGULAR = "Gilroy, 'Nunito', sans-serif";
export const FONT_BOLD = "Gilroy, 'Nunito', sans-serif";
export const FONT_ITALIC = "Gilroy, 'Nunito', sans-serif";
export const FONT_BOLD_ITALIC = "Gilroy, 'Nunito', sans-serif";

// ── Components Helper ────────────────────────────────────────────────────────

export function BgImage({ src, transform, cardH }: { src: string; transform: BgTransform; cardH: number }) {
  return <img alt="" crossOrigin="anonymous" src={src} style={{ position: "absolute", height: Math.round(cardH * transform.scale), width: "auto", maxWidth: "none", left: "50%", top: "50%", transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px))`, pointerEvents: "none", userSelect: "none" }} />;
}

export function Background({ mode, src1, t1, src2, t2, splitAngle, cardW, cardH }: { mode: BgMode; src1: string; t1: BgTransform; src2: string; t2: BgTransform; splitAngle: number; cardW: number; cardH: number; }) {
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

export function Overlay({ cardW, cardH, stickers, extraTexts, selectedStickerId, selectedTextId, onStickerTouch, onStickerMouseDown, onTextTouch, onTextMouseDown, bgDragActive, snapIndicator }: any) {
  const snap = snapIndicator ?? { x: false, y: false };
  return (
    <>
      {(stickers ?? []).map((s: any) => {
        const isSel = selectedStickerId === s.id;
        const isCircle = s.shape === "circle";
        const isSquare = s.shape === "square";
        const borderRadius = isCircle ? "50%" : isSquare ? "12px" : 0;
        const strokeShadow = s.outlineWidth > 0 ? `inset 0 0 0 ${s.outlineWidth}px ${s.outlineColor}` : "";
        const selBoxShadow = isSel
          ? `0 0 0 3px #ff742f${strokeShadow ? `, ${strokeShadow}` : ""}`
          : strokeShadow || undefined;
        const selFilter = isSel
          ? `drop-shadow(0 0 4px #ff742f)${s.shadowBlur > 0 ? ` drop-shadow(0 4px ${s.shadowBlur}px rgba(0,0,0,0.65))` : ""}`
          : s.shadowBlur > 0 ? `drop-shadow(0 4px ${s.shadowBlur}px rgba(0,0,0,0.65))` : "none";
        const canInteract = !!(onStickerTouch || onStickerMouseDown);

        return (
          <div key={s.id} style={{ position: "absolute", left: (s.x / 100) * cardW - s.size / 2, top: (s.y / 100) * cardH - s.size / 2, width: s.size, height: s.size, zIndex: 5, transform: `rotate(${s.rotation}deg)`, pointerEvents: canInteract ? "auto" : "none", touchAction: "none" }}
            onTouchStart={onStickerTouch ? (e) => { e.stopPropagation(); onStickerTouch(s.id, "move", e); } : undefined}
            onMouseDown={onStickerMouseDown ? (e) => { e.stopPropagation(); onStickerMouseDown(s.id, "move", e); } : undefined}>
            <div style={{ width: "100%", height: "100%", borderRadius, overflow: (isCircle || isSquare) ? "hidden" : "visible", ...(isCircle || isSquare ? { boxShadow: selBoxShadow } : { filter: selFilter }) }}>
              <img alt="" src={s.src} style={{ width: "100%", height: "100%", objectFit: (isCircle || isSquare) ? "cover" : "contain", display: "block" }} />
            </div>
          </div>
        );
      })}
      {(extraTexts ?? []).map((t: any) => {
        const isSel = selectedTextId === t.id;
        return (
          <div key={t.id} style={{ position: "absolute", left: `${t.x}%`, top: `${t.y}%`, zIndex: 5, transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`, fontSize: t.fontSize, fontWeight: t.fontWeight, color: t.color, whiteSpace: "pre-wrap", textAlign: "center", fontFamily: FONT_BOLD, lineHeight: 1.2, filter: t.shadowBlur > 0 ? `drop-shadow(0 2px ${t.shadowBlur}px rgba(0,0,0,0.85))` : "none", outline: isSel ? "4px solid #ff742f" : "none", outlineOffset: "8px", borderRadius: "4px", pointerEvents: (onTextTouch || onTextMouseDown) ? "auto" : "none", touchAction: "none", userSelect: "none" }}
            onTouchStart={onTextTouch ? (e) => { e.stopPropagation(); onTextTouch(t.id, "move", e); } : undefined}
            onMouseDown={onTextMouseDown ? (e) => { e.stopPropagation(); onTextMouseDown(t.id, "move", e); } : undefined}>
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

export function NotifBadge({ label }: { label: string }) {
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "max-content", gridTemplateRows: "max-content", position: "relative" }}>
      <div style={{ gridColumn: 1, gridRow: 1, display: "flex", alignItems: "center", marginLeft: 82, marginTop: 10 }}>
        <div style={{ backgroundColor: "white", display: "flex", height: 62, alignItems: "center", paddingLeft: 24, paddingTop: 20, paddingBottom: 20 }}>
          <span style={{ fontFamily: FONT_ITALIC, fontStyle: "italic", fontSize: 33, letterSpacing: "-0.18px", lineHeight: "22px", color: "#060200", whiteSpace: "nowrap" }}>{label}</span>
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

export function PostCard(props: any) {
  const {
    label, titleHtml, source, articleSource,
    bgMode = "single", bgSrc,
    bgT = { x: 0, y: 0, scale: 1 },
    bg2Src,
    bg2T = { x: 0, y: 0, scale: 1 },
    splitAngle = 0, stickers = [], extraTexts = [],
    onBgTouch, onBgMouseDown, bgDragActive, snapIndicator,
    onStickerTouch, onStickerMouseDown, onTextTouch, onTextMouseDown,
    selectedStickerId, selectedTextId, onTitleChange
  } = props;
  const interactive = !!(onBgTouch || onBgMouseDown);
  const inlineTitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inlineTitleRef.current) inlineTitleRef.current.innerHTML = titleHtml;
  }, []);

  useEffect(() => {
    const el = inlineTitleRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerHTML !== titleHtml) el.innerHTML = titleHtml;
  }, [titleHtml]);

  return (
    <div style={{ position: "relative", backgroundColor: "#000", overflow: "hidden", width: POST_W, height: POST_H }}>
      <style>{`
        .pc-title strong, .pc-title b { font-family: Gilroy; font-style: normal; font-weight: 700; }
        .pc-title em, .pc-title i { font-family: Gilroy; font-style: italic; font-weight: 400; }
        .pc-title b i, .pc-title i b, .pc-title strong em, .pc-title em strong { font-family: Gilroy; font-weight: 700; font-style: italic; }
        .pc-title:focus { outline: none; box-shadow: 0 0 0 6px rgba(255,255,255,0.25); border-radius: 8px; }
      `}</style>
      <Background mode={bgMode} src1={bgSrc} t1={bgT} src2={bg2Src} t2={bg2T} splitAngle={splitAngle} cardW={POST_W} cardH={POST_H} />

      {interactive && (
        <>
          <div onTouchStart={(e) => { e.stopPropagation(); onBgTouch?.(1, e); }} onMouseDown={(e) => onBgMouseDown?.(1, e)}
            style={{ position: "absolute", zIndex: 2, left: 0, top: 0, width: bgMode === "collage" ? "50%" : "100%", height: "100%", cursor: bgDragActive === 1 ? "grabbing" : "grab", touchAction: "none" }} />
          {bgMode === "collage" && <div onTouchStart={(e) => { e.stopPropagation(); onBgTouch?.(2, e); }} onMouseDown={(e) => onBgMouseDown?.(2, e)}
            style={{ position: "absolute", zIndex: 2, right: 0, top: 0, width: "50%", height: "100%", cursor: bgDragActive === 2 ? "grabbing" : "grab", touchAction: "none" }} />}
        </>
      )}

      <div style={{ position: "absolute", left: 0, top: 1600, width: "100%", height: POST_H - 1600, zIndex: 3, background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)", pointerEvents: "none" }} />

      <Overlay cardW={POST_W} cardH={POST_H} stickers={stickers} extraTexts={extraTexts} selectedStickerId={selectedStickerId} selectedTextId={selectedTextId} onStickerTouch={onStickerTouch} onStickerMouseDown={onStickerMouseDown} onTextTouch={onTextTouch} onTextMouseDown={onTextMouseDown} bgDragActive={bgDragActive} snapIndicator={snapIndicator} />

      <div style={{ position: "absolute", left: "50%", bottom: 469, transform: "translateX(-50%)", width: 1563, zIndex: 6, display: "flex", flexDirection: "column", gap: 85, pointerEvents: interactive ? "auto" : "none" }}>
        <div style={{ pointerEvents: "none" }}><NotifBadge label={label} /></div>
        <div style={{ position: "relative", width: "100%", borderRadius: 30, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#ff742f" }} />
          <img alt="" src={imgContent} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", mixBlendMode: "multiply", opacity: 0.25 }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "61px 112px 69px" }}>
            <div ref={inlineTitleRef} className="pc-title"
              contentEditable={interactive} suppressContentEditableWarning
              onInput={interactive ? (e: any) => onTitleChange?.(e.target.innerHTML) : undefined}
              style={{ fontFamily: FONT_REGULAR, fontSize: 90, lineHeight: "112px", color: "white", width: 1339, overflow: "hidden", textAlign: "left", outline: "none" }} />
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 89, top: 1812.55, width: 1562.246, height: 133.453, borderRadius: 18, overflow: "hidden", zIndex: 50, pointerEvents: "none" }}>
        <img alt="" src={imgIdentityBar} style={{ position: "absolute", left: 0, width: "100%", maxWidth: "none", top: "-1076.47%", height: "1176.47%" }} />
      </div>

      <div style={{ position: "absolute", left: 89, top: 2034, zIndex: 50, display: "flex", alignItems: "center", gap: 20, pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 10, backdropFilter: "blur(18.9px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
          <div style={{ width: 30, height: 30, flexShrink: 0 }}><svg width="100%" height="100%" viewBox="0 0 24.5 24.5" fill="none"><path d={svgPaths.p3eb20f0} fill="white" /></svg></div>
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: "-0.18px", lineHeight: "22px", color: "white", whiteSpace: "nowrap" }}>{source}</span>
        </div>
        {articleSource && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 10, backdropFilter: "blur(18.9px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
            <div style={{ width: 30, height: 30, flexShrink: 0 }}><svg width="100%" height="100%" viewBox="0 0 24.5 24.5" fill="none"><path d={svgPaths.p3eb20f0} fill="white" /></svg></div>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: "-0.18px", lineHeight: "22px", color: "white", whiteSpace: "nowrap" }}>{articleSource}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoCard(props: any) {
  const {
    label, titleHtml, source, articleSource,
    bgMode = "single", bgSrc,
    bgT = { x: 0, y: 0, scale: 1 },
    bg2Src,
    bg2T = { x: 0, y: 0, scale: 1 },
    splitAngle = 0, videoUrl,
    videoAspectRatio = "9:16",
    stickers = [], extraTexts = [],
    onBgTouch, onBgMouseDown, bgDragActive, snapIndicator,
    onStickerTouch, onStickerMouseDown, onTextTouch, onTextMouseDown,
    selectedStickerId, selectedTextId, videoRef, overlayRef, onTitleChange
  } = props;
  const is34 = videoAspectRatio === "3:4";
  const cardW = is34 ? POST_W : VIDEO_W;
  const cardH = is34 ? POST_H : VIDEO_H;
  const interactive = !!(onBgTouch || onBgMouseDown);
  const inlineTitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inlineTitleRef.current) inlineTitleRef.current.innerHTML = titleHtml;
  }, []);

  useEffect(() => {
    const el = inlineTitleRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerHTML !== titleHtml) el.innerHTML = titleHtml;
  }, [titleHtml]);

  const togglePlay = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!videoRef?.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); }
    else { videoRef.current.pause(); }
  };

  return (
    <div style={{ position: "relative", backgroundColor: "#000", overflow: "hidden", width: cardW, height: cardH }} onClick={togglePlay}>
      <style>{`
        .vc-title strong, .vc-title b { font-family: Gilroy; font-style: normal; font-weight: 700; }
        .vc-title em, .vc-title i { font-family: Gilroy; font-style: italic; font-weight: 400; }
        .vc-title b i, .vc-title i b, .vc-title strong em, .vc-title em strong { font-family: Gilroy; font-weight: 700; font-style: italic; }
      `}</style>

      {videoUrl ? (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <video ref={videoRef} src={videoUrl} loop playsInline crossOrigin="anonymous" style={{ position: "absolute", top: "50%", left: "50%", transform: `translate(calc(-50% + ${bgT.x}px), calc(-50% + ${bgT.y}px))`, height: Math.round(cardH * bgT.scale), width: "auto", maxWidth: "none", pointerEvents: "none" }} />
          {interactive && <div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(1, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(1, e) : undefined} style={{ position: "absolute", inset: 0, zIndex: 20, cursor: bgDragActive === 1 ? "grabbing" : "grab", touchAction: "none" }} />}
        </div>
      ) : (
        <>
          {interactive && (<><div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(1, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(1, e) : undefined} style={{ position: "absolute", zIndex: 20, left: 0, top: 0, width: bgMode === "collage" ? "50%" : "100%", height: "100%", cursor: bgDragActive === 1 ? "grabbing" : "grab", touchAction: "none" }} />
            {bgMode === "collage" && <div onTouchStart={onBgTouch ? (e) => { e.stopPropagation(); onBgTouch(2, e); } : undefined} onMouseDown={onBgMouseDown ? (e) => onBgMouseDown(2, e) : undefined} style={{ position: "absolute", zIndex: 20, right: 0, top: 0, width: "50%", height: "100%", cursor: bgDragActive === 2 ? "grabbing" : "grab", touchAction: "none" }} />}</>)}
          <Background mode={bgMode} src1={bgSrc} t1={bgT} src2={bg2Src} t2={bg2T} splitAngle={splitAngle} cardW={cardW} cardH={cardH} />
        </>
      )}

      <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
        <Overlay cardW={cardW} cardH={cardH} stickers={stickers} extraTexts={extraTexts} selectedStickerId={selectedStickerId} selectedTextId={selectedTextId} onStickerTouch={onStickerTouch} onStickerMouseDown={onStickerMouseDown} onTextTouch={onTextTouch} onTextMouseDown={onTextMouseDown} bgDragActive={bgDragActive} snapIndicator={snapIndicator} />
        {/* Gradient Positioning */}
        <div style={{ position: "absolute", left: 0, top: is34 ? 1600 : cardH * 0.55, width: "100%", height: is34 ? cardH - 1600 : cardH * 0.45, zIndex: 3, background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,${is34 ? 0.75 : 0.82}) 100%)` }} />

        <div style={{ position: "absolute", left: "50%", bottom: is34 ? 469 : 949, transform: "translateX(-50%)", width: 1563, zIndex: 40, display: "flex", flexDirection: "column", gap: 85, pointerEvents: interactive ? "auto" : "none" }}>
          <NotifBadge label={label} />
          <div style={{ position: "relative", width: "100%", borderRadius: 30, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundColor: "#ff742f" }} /><img alt="" src={imgContent} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", mixBlendMode: "multiply", opacity: 0.25 }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "61px 112px 69px" }}>
              <div ref={inlineTitleRef} className="vc-title"
                contentEditable={interactive} suppressContentEditableWarning
                onInput={interactive ? (e: any) => onTitleChange?.(e.target.innerHTML) : undefined}
                style={{ fontFamily: FONT_REGULAR, fontSize: is34 ? 90 : 85, lineHeight: is34 ? "112px" : "108px", color: "white", width: 1339, overflow: "hidden", textAlign: "left", outline: "none" }} />
            </div>
          </div>
        </div>

        {/* Identity Bar Positioning */}
        <div style={{ position: "absolute", left: is34 ? 89 : 146, top: is34 ? 1812.55 : 2310.55, width: 1562.25, height: 133.45, borderRadius: 18, overflow: "hidden", zIndex: 50 }}><img alt="" src={imgIdentityBar} style={{ position: "absolute", left: 0, width: "100%", maxWidth: "none", top: "-1076.47%", height: "1176.47%" }} /></div>

        {/* Source Bars Positioning */}
        <div style={{ position: "absolute", left: is34 ? 89 : 136, top: is34 ? 2034 : 2544, zIndex: 50, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 10, backdropFilter: "blur(18.9px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
            <div style={{ width: 30, height: 30, flexShrink: 0 }}><svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M19 0H5C3.67441 0.00158786 2.40356 0.528882 1.46622 1.46622C0.528882 2.40356 0.00158786 3.67441 0 5L0 19C0.00158786 20.3256 0.528882 21.5964 1.46622 22.5338C2.40356 23.4711 3.67441 23.9984 5 24H19C20.3256 23.9984 21.5964 23.4711 22.5338 22.5338C23.4711 21.5964 23.9984 20.3256 24 19V5C23.9984 3.67441 23.4711 2.40356 22.5338 1.46622C21.5964 0.528882 20.3256 0.00158786 19 0V0ZM20 11H22V13H20V11ZM20 9V7H22V9H20ZM18 11H6V2H18V11ZM4 13H2V11H4V13ZM4 9H2V7H4V9ZM2 15H4V17H2V15ZM6 13H18V22H6V13ZM20 15H22V17H20V15ZM22 5H20V2.184C20.5829 2.39008 21.0879 2.77123 21.4459 3.2753C21.8039 3.77937 21.9974 4.38174 22 5ZM4 2.184V5H2C2.00256 4.38174 2.19608 3.77937 2.55409 3.2753C2.91209 2.77123 3.41709 2.39008 4 2.184ZM2 19H4V21.816C3.41709 21.6099 2.91209 21.2288 2.55409 20.7247C2.19608 20.2206 2.00256 19.6183 2 19ZM20 21.816V19H22C21.9974 19.6183 21.8039 20.2206 21.4459 20.7247C21.0879 21.2288 20.5829 21.6099 20 21.816Z" fill="white" /></svg></div>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: is34 ? 20 : 22, letterSpacing: "-0.18px", lineHeight: "22px", textDecoration: is34 ? "none" : "underline", color: "white", whiteSpace: "nowrap" }}>{source}</span>
          </div>
          {articleSource && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderRadius: 10, backdropFilter: "blur(18.9px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <div style={{ width: 30, height: 30, flexShrink: 0 }}><svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M19 0H5C3.67441 0.00158786 2.40356 0.528882 1.46622 1.46622C0.528882 2.40356 0.00158786 3.67441 0 5L0 19C0.00158786 20.3256 0.528882 21.5964 1.46622 22.5338C2.40356 23.4711 3.67441 23.9984 5 24H19C20.3256 23.9984 21.5964 23.4711 22.5338 22.5338C23.4711 21.5964 23.9984 20.3256 24 19V5C23.9984 3.67441 23.4711 2.40356 22.5338 1.46622C21.5964 0.528882 20.3256 0.00158786 19 0V0ZM20 11H22V13H20V11ZM20 9V7H22V9H20ZM18 11H6V2H18V11ZM4 13H2V11H4V13ZM4 9H2V7H4V9ZM2 15H4V17H2V15ZM6 13H18V22H6V13ZM20 15H22V17H20V15ZM22 5H20V2.184C20.5829 2.39008 21.0879 2.77123 21.4459 3.2753C21.8039 3.77937 21.9974 4.38174 22 5ZM4 2.184V5H2C2.00256 4.38174 2.19608 3.77937 2.55409 3.2753C2.91209 2.77123 3.41709 2.39008 4 2.184ZM2 19H4V21.816C3.41709 21.6099 2.91209 21.2288 2.55409 20.7247C2.19608 20.2206 2.00256 19.6183 2 19ZM20 21.816V19H22C21.9974 19.6183 21.8039 20.2206 21.4459 20.7247C21.0879 21.2288 20.5829 21.6099 20 21.816Z" fill="white" /></svg></div>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: is34 ? 20 : 22, letterSpacing: "-0.18px", lineHeight: "22px", textDecoration: is34 ? "none" : "underline", color: "white", whiteSpace: "nowrap" }}>{articleSource}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}