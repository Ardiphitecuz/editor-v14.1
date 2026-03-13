import { useEffect, useState, useRef } from "react";

export const CAT_TOTAL_FRAMES = 19;
const FPS = 14;
const FRAME_MS = 1000 / FPS;

export function catFrameUrl(i: number) {
  return `/mascot/cat-frame-${String(i).padStart(2, "0")}.png`;
}

export function preloadCatFrames() {
  for (let i = 0; i < CAT_TOTAL_FRAMES; i++) {
    const img = new Image(); img.src = catFrameUrl(i);
  }
}

export function useCatFrame() {
  const [frame, setFrame] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    let idx = 0, last = 0;
    function tick(ts: number) {
      if (ts - last > FRAME_MS) { idx = (idx + 1) % CAT_TOTAL_FRAMES; setFrame(idx); last = ts; }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return frame;
}

interface LoadingCatProps {
  label?: string;
  trackWidth?: number;
  catHeight?: number;
}

export function LoadingCat({ label, trackWidth = 180, catHeight = 72 }: LoadingCatProps) {
  const frame = useCatFrame();
  const [x, setX] = useState(0);
  const [dir, setDir] = useState(1);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({ x: 0, dir: 1 });
  const catW = catHeight * (150 / 90);

  useEffect(() => {
    const maxX = trackWidth - catW;
    let last = 0;
    function move(ts: number) {
      if (ts - last > 16) {
        stateRef.current.x += stateRef.current.dir * 2.8;
        if (stateRef.current.x >= maxX) { stateRef.current.x = maxX; stateRef.current.dir = -1; }
        if (stateRef.current.x <= 0)    { stateRef.current.x = 0;    stateRef.current.dir =  1; }
        setX(stateRef.current.x);
        setDir(stateRef.current.dir);
        last = ts;
      }
      rafRef.current = requestAnimationFrame(move);
    }
    rafRef.current = requestAnimationFrame(move);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackWidth, catW]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative overflow-hidden" style={{ width: trackWidth, height: catHeight + 4 }}>
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
        <img
          src={catFrameUrl(frame)} alt="" draggable={false}
          style={{
            position: "absolute", bottom: 2, left: x,
            height: catHeight, width: catW,
            transform: dir < 0 ? "scaleX(-1)" : "none",
          }}
        />
      </div>
      {label && <p style={{ fontSize: 11, color: "#a09890", fontWeight: 600 }}>{label}</p>}
    </div>
  );
}

interface CatOverlayProps {
  label?: string;
  dim?: boolean;
  progress?: number;
}

export function CatOverlay({ label = "Memproses...", dim = true, progress }: CatOverlayProps) {
  // Pakai fixed agar animasi tidak diblokir oleh transform/scale parent
  // dan tetap jalan meski main thread sedang berat (TensorFlow inference)
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 z-[9999]"
      style={{ background: dim ? "rgba(0,0,0,0.6)" : "transparent", backdropFilter: dim ? "blur(3px)" : "none" }}
    >
      <LoadingCat trackWidth={180} catHeight={72} />
      <div className="flex flex-col items-center gap-2">
        <p style={{ fontSize: 13, fontWeight: 700, color: dim ? "white" : "#555" }}>{label}</p>
        {progress !== undefined && (
          <div className="rounded-full overflow-hidden" style={{ width: 140, height: 5, background: dim ? "rgba(255,255,255,0.25)" : "#f0ede9" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ff742f,#ff9a5c)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
