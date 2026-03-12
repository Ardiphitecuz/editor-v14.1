/**
 * canvasExport.ts
 * Render card ke canvas secara manual — tanpa html-to-image.
 * Asset URL di-pass dari EditorPage karena Vite hash filename saat build.
 */

export interface BgTransform { x: number; y: number; scale: number; }
export interface Sticker {
  id: string; src: string;
  x: number; y: number; size: number; rotation: number;
  shape: "original" | "circle" | "square";
  outlineColor: string; outlineWidth: number; shadowBlur: number;
}
export interface ExtraText {
  id: string; text: string;
  x: number; y: number; fontSize: number; fontWeight: string;
  color: string; rotation: number; shadowBlur: number;
}
export interface CardExportParams {
  template: "post" | "video";
  label: string;
  titleHtml: string;
  source: string;
  bgMode: "single" | "collage";
  bgSrc: string; bgT: BgTransform;
  bg2Src: string; bg2T: BgTransform;
  splitAngle: number;
  stickers: Sticker[];
  extraTexts: ExtraText[];
  // Asset URLs (di-pass dari EditorPage karena Vite hash)
  assetRect7: string;
  assetContent: string;
  assetIdentityBar: string;
}

const POST_W = 1740, POST_H = 2320;
const VIDEO_W = 1855, VIDEO_H = 3298;

const SVG_NOTIF_TAIL = "M0 0H19.0443C27.7434 0 33.988 8.37811 31.5024 16.7145L20.7686 52.7145C19.1259 58.2239 14.0596 62 8.31054 62H0V0Z";
const SVG_DISCUSS_ICON = "M23.5032 1.62318C22.7023 1.54188 21.8863 1.5 21.0584 1.5C10.2566 1.5 1.5 8.62833 1.5 17.4216C1.5 26.2148 10.2566 33.3431 21.0584 33.3431C22.7468 33.3431 24.3852 33.169 25.948 32.8415L33.2824 40.1667V29.9314C36.5749 27.7049 39.221 24.3592 40.1667 20.8333M40.1667 9.95833C40.1667 13.2951 37.4617 16 34.125 16C30.7883 16 28.0833 13.2951 28.0833 9.95833C28.0833 6.62161 30.7883 3.91667 34.125 3.91667C37.4617 3.91667 40.1667 6.62161 40.1667 9.95833Z";
const SVG_SOURCE_ICON = "M1.69914 20.6835C1.30862 21.074 1.30862 21.7072 1.69914 22.0977C2.08967 22.4883 2.72283 22.4883 3.11336 22.0977L2.40625 21.3906L1.69914 20.6835ZM8.03125 15.7656L8.73836 15.0585C8.34783 14.668 7.71467 14.668 7.32414 15.0585L8.03125 15.7656ZM10.8438 18.5781L10.1366 19.2852C10.5272 19.6758 11.1603 19.6758 11.5509 19.2852L10.8438 18.5781ZM17.1719 12.25L17.879 11.5429C17.4885 11.1524 16.8553 11.1524 16.4648 11.5429L17.1719 12.25ZM22.0898 18.5821C22.4803 18.9726 23.1135 18.9726 23.504 18.5821C23.8945 18.1916 23.8945 17.5584 23.504 17.1679L22.7969 17.875L22.0898 18.5821ZM2.40625 21.3906L3.11336 22.0977L8.73836 16.4727L8.03125 15.7656L7.32414 15.0585L1.69914 20.6835L2.40625 21.3906ZM8.03125 15.7656L7.32414 16.4727L10.1366 19.2852L10.8438 18.5781L11.5509 17.871L8.73836 15.0585L8.03125 15.7656ZM10.8438 18.5781L11.5509 19.2852L17.879 12.9571L17.1719 12.25L16.4648 11.5429L10.1366 17.871L10.8438 18.5781ZM17.1719 12.25L16.4648 12.9571L22.0898 18.5821L22.7969 17.875L23.504 17.1679L17.879 11.5429L17.1719 12.25ZM5.21875 1V2H19.2812V1V0H5.21875V1ZM23.5 5.21875H22.5V19.2812H23.5H24.5V5.21875H23.5ZM19.2812 23.5V22.5H5.21875V23.5V24.5H19.2812V23.5ZM1 19.2812H2V5.21875H1H0V19.2812H1ZM5.21875 23.5V22.5C3.44108 22.5 2 21.0589 2 19.2812H1H0C0 22.1635 2.33651 24.5 5.21875 24.5V23.5ZM23.5 19.2812H22.5C22.5 21.0589 21.0589 22.5 19.2812 22.5V23.5V24.5C22.1635 24.5 24.5 22.1635 24.5 19.2812H23.5ZM19.2812 1V2C21.0589 2 22.5 3.44108 22.5 5.21875H23.5H24.5C24.5 2.33651 22.1635 0 19.2812 0V1ZM5.21875 1V0C2.33651 0 0 2.33651 0 5.21875H1H2C2 3.44108 3.44108 2 5.21875 2V1ZM9.4375 7.32812H8.4375C8.4375 7.94082 7.94082 8.4375 7.32812 8.4375V9.4375V10.4375C9.04539 10.4375 10.4375 9.04539 10.4375 7.32812H9.4375ZM7.32812 9.4375V8.4375C6.71543 8.4375 6.21875 7.94082 6.21875 7.32812H5.21875H4.21875C4.21875 9.04539 5.61086 10.4375 7.32812 10.4375V9.4375ZM5.21875 7.32812H6.21875C6.21875 6.71543 6.71543 6.21875 7.32812 6.21875V5.21875V4.21875C5.61086 4.21875 4.21875 5.61086 4.21875 7.32812H5.21875ZM7.32812 5.21875V6.21875C7.94082 6.21875 8.4375 6.71543 8.4375 7.32812H9.4375H10.4375C10.4375 5.61086 9.04539 4.21875 7.32812 4.21875V5.21875Z";

