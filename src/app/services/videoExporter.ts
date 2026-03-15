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
  bgT?: { x: number; y: number; scale: number; };
}

export async function exportVideo(
  video: HTMLVideoElement,
  overlay: HTMLDivElement,
  options: ExportOptions
): Promise<Blob> {
  // Check for WebCodecs support. If not available, use MediaRecorder fallback.
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    return exportVideoMediaRecorder(video, overlay, options);
  }

  const { 
    cardWidth,
    cardHeight,
    outWidth,
    outHeight,
    fps = 60, 
    bitrate = 4_000_000, 
    onProgress,
    bgT = { x: 0, y: 0, scale: 1 }
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
    width: width, 
    height: height, 
    pixelRatio: 1,
    style: { 
      transform: `scale(${width / cardWidth})`, 
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

  // 2. Audio Data Extraction - FORCE Proxy if external
  let audioBuffer: AudioBuffer | null = null;
  try {
    const rawSrc = video.getAttribute('src') || video.src;
    // Extract actual source from proxy URL if currently proxied
    let actualUrl = rawSrc;
    if (rawSrc.includes('/api/video-proxy?url=')) {
      actualUrl = decodeURIComponent(rawSrc.split('/api/video-proxy?url=')[1]);
    }

    // Force proxy for fetch to avoid CORS errors during buffer extraction
    const audioUrl = (actualUrl.startsWith('http') && !actualUrl.includes(window.location.host))
      ? `/api/video-proxy?url=${encodeURIComponent(actualUrl)}`
      : actualUrl;

    console.log("[Export] Fetching audio from:", audioUrl);
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();
    console.log("[Export] Audio buffer extracted successfully:", audioBuffer.duration, "s");
  } catch (e: any) {
    console.warn("[Export] Could not extract audio buffer:", e.message);
  }

  // 3. Setup Muxer
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
    bitrateMode: 'variable',
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

  video.currentTime = 0;
  await new Promise(r => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
    video.addEventListener('seeked', onSeeked);
  });

  while (frameCount < totalFrames) {
    const timestampInSeconds = frameCount * frameTime;
    if (frameCount > 0) {
      video.currentTime = timestampInSeconds;
      await new Promise(r => {
         const onSeeked = () => { video.removeEventListener('seeked', onSeeked); r(null); };
         video.addEventListener('seeked', onSeeked);
      });
    }

    // DRAW VIDEO WITH CORRECT SCALING (Avoid Gepeng)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    
    const s = width / cardWidth;
    const ih = height * bgT.scale;
    const iw = (video.videoWidth / video.videoHeight) * ih;
    ctx.drawImage(video, (width / 2 - iw / 2) + (bgT.x * s), (height / 2 - ih / 2) + (bgT.y * s), iw, ih);
    
    ctx.drawImage(overlayImg, 0, 0, width, height);
    
    const timestampUs = Math.round(timestampInSeconds * 1_000_000);
    const frame = new VideoFrame(canvas, { timestamp: timestampUs });
    
    try {
      videoEncoder.encode(frame, { keyFrame: frameCount % (fps * 2) === 0 });
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
            format: 'f32', sampleRate: audioBuffer.sampleRate, numberOfFrames: actualNumSamples, numberOfChannels: audioBuffer.numberOfChannels, timestamp: timestampUs, data
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

async function exportVideoMediaRecorder(
  video: HTMLVideoElement,
  overlay: HTMLDivElement,
  options: ExportOptions
): Promise<Blob> {
  const { 
    cardWidth, cardHeight, outWidth, outHeight, fps = 60, onProgress, bgT = { x: 0, y: 0, scale: 1 }
  } = options;

  const width = outWidth & ~1, height = outHeight & ~1, duration = video.duration;
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  const overlayDataUrl = await toPng(overlay, { 
    width: width, height: height, pixelRatio: 1,
    style: { 
      transform: `scale(${width / cardWidth})`, transformOrigin: 'top left', width: `${cardWidth}px`, height: `${cardHeight}px`, position: 'fixed', top: '0', left: '0', visibility: 'visible',
    },
    skipAutoScale: true,
  });
  const overlayImg = new Image();
  overlayImg.src = overlayDataUrl;
  await new Promise(r => overlayImg.onload = r);

  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : (canvas as any).webkitCaptureStream ? (canvas as any).webkitCaptureStream(fps) : null;
  if (!stream) throw new Error("Browser tidak mendukung captureStream.");

  // USE AUDIOCONTEXT TO CAPTURE AUDIO (More robust for mobile)
  let audioContext: AudioContext | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass();
    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    source.connect(audioContext.destination);
    
    if (destination.stream.getAudioTracks().length > 0) {
      stream.addTrack(destination.stream.getAudioTracks()[0]);
      console.log("[Export] Audio track added to MediaRecorder via AudioContext");
    }
  } catch (e) {
    console.warn("[Export] AudioContext capture failed (likely CORS):", e);
    // Try fallback to captureStream if AudioContext fails
    try {
      const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).webkitCaptureStream ? (video as any).webkitCaptureStream() : null;
      if (videoStream && videoStream.getAudioTracks().length > 0) {
        stream.addTrack(videoStream.getAudioTracks()[0]);
      }
    } catch (e2) {
      console.warn("[Export] Fallback audio capture also failed");
    }
  }

  let mimeType = 'video/mp4';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
  
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm;codecs=vp9', videoBitsPerSecond: 4000000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const exportPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const originalMuted = video.muted;
  const originalCurrentTime = video.currentTime;
  video.muted = false; // MUST NOT BE MUTED for captureStream/AudioContext to work
  video.currentTime = 0;
  
  return new Promise((resolve, reject) => {
    const startExport = async () => {
      try {
        await video.play();
        recorder.start();
        const renderFrame = () => {
          if (video.ended || video.paused) {
            recorder.stop(); video.muted = originalMuted; video.currentTime = originalCurrentTime;
            if (audioContext) audioContext.close();
            onProgress?.(100); exportPromise.then(resolve); return;
          }
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, width, height);
          const s = width / cardWidth;
          const ih = height * bgT.scale;
          const iw = (video.videoWidth / video.videoHeight) * ih;
          ctx.drawImage(video, (width / 2 - iw / 2) + (bgT.x * s), (height / 2 - ih / 2) + (bgT.y * s), iw, ih);
          ctx.drawImage(overlayImg, 0, 0, width, height);
          onProgress?.(Math.round((video.currentTime / duration) * 99));
          requestAnimationFrame(renderFrame);
        };
        renderFrame();
      } catch (err) {
        recorder.stop(); video.muted = originalMuted; video.currentTime = originalCurrentTime;
        if (audioContext) audioContext.close();
        reject(err);
      }
    };
    startExport();
  });
}