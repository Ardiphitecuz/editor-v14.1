import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { toPng } from "html-to-image";

let ffmpeg: FFmpeg | null = null;

/**
 * Initialize and load FFmpeg WebAssembly.
 * Uses SharedArrayBuffer via COOP/COEP headers.
 */
export const initFFmpeg = async () => {
    if (ffmpeg) return ffmpeg;
    ffmpeg = new FFmpeg();
    
    // Using official unpkg CDN for core and wasm
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
};

/**
 * Capture an HTML element as a PNG blob.
 * This ensures high-fidelity overlays (stickers, texts, etc.)
 */
const captureOverlayPng = async (element: HTMLElement): Promise<Uint8Array> => {
    // Generate PNG from HTML element
    const dataUrl = await toPng(element, { pixelRatio: 1 });
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
    setProgress: (p: number) => void
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
        const overlayData = await captureOverlayPng(overlayElement);
        await ff.writeFile('overlay.png', overlayData);

        // 3. Execute FFmpeg Command
        // -i input.mp4: first input
        // -i overlay.png: second input (overlay)
        // -filter_complex: overlay filter (0:0 placing at top-left)
        // -c:a copy: reuse existing audio for speed
        // -preset ultrafast: prioritize speed over compression ratio
        setProgress(25);
        await ff.exec([
            '-i', 'input.mp4',
            '-i', 'overlay.png',
            '-filter_complex', '[0:v][1:v]overlay=0:0',
            '-c:a', 'copy',
            '-preset', 'ultrafast',
            'output.mp4'
        ]);

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
