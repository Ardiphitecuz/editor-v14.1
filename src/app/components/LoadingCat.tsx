import { useEffect, useState, useRef } from "react";

const TOTAL_FRAMES = 23;
const FPS = 12;
const FRAME_MS = 1000 / FPS;

function buildFrameUrl(i: number) {
  return `/mascot/cat-frame-${String(i).padStart(2, "0")}.png`;
}

interface LoadingCatProps {
  /** Teks di bawah kucing */
  label?: string;
  size?: number;
}

export function LoadingCat({ label = "Memuat...", size = 80 }: LoadingCatProps) {
  const [frame, setFrame] = useState(0);
  const [catX, setCatX] = useState(0);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameIdx = 0;
    let last = 0;
    function tick(ts: number) {
      if (ts - last > FRAME_MS) {
        frameIdx = (frameIdx + 1) % TOTAL_FRAMES;
        setFrame(frameIdx);
        last = ts;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Kucing lari bolak-balik dalam container
  useEffect(() => {
    const containerW = containerRef.current?.clientWidth ?? 200;
    const catW = size;
    const maxX = containerW - catW;
    let x = 0;
    let dir = 1;
    let last = 0;

    function move(ts: number) {
      if (ts - last > 16) {
        x += dir * 2.5;
        if (x >= maxX) { x = maxX; dir = -1; }
        if (x <= 0) { x = 0; dir = 1; }
        setCatX(x);
        last = ts;
      }
      rafRef.current = requestAnimationFrame(move);
    }
    rafRef.current = requestAnimationFrame(move);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        className="relative w-48 overflow-hidden"
        style={{ height: size * 0.85 }}
      >
        <div
          className="absolute bottom-0"
          style={{ height: 1, background: "rgba(0,0,0,0.1)", left: 0, right: 0 }}
        />
        <img
          src={buildFrameUrl(frame)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            bottom: 2,
            left: catX,
            width: size,
            height: size * 0.8,
            imageRendering: "pixelated",
          }}
        />
      </div>
      {label && (
        <p style={{ fontSize: 12, color: "#a09890", fontWeight: 600 }}>{label}</p>
      )}
    </div>
  );
}
