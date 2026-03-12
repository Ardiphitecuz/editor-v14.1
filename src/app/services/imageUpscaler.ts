/**
 * imageUpscaler.ts
 * Upscale gambar BG menggunakan ESRGAN Legacy (psnr-small, 2x) via TensorFlow.js
 * Model di-load dari /upscale-models/psnr-small/model.json (public folder)
 */

import * as tf from '@tensorflow/tfjs';

let modelCache: tf.LayersModel | null = null;
let modelLoading = false;
let modelLoadPromise: Promise<tf.LayersModel> | null = null;

const MODEL_URL = '/upscale-models/psnr-small/model.json';
const TILE_SIZE = 128; // Proses per tile agar tidak OOM
const TILE_PAD  = 10;

async function loadModel(): Promise<tf.LayersModel> {
  if (modelCache) return modelCache;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoading = true;
  modelLoadPromise = tf.loadLayersModel(MODEL_URL).then((model) => {
    modelCache = model;
    modelLoading = false;
    return model;
  }).catch((err) => {
    modelLoading = false;
    modelLoadPromise = null;
    throw err;
  });

  return modelLoadPromise;
}

/** Convert base64/blob URL ke HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk upscale'));
    img.src = src;
  });
}

/** Jalankan model ESRGAN pada tensor gambar kecil */
async function runModel(model: tf.LayersModel, inputTensor: tf.Tensor4D): Promise<tf.Tensor3D> {
  const output = model.predict(inputTensor) as tf.Tensor4D;
  const squeezed = output.squeeze([0]) as tf.Tensor3D;
  inputTensor.dispose();
  output.dispose();
  return squeezed;
}

/** Upscale dengan tile-based approach agar tidak OOM di HP */
async function upscaleTiled(
  model: tf.LayersModel,
  img: HTMLImageElement,
  onProgress?: (pct: number) => void
): Promise<HTMLCanvasElement> {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const outW  = srcW * 2;
  const outH  = srcH * 2;

  // Canvas sumber
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW; srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0);

  // Canvas output
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW; outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;

  const tilesX = Math.ceil(srcW / TILE_SIZE);
  const tilesY = Math.ceil(srcH / TILE_SIZE);
  const total  = tilesX * tilesY;
  let done = 0;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      // Koordinat tile dengan padding
      const x0 = Math.max(0, tx * TILE_SIZE - TILE_PAD);
      const y0 = Math.max(0, ty * TILE_SIZE - TILE_PAD);
      const x1 = Math.min(srcW, (tx + 1) * TILE_SIZE + TILE_PAD);
      const y1 = Math.min(srcH, (ty + 1) * TILE_SIZE + TILE_PAD);
      const tW  = x1 - x0;
      const tH  = y1 - y0;

      // Ambil pixel tile
      const tileData = srcCtx.getImageData(x0, y0, tW, tH);

      // Buat tensor [1, H, W, 3] dengan nilai 0-255
      const inputTensor = tf.tidy(() => {
        const t = tf.browser.fromPixels({ data: new Uint8ClampedArray(tileData.data), width: tW, height: tH }, 3);
        return t.expandDims(0) as tf.Tensor4D;
      });

      // Jalankan model
      const outTile = await runModel(model, inputTensor as tf.Tensor4D);

      // Clamp 0-255 lalu gambar ke canvas output
      const clampedTile = tf.tidy(() => outTile.clipByValue(0, 255).cast('int32'));
      const [oh, ow] = clampedTile.shape;
      const pixelData = await tf.browser.toPixels(clampedTile as tf.Tensor2D | tf.Tensor3D);
      clampedTile.dispose();
      outTile.dispose();

      // Hitung area valid (buang padding yang di-upscale)
      const padL = (tx * TILE_SIZE - x0) * 2;
      const padT = (ty * TILE_SIZE - y0) * 2;
      const validW = Math.min(TILE_SIZE, srcW - tx * TILE_SIZE) * 2;
      const validH = Math.min(TILE_SIZE, srcH - ty * TILE_SIZE) * 2;

      // Gambar tile ke ImageData
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = ow; tileCanvas.height = oh;
      const tileCtx = tileCanvas.getContext('2d')!;
      const tileImgData = tileCtx.createImageData(ow, oh);
      tileImgData.data.set(pixelData);
      tileCtx.putImageData(tileImgData, 0, 0);

      // Paste bagian valid ke output canvas
      const destX = tx * TILE_SIZE * 2;
      const destY = ty * TILE_SIZE * 2;
      outCtx.drawImage(tileCanvas, padL, padT, validW, validH, destX, destY, validW, validH);

      done++;
      onProgress?.(Math.round((done / total) * 100));

      // Beri jeda agar UI tidak freeze
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return outCanvas;
}

export interface UpscaleOptions {
  onProgress?: (pct: number) => void;
  onStatus?: (msg: string) => void;
}

/**
 * Main function: upscale gambar dari URL/base64 → kembalikan base64 PNG hasil upscale
 */
export async function upscaleImage(src: string, opts: UpscaleOptions = {}): Promise<string> {
  const { onProgress, onStatus } = opts;

  onStatus?.('Memuat model AI...');
  onProgress?.(0);

  const model = await loadModel();

  onStatus?.('Memproses gambar...');
  const img = await loadImage(src);

  // Batasi resolusi input agar tidak OOM (max 1000px sisi terpanjang)
  let processImg: HTMLImageElement | HTMLCanvasElement = img;
  const MAX_DIM = 1000;
  if (img.naturalWidth > MAX_DIM || img.naturalHeight > MAX_DIM) {
    const scale = MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight);
    const resized = document.createElement('canvas');
    resized.width  = Math.round(img.naturalWidth * scale);
    resized.height = Math.round(img.naturalHeight * scale);
    resized.getContext('2d')!.drawImage(img, 0, 0, resized.width, resized.height);
    processImg = resized;
    onStatus?.(`Resize ke ${resized.width}×${resized.height} lalu upscale 2x...`);
  } else {
    onStatus?.(`Upscale ${img.naturalWidth}×${img.naturalHeight} → 2x...`);
  }

  // Buat HTMLImageElement dari canvas jika di-resize
  let finalSrc: HTMLImageElement;
  if (processImg instanceof HTMLCanvasElement) {
    finalSrc = await loadImage(processImg.toDataURL());
  } else {
    finalSrc = processImg;
  }

  const resultCanvas = await upscaleTiled(model, finalSrc, (pct) => {
    onProgress?.(pct);
    onStatus?.(`Upscaling... ${pct}%`);
  });

  onStatus?.('Selesai!');
  onProgress?.(100);

  return resultCanvas.toDataURL('image/png');
}

/** Pre-load model di background tanpa blocking UI */
export function preloadUpscaleModel(): void {
  loadModel().catch(() => {/* silent — akan retry saat dipakai */});
}
