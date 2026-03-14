import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { toPng } from "html-to-image";

export interface ExportOptions {
  cardWidth: number;
  cardHeight: number;
  outWidth: number;
  outHeight: number;
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
  // Check for WebCodecs support (vital for mobile/Safari compatibility)
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    throw new Error("Browser Anda belum mendukung fitur ekspor video (WebCodecs). Gunakan Chrome atau update browser Anda.");
  }

  const { 
    cardWidth,
    cardHeight,
    outWidth,
    outHeight,
    fps = 30, 
    bitrate = 8_000_000, 
    onProgress
  } = options;

  const width = outWidth & ~1;
  const height = outHeight & ~1;
  const duration = video.duration;

  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })!;

  // 1. Capture overlay as Image
  const overlayDataUrl = await toPng(overlay, { 
    width: cardWidth, 
    height: cardHeight, 
    pixelRatio: 1,
    style: { 
      transform: 'none', 
      transformOrigin: 'top left', 
      width: `${cardWidth}px`, 
      height: `${cardHeight}px`,
      position: 'fixed',
      top: '0',
      left: '0',
      visibility: 'visible',
      backfaceVisibility: 'hidden'
    },
    skipAutoScale: true,
  });
  const overlayImg = new Image();
  overlayImg.src = overlayDataUrl;
  await new Promise(r => overlayImg.onload = r);

  // 2. Audio Data Extraction FIRST (to get correct Sample Rate/Channels for Muxer)
  let audioBuffer: AudioBuffer | null = null;
  try {
    const response = await fetch(video.src);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();
  } catch (e) {
    console.warn("Could not extract audio buffer:", e);
  }

  // 3. Setup Muxer with ALIGNED parameters
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: audioBuffer ? { 
      codec: 'aac', 
      numberOfChannels: audioBuffer.numberOfChannels, 
      sampleRate: audioBuffer.sampleRate 
    } : undefined,
    fastStart: 'in-memory'
  });

  // 4. Setup Encoders
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (e) => console.error("VideoEncoder error", e)
  });
  
  videoEncoder.configure({ 
    codec: 'avc1.4d0032', 
    width, height, 
    bitrate, 
    bitrateMode: 'constant',
    framerate: fps, 
    avc: { format: 'annexb' } 
  });

  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    error: (e) => console.error("AudioEncoder error", e)
  });
  
  if (audioBuffer) {
    audioEncoder.configure({ 
      codec: 'mp4a.40.2', 
      numberOfChannels: audioBuffer.numberOfChannels, 
      sampleRate: audioBuffer.sampleRate, 
      bitrate: 128_000 
    });
  }

  // 5. Render Loop
  let frameCount = 0;
  const totalFrames = Math.ceil(duration * fps);
  const frameTime = 1 / fps;

  while (frameCount < totalFrames) {
    const timestampInSeconds = frameCount * frameTime;
    video.currentTime = timestampInSeconds;
    
    await new Promise(r => {
       const onSeeked = () => { 
         video.removeEventListener('seeked', onSeeked); 
         r(null); 
       };
       video.addEventListener('seeked', onSeeked);
    });

    ctx.drawImage(video, 0, 0, width, height);
    ctx.drawImage(overlayImg, 0, 0, width, height);
    
    const timestampUs = Math.round(timestampInSeconds * 1_000_000);
    const frame = new VideoFrame(canvas, { timestamp: timestampUs });
    
    try {
      videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
    } finally {
      frame.close();
    }

    if (audioBuffer && audioEncoder.state === 'configured') {
      const startSample = Math.floor(timestampInSeconds * audioBuffer.sampleRate);
      const endSample = Math.floor((frameCount + 1) * frameTime * audioBuffer.sampleRate);
      const numSamples = endSample - startSample;

      if (numSamples > 0 && startSample < audioBuffer.length) {
        const actualNumSamples = Math.min(numSamples, audioBuffer.length - startSample);
        const data = new Float32Array(actualNumSamples * audioBuffer.numberOfChannels);
        
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const channelData = audioBuffer.getChannelData(ch);
          for (let i = 0; i < actualNumSamples; i++) {
            data[i * audioBuffer.numberOfChannels + ch] = channelData[startSample + i];
          }
        }

        const audioData = new AudioData({
            format: 'f32',
            sampleRate: audioBuffer.sampleRate,
            numberOfFrames: actualNumSamples,
            numberOfChannels: audioBuffer.numberOfChannels,
            timestamp: timestampUs,
            data: data
        });

        audioEncoder.encode(audioData);
        audioData.close();
      }
    }

    frameCount++;
    onProgress?.(Math.round((frameCount / totalFrames) * 98));
  }

  await videoEncoder.flush();
  if (audioEncoder.state === 'configured') await audioEncoder.flush();
  muxer.finalize();

  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}