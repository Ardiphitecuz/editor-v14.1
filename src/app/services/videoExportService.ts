import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { toPng } from "html-to-image";

export interface ExportProgress {
  phase: "screenshot" | "transcode" | "sharing";
  percent: number;
}

export interface VideoExportOptions {
  videoUrl: string;
  overlayRef: React.RefObject<HTMLDivElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onProgress: (progress: ExportProgress) => void;
  onSuccess: (blob: Blob, filename: string) => void;
  onError: (err: any) => void;
}

export async function exportVideoWithFFmpeg(options: VideoExportOptions) {
  const { videoUrl, overlayRef, videoRef, onProgress, onSuccess, onError } = options;
  const ffmpeg = new FFmpeg();

  try {
    // 1. Load FFmpeg
    onProgress({ phase: "screenshot", percent: 5 });
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    // 2. Capture Overlay as PNG
    onProgress({ phase: "screenshot", percent: 20 });
    if (!overlayRef.current) throw new Error("Overlay ref not found");
    const overlayDataUrl = await toPng(overlayRef.current, { pixelRatio: 1 });
    const overlayBlob = await (await fetch(overlayDataUrl)).blob();

    // 3. Prepare Files for FFmpeg
    onProgress({ phase: "transcode", percent: 30 });
    await ffmpeg.writeFile('input.mp4', await fetchFile(videoUrl));
    await ffmpeg.writeFile('overlay.png', await fetchFile(overlayBlob));

    // 4. Run FFmpeg command
    // This command overlays the PNG and ensures high quality
    onProgress({ phase: "transcode", percent: 40 });
    
    ffmpeg.on('log', ({ message }) => {
      console.log("[FFmpeg]", message);
      // Rough progress estimation from logs if needed
    });

    // Standard command to overlay image on video
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-i', 'overlay.png',
      '-filter_complex', '[0:v][1:v]overlay=0:0',
      '-codec:a', 'copy',
      '-preset', 'ultrafast',
      'output.mp4'
    ]);

    // 5. Read Result
    onProgress({ phase: "transcode", percent: 90 });
    const data = await ffmpeg.readFile('output.mp4');
    // Ensure data is treated as a safe BlobPart
    const outBlob = new Blob([new Uint8Array(data as any)], { type: 'video/mp4' });
    const filename = `otaku-video-${Date.now()}.mp4`;

    onProgress({ phase: "transcode", percent: 100 });
    onSuccess(outBlob, filename);

  } catch (err) {
    console.error("FFmpeg Export Error:", err);
    onError(err);
  }
}

/**
 * Fallback recording using Canvas + MediaRecorder
 */
export async function exportVideoWithMediaRecorder(options: VideoExportOptions) {
  const { videoRef, onProgress, onSuccess, onError } = options;
  
  try {
    if (!videoRef.current) throw new Error("Video ref not found");
    const video = videoRef.current;
    
    // Preparation
    onProgress({ phase: "screenshot", percent: 10 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed");
    
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      onSuccess(blob, `video-${Date.now()}.webm`);
    };

    // Start recording
    video.currentTime = 0;
    await video.play();
    recorder.start();
    
    const draw = () => {
      if (video.paused || video.ended) {
        recorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Here we would also need to draw the HTML overlays onto the canvas manually
      // which is complex. For now, this fallback might just record the video.
      requestAnimationFrame(draw);
      onProgress({ phase: "transcode", percent: Math.round((video.currentTime / video.duration) * 100) });
    };
    
    draw();
    
  } catch (err) {
    onError(err);
  }
}
