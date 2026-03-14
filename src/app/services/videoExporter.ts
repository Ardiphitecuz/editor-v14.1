import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { toPng } from "html-to-image";

export interface ExportOptions {
  width: number;
  height: number;
  fps?: number;
  bitrate?: number;
  onProgress?: (progress: number) => void;
  exportMode?: "download" | "share";
}

export async function exportVideo(
  video: HTMLVideoElement,
  overlay: HTMLDivElement,
  options: ExportOptions
): Promise<Blob> {
  const { 
    width: rawWidth, 
    height: rawHeight, 
    fps = 30, 
    bitrate = 6_000_000, 
    onProgress
  } = options;

  // Enforce even dimensions for H.264
  const width = rawWidth & ~1;
  const height = rawHeight & ~1;
  const duration = video.duration;

  // Ensure fonts are loaded before capture
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;

  // Capture overlay as Image
  // We use a more robust strategy: force the dimensions and transform to none 
  // to avoid capture displacement if the parent is scaled (e.g. in a preview modal).
  const overlayDataUrl = await toPng(overlay, { 
    width, 
    height, 
    pixelRatio: 1,
    style: { 
      transform: 'none', 
      transformOrigin: 'top left', 
      width: `${width}px`, 
      height: `${height}px`,
      position: 'fixed', // Isolate from parent layout
      top: '0',
      left: '0',
      visibility: 'visible',
      backfaceVisibility: 'hidden'
    },
    // Ensure we capture even elements that are technically overflowed
    skipAutoScale: true,
  });
  const overlayImg = new Image();
  overlayImg.src = overlayDataUrl;
  await new Promise(r => overlayImg.onload = r);

  // WebCodecs Setup
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 44100 },
    fastStart: 'in-memory'
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (e) => console.error("VideoEncoder error", e)
  });
  videoEncoder.configure({ 
    codec: 'avc1.4D0033', // Main Profile, Level 5.1 (Supports high resolutions)
    width, height, 
    bitrate, 
    framerate: fps, 
    avc: { format: 'annexb' } 
  });

  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    error: (e) => console.error("AudioEncoder error", e)
  });
  audioEncoder.configure({ 
    codec: 'mp4a.40.2', 
    numberOfChannels: 2, 
    sampleRate: 44100, 
    bitrate: 128_000 
  });

  // Audio Track Processing
  let audioReader: ReadableStreamDefaultReader | null = null;
  try {
    // @ts-ignore
    const audioStream = video.captureStream?.() || (video as any).mozCaptureStream?.();
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      const audioTrack = audioStream.getAudioTracks()[0];
      // @ts-ignore
      const processor = new MediaStreamTrackProcessor({ track: audioTrack });
      audioReader = processor.readable.getReader();
    }
  } catch (e) {
    console.warn("Audio capture not supported or failed", e);
  }

  // Render Loop
  video.currentTime = 0;
  await new Promise(r => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
    video.addEventListener('seeked', onSeeked);
  });
  
  let frameCount = 0;
  const totalFrames = Math.ceil(duration * fps);
  const frameTime = 1 / fps;

  while (frameCount < totalFrames) {
    const timestamp = frameCount * frameTime;
    video.currentTime = timestamp;
    await new Promise(r => {
       const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
       video.addEventListener('seeked', onSeeked);
    });

    ctx.drawImage(video, 0, 0, width, height);
    ctx.drawImage(overlayImg, 0, 0, width, height);
    
    const frame = new VideoFrame(canvas, { timestamp: timestamp * 1_000_000 });
    try {
      videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
    } finally {
      frame.close();
    }

    if (audioReader) {
      while (true) {
        const { done, value } = await audioReader.read();
        if (done) break;
        if (value.timestamp / 1_000_000 > timestamp + frameTime) { 
          // Re-queue or discard? For simplicity, we discard if it's too far ahead
          // but usually audio buffers are small enough that we can just encode them.
          value.close(); 
          break; 
        }
        audioEncoder.encode(value);
        value.close();
      }
    }

    frameCount++;
    onProgress?.(Math.round((frameCount / totalFrames) * 95));
  }

  await videoEncoder.flush();
  await audioEncoder.flush();
  muxer.finalize();

  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
