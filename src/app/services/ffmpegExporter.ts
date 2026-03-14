import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { toPng } from "html-to-image";
import { VIDEO_W, VIDEO_H, POST_W, POST_H } from "../components/CardTemplates";

let ffmpeg: FFmpeg | null = null;

/**
 * Initialize and load FFmpeg WebAssembly.
 * Uses SharedArrayBuffer via COOP/COEP headers.
 */
export const initFFmpeg = async () => {
    if (ffmpeg) return ffmpeg;
    ffmpeg = new FFmpeg();
    
    // Gunakan versi ESM untuk kompatibilitas Vite Production
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js`, 'text/javascript')
    });
    
    return ffmpeg;
};

/**
 * Capture an HTML element as a PNG blob.
 * This ensures high-fidelity overlays (stickers, texts, etc.)
 */
const captureOverlayPng = async (element: HTMLElement, ratio: "3:4" | "9:16" = "9:16"): Promise<Uint8Array> => {
    // Generate PNG from HTML element with high fidelity
    const is34 = ratio === "3:4";
    const width = is34 ? POST_W : VIDEO_W;
    const height = is34 ? POST_H : VIDEO_H;

    const dataUrl = await toPng(element, { 
        width, 
        height,
        pixelRatio: 1, // 1 is enough if width/height are nominal and fonts are sharp
        style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
            width: `${width}px`,
            height: `${height}px`,
            position: 'absolute',
            top: '0',
            left: '0'
        }
    });

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
};

/**
 * Process video with overlay using FFmpeg 100% Client-Side.
 */
export const exportVideoWithFFmpeg = async (
    videoUrl: string, 
    overlayElement: HTMLElement, 
    setProgress: (p: number) => void,
    ratio: "3:4" | "9:16" = "9:16"
) => {
    try {
        const ff = await initFFmpeg();
        
        // Progress tracking
        ff.on('log', ({ message }) => {
            console.log("[FFmpeg Log]", message);
        });

        // Rough progress approximation (standard ffmpeg progress event)
        // Note: progress * 100 for percentage
        ff.on('progress', ({ progress }) => {
            setProgress(Math.round(progress * 100));
        });

        // 1. Prepare files in FFmpeg virtual memory
        setProgress(5);
        const videoData = await fetchFile(videoUrl);
        await ff.writeFile('input.mp4', videoData);

        // 2. Capture and write the overlay PNG
        setProgress(15);
        if (!overlayElement) throw new Error("Overlay element not found");
        const overlayData = await captureOverlayPng(overlayElement, ratio);
        await ff.writeFile('overlay.png', overlayData);

    // 3. Execute FFmpeg Command
    // - [0:v]scale...: Scale video to cover template and crop to exact dimensions
    // - -crf 20: High quality (lower is better, 23 is default)
    // - -c:a copy: reuse existing audio for speed
    // - preset ultrafast: prioritize speed over compression ratio
    setProgress(25);

    try {
        const is34 = ratio === "3:4";
        const targetW = is34 ? POST_W : VIDEO_W;
        const targetH = is34 ? POST_H : VIDEO_H;

        await ff.exec([
            '-i', 'input.mp4',
            '-i', 'overlay.png',
            '-filter_complex', `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}[v]; [v][1:v]overlay=0:0`,
            '-map', '[v]',
            '-map', '0:a?', 
            '-c:v', 'libx264',
            '-crf', '20',
            '-preset', 'ultrafast',
            '-c:a', 'copy',
            'output.mp4'
        ]);
    } catch (execError: any) {
        console.error("[FFmpeg] Execution Error:", execError);
        // Fallback to simpler command if complex filter fails (e.g. no audio stream)
        const is34 = ratio === "3:4";
        const targetW = is34 ? POST_W : VIDEO_W;
        const targetH = is34 ? POST_H : VIDEO_H;

        await ff.exec([
            '-i', 'input.mp4',
            '-i', 'overlay.png',
            '-filter_complex', `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}[v]; [v][1:v]overlay=0:0`,
            '-c:v', 'libx264',
            '-crf', '22',
            '-preset', 'ultrafast',
            '-an',
            'output.mp4'
        ]);
    }

    // 4. Read result from memory and trigger download
    setProgress(95);
    const fileData = await ff.readFile('output.mp4');
    const data = new Uint8Array(fileData as any);
    const resultBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const resultUrl = URL.createObjectURL(resultBlob);
        
        const filename = `otaku_video_${Date.now()}.mp4`;
        const a = document.createElement('a');
        a.href = resultUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Use a small delay before revoking to ensure download starts
        setTimeout(() => URL.revokeObjectURL(resultUrl), 5000);
        setProgress(100);

        return { success: true, filename };

    } catch (error) {
        console.error("FFmpeg Export Error:", error);
        throw error;
    }
};