const imgCache = new Map<string, HTMLImageElement>();

async function loadImg(src: string): Promise<HTMLImageElement> {
  if (!src) return new Image();
  if (imgCache.has(src)) return imgCache.get(src)!;
  return new Promise((resolve) => {
    const tryLoad = (useCors: boolean) => {
      const img = new Image();
      if (useCors) img.crossOrigin = "anonymous";
      img.onload = () => { imgCache.set(src, img); resolve(img); };
      img.onerror = () => {
        if (useCors) tryLoad(false); // retry tanpa crossOrigin
        else resolve(new Image()); // gagal total, return blank
      };
      img.src = src;
    };
    tryLoad(true);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBgImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, t: BgTransform, clipX: number, clipY: number, clipW: number, clipH: number) {
  if (!img.naturalWidth) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(clipX, clipY, clipW, clipH); ctx.clip();
  const ih = clipH * t.scale;
  const iw = (img.naturalWidth / img.naturalHeight) * ih;
  ctx.drawImage(img, clipX + clipW / 2 - iw / 2 + t.x, clipY + clipH / 2 - ih / 2 + t.y, iw, ih);
  ctx.restore();
}

function drawCollageBg(ctx: CanvasRenderingContext2D, img1: HTMLImageElement, t1: BgTransform, img2: HTMLImageElement, t2: BgTransform, angle: number, cardW: number, cardH: number) {
  const cx = cardW / 2;
  const dy = Math.tan((angle * Math.PI) / 180) * (cardH / 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(cx - dy, 0); ctx.lineTo(cx + dy, cardH); ctx.lineTo(0, cardH);
  ctx.closePath(); ctx.clip();
  drawBgImage(ctx, img1, t1, 0, 0, cardW, cardH);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - dy, 0); ctx.lineTo(cardW, 0); ctx.lineTo(cardW, cardH); ctx.lineTo(cx + dy, cardH);
  ctx.closePath(); ctx.clip();
  drawBgImage(ctx, img2, t2, 0, 0, cardW, cardH);
  ctx.restore();
}

function drawGradient(ctx: CanvasRenderingContext2D, y: number, cardW: number, cardH: number, alpha = 0.75) {
  const g = ctx.createLinearGradient(0, y, 0, cardH);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, cardW, cardH - y);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .trim();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    const words = para.split(" ");
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

async function drawIdentityBar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  if (!img.naturalWidth) return;
  ctx.save();
  roundRect(ctx, x, y, w, h, 18); ctx.clip();
  const imgH = h * 11.7647;
  const imgY = y - h * 10.7647;
  ctx.drawImage(img, x, imgY, w, imgH);
  ctx.restore();
}

async function drawNotifBadge(ctx: CanvasRenderingContext2D, label: string, imgRect7: HTMLImageElement, originX: number, originY: number) {
  // Orange square
  ctx.save();
  roundRect(ctx, originX, originY, 82, 82, 10);
  ctx.fillStyle = "#ff742f"; ctx.fill();
  if (imgRect7.naturalWidth) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.45;
    ctx.save(); roundRect(ctx, originX, originY, 82, 82, 10); ctx.clip();
    ctx.drawImage(imgRect7, originX, originY, 82, 82);
    ctx.restore();
  }
  ctx.restore();

  // Discuss icon (white stroke)
  ctx.save();
  ctx.translate(originX + 12 + 9.7, originY + 12 + 9.7);
  ctx.strokeStyle = "white"; ctx.lineWidth = 3 * (41.667 / 38.6);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const si = 38.6 / 41.667;
  const p2 = new Path2D(SVG_DISCUSS_ICON);
  ctx.scale(si, si); ctx.stroke(p2);
  ctx.restore();

  // White label pill
  ctx.font = "italic bold 33px 'Gilroy-BoldItalic', 'Nunito', sans-serif";
  const tw = ctx.measureText(label).width;
  const pillW = tw + 24;
  const pillX = originX + 82, pillY = originY + 10;

  ctx.fillStyle = "white";
  ctx.fillRect(pillX, pillY, pillW, 62);
  // Tail
  ctx.save();
  ctx.translate(pillX + pillW - 1, pillY);
  const tailW = 36.486, tailH = 62;
  ctx.fillStyle = "white";
  const tp = new Path2D(SVG_NOTIF_TAIL);
  ctx.scale(tailW / 32.0528, tailH / 62); ctx.fill(tp);
  ctx.restore();

  ctx.fillStyle = "#060200";
  ctx.font = "italic bold 33px 'Gilroy-BoldItalic', 'Nunito', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pillX + 24, pillY + 31);
}

