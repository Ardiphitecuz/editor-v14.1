/**
 * imageUpscaler.ts
 * Upscale gambar BG menggunakan UpscalerJS dengan model ESRGAN-Legacy (PSNRSmall 2x)
 */

import Upscaler from 'upscaler';
import { PSNRSmall } from '@upscalerjs/esrgan-legacy';

let upscalerInstance: InstanceType<typeof Upscaler> | null = null;

function getUpscaler() {
  if (!upscalerInstance) {
    upscalerInstance = new Upscaler({
      model: PSNRSmall,
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
 * Upscale gambar dari src (base64/URL) menggunakan UpscalerJS ESRGAN-Legacy PSNRSmall (2x).
 * Mengembalikan base64 PNG hasil upscale.
 */
export async function upscaleImage(src: string, opts: UpscaleOptions = {}): Promise<string> {
  const { onProgress, onStatus } = opts;

  onStatus?.('Memuat model ESRGAN...');
  onProgress?.(0);

  const upscaler = getUpscaler();

  // Tunggu model siap
  await upscaler.ready;
  onStatus?.('Model siap. Memuat gambar...');
  onProgress?.(5);

  const img = await loadImage(src);

  // Batasi resolusi input max 800px agar tidak OOM di HP
  const MAX_DIM = 800;
  let inputSrc: string;
  if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
    const resized = resizeToMax(img, MAX_DIM);
    inputSrc = resized.toDataURL('image/png');
    onStatus?.(`Resize ke ${resized.width}×${resized.height}, lalu upscale 2x...`);
  } else {
    inputSrc = src;
    onStatus?.(`Upscale ${img.naturalWidth}×${img.naturalHeight} → 2x...`);
  }
  onProgress?.(10);

  // Jalankan upscale dengan progress callback
  const result = await upscaler.upscale(inputSrc, {
    output: 'base64',
    patchSize: 64,
    padding: 4,
    progress: (pct: number) => {
      // pct dari UpscalerJS: 0–1
      const mapped = 10 + Math.round(pct * 90);
      onProgress?.(mapped);
      onStatus?.(`Upscaling... ${mapped}%`);
    },
  });

  onStatus?.('Selesai!');
  onProgress?.(100);

  // UpscalerJS output 'base64' sudah berupa data URL
  return result as string;
}

/** Pre-load model di background tanpa blocking UI */
export function preloadUpscaleModel(): void {
  try {
    getUpscaler(); // instantiate → mulai load model
  } catch {
    // silent
  }
}
