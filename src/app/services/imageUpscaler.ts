/**
 * imageUpscaler.ts
 * Upscale gambar BG 4x menggunakan UpscalerJS dengan model ESRGAN-Legacy Div2k 4x
 */

import Upscaler from 'upscaler';
import { Div2k4X } from '@upscalerjs/esrgan-legacy';

let upscalerInstance: InstanceType<typeof Upscaler> | null = null;

function getUpscaler() {
  if (!upscalerInstance) {
    upscalerInstance = new Upscaler({
      model: Div2k4X,
    });
  }
  return upscalerInstance;
}

/** Convert base64/URL → HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk upscale'));
    img.src = src;
  });
}

/** Resize gambar ke max dimensi tertentu, kembalikan canvas */
function resizeToMax(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const scale  = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(img.naturalWidth  * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface UpscaleOptions {
  onProgress?: (pct: number) => void;
  onStatus?:   (msg: string)  => void;
}

/**
 * Upscale gambar 4x dari src (base64/URL) menggunakan ESRGAN-Legacy Div2k 4x.
 * Mengembalikan base64 PNG hasil upscale.
 */
export async function upscaleImage(src: string, opts: UpscaleOptions = {}): Promise<string> {
  const { onProgress, onStatus } = opts;

  onStatus?.('Memuat model ESRGAN 4x...');
  onProgress?.(0);

  const upscaler = getUpscaler();

  await upscaler.ready;
  onStatus?.('Model siap. Memuat gambar...');
  onProgress?.(5);

  const img = await loadImage(src);

  // Batasi input max 500px agar hasil 4x tidak OOM di HP (500 × 4 = 2000px)
  const MAX_DIM = 500;
  let inputSrc: string;
  if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
    const resized = resizeToMax(img, MAX_DIM);
    inputSrc = resized.toDataURL('image/png');
    onStatus?.(`Resize ke ${resized.width}×${resized.height}, upscale 4x → ${resized.width * 4}×${resized.height * 4}px...`);
  } else {
    inputSrc = src;
    onStatus?.(`Upscale ${img.naturalWidth}×${img.naturalHeight} → ${img.naturalWidth * 4}×${img.naturalHeight * 4}px (4x)...`);
  }
  onProgress?.(10);

  const result = await upscaler.upscale(inputSrc, {
    output: 'base64',
    patchSize: 48,   // tile lebih kecil agar aman di HP
    padding: 4,
    progress: (pct: number) => {
      const mapped = 10 + Math.round(pct * 90);
      onProgress?.(mapped);
      onStatus?.(`Upscaling 4x... ${mapped}%`);
    },
  });

  onStatus?.('Selesai!');
  onProgress?.(100);

  return result as string;
}

/** Pre-load model di background tanpa blocking UI */
export function preloadUpscaleModel(): void {
  try {
    getUpscaler();
  } catch {
    // silent
  }
}