function drawTitleBox(ctx: CanvasRenderingContext2D, titleHtml: string, imgContent: HTMLImageElement, x: number, y: number, w: number, fontSize: number, lineH: number, padH: number): number {
  const text = stripHtml(titleHtml);
  ctx.font = `bold ${fontSize}px 'Gilroy-Bold', 'Nunito', sans-serif`;
  const lines = wrapText(ctx, text, w - 224);
  const boxH = lines.length * lineH + padH * 2;

  ctx.save();
  roundRect(ctx, x, y, w, boxH, 30); ctx.clip();
  ctx.fillStyle = "#ff742f"; ctx.fillRect(x, y, w, boxH);
  if (imgContent.naturalWidth) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.25;
    ctx.drawImage(imgContent, x, y, w, boxH);
  }
  ctx.restore();

  ctx.save();
  ctx.font = `bold ${fontSize}px 'Gilroy-Bold', 'Nunito', sans-serif`;
  ctx.fillStyle = "white"; ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + 112, y + padH + i * lineH);
  }
  ctx.restore();
  return boxH;
}

function drawSourceBar(ctx: CanvasRenderingContext2D, source: string, x: number, y: number, isVideo = false) {
  const pad = 16, gap = 12, iconSz = isVideo ? 28 : 28, fontSize = isVideo ? 22 : 20;
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  const tw = ctx.measureText(source).width;
  const barW = pad * 2 + iconSz + gap + tw + 8;
  const barH = 52;
  ctx.save();
  roundRect(ctx, x, y, barW, barH, 10);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  if (isVideo) {
    // Play triangle
    ctx.save(); ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(x + pad, y + 12); ctx.lineTo(x + pad + iconSz, y + 26); ctx.lineTo(x + pad, y + 40);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
    // Source icon (share/link)
    ctx.save();
    ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.translate(x + pad, y + barH / 2 - iconSz / 2);
    const s = iconSz / 24.5;
    const ip = new Path2D(SVG_SOURCE_ICON);
    ctx.scale(s, s); ctx.stroke(ip);
    ctx.restore();
  }

  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = "white"; ctx.textBaseline = "middle";
  if (isVideo) {
    ctx.save();
    ctx.textDecorationLine = "underline" as any;
    ctx.fillText(source, x + pad + iconSz + gap, y + barH / 2);
    ctx.restore();
  } else {
    ctx.fillText(source, x + pad + iconSz + gap, y + barH / 2);
  }
}

async function drawSticker(ctx: CanvasRenderingContext2D, s: Sticker, cardW: number, cardH: number) {
  const img = await loadImg(s.src);
  if (!img.naturalWidth) return;
  const sx = (s.x / 100) * cardW, sy = (s.y / 100) * cardH, half = s.size / 2;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((s.rotation * Math.PI) / 180);
  if (s.shadowBlur > 0) { ctx.shadowBlur = s.shadowBlur; ctx.shadowColor = "rgba(0,0,0,0.85)"; }
  if (s.outlineWidth > 0) {
    ctx.strokeStyle = s.outlineColor; ctx.lineWidth = s.outlineWidth;
    if (s.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, half + s.outlineWidth / 2, 0, Math.PI * 2); ctx.stroke(); }
    else { roundRect(ctx, -half - s.outlineWidth / 2, -half - s.outlineWidth / 2, s.size + s.outlineWidth, s.size + s.outlineWidth, s.shape === "square" ? 16 : 0); ctx.stroke(); }
  }
  ctx.beginPath();
  if (s.shape === "circle") ctx.arc(0, 0, half, 0, Math.PI * 2);
  else if (s.shape === "square") roundRect(ctx, -half, -half, s.size, s.size, 16);
  else ctx.rect(-half, -half, s.size, s.size);
  ctx.clip();
  ctx.drawImage(img, -half, -half, s.size, s.size);
  ctx.restore();
}

function drawExtraText(ctx: CanvasRenderingContext2D, t: ExtraText, cardW: number, cardH: number) {
  ctx.save();
  ctx.translate((t.x / 100) * cardW, (t.y / 100) * cardH);
  ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.shadowBlur > 0) { ctx.shadowBlur = t.shadowBlur; ctx.shadowColor = "rgba(0,0,0,0.85)"; }
  ctx.font = `${t.fontWeight} ${t.fontSize}px 'Gilroy-Bold', Nunito, sans-serif`;
  ctx.fillStyle = t.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(t.text, 0, 0);
  ctx.restore();
}

export async function exportCardToCanvas(params: CardExportParams): Promise<string> {
  const { template, label, titleHtml, source, bgMode, bgSrc, bgT, bg2Src, bg2T, splitAngle, stickers, extraTexts, assetRect7, assetContent, assetIdentityBar } = params;
  const isPost = template === "post";
  const cardW = isPost ? POST_W : VIDEO_W;
  const cardH = isPost ? POST_H : VIDEO_H;

  const [imgBg1, imgBg2, imgContent, imgIdentityBar, imgRect7] = await Promise.all([
    loadImg(bgSrc),
    bgMode === "collage" ? loadImg(bg2Src) : Promise.resolve(new Image()),
    loadImg(assetContent),
    loadImg(assetIdentityBar),
    loadImg(assetRect7),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = cardW; canvas.height = cardH;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  // 0: Black bg
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cardW, cardH);

  // 1: BG
  if (bgMode === "collage" && imgBg2.naturalWidth) drawCollageBg(ctx, imgBg1, bgT, imgBg2, bg2T, splitAngle, cardW, cardH);
  else drawBgImage(ctx, imgBg1, bgT, 0, 0, cardW, cardH);

  // 2: Stickers
  for (const s of stickers) { try { await drawSticker(ctx, s, cardW, cardH); } catch { /* skip */ } }

  // 3: Gradient
  drawGradient(ctx, isPost ? 1600 : cardH * 0.55, cardW, cardH, isPost ? 0.75 : 0.82);

  // 4: Extra texts
  for (const t of extraTexts) drawExtraText(ctx, t, cardW, cardH);

  // 5: Card-specific layers
  if (isPost) {
    const badgeX = cardW / 2 - 1563 / 2;
    // estimate title box height to place badge correctly
    ctx.font = `bold 90px 'Gilroy-Bold', Nunito, sans-serif`;
    const titleLines = wrapText(ctx, stripHtml(titleHtml), 1563 - 224);
    const titleBoxH = titleLines.length * 112 + 61 * 2;
    const badgeY = cardH - 469 - titleBoxH - 85 - 92; // 92 ~= badge height

    await drawNotifBadge(ctx, label, imgRect7, badgeX, badgeY);
    const titleY = badgeY + 92 + 85;
    drawTitleBox(ctx, titleHtml, imgContent, badgeX, titleY, 1563, 90, 112, 61);
    await drawIdentityBar(ctx, imgIdentityBar, 89, 1812.55, 1562.246, 133.453);
    drawSourceBar(ctx, source, 89, 2034, false);
  } else {
    const badgeX = cardW / 2 - 1563 / 2;
    ctx.font = `bold 85px 'Gilroy-Bold', Nunito, sans-serif`;
    const titleLines = wrapText(ctx, stripHtml(titleHtml), 1563 - 224);
    const titleBoxH = titleLines.length * 108 + 61 * 2;
    const badgeY = cardH - 949 - titleBoxH - 85 - 92;

    await drawNotifBadge(ctx, label, imgRect7, badgeX, badgeY);
    const titleY = badgeY + 92 + 85;
    drawTitleBox(ctx, titleHtml, imgContent, badgeX, titleY, 1563, 85, 108, 61);
    await drawIdentityBar(ctx, imgIdentityBar, 146, 2310.55, 1562.25, 133.45);
    drawSourceBar(ctx, source, 136, 2544, true);
  }

  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl || dataUrl === "data:,") throw new Error("Canvas kosong — coba lagi");
  return dataUrl;
}
