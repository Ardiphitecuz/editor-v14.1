import { useEffect, useState, useRef } from "react";

// 23 frames sprite kucing berlari
const TOTAL_FRAMES = 23;
const FPS = 12; // frame per detik
const FRAME_MS = 1000 / FPS;

// Preload semua frame
function buildFrameUrl(i: number) {
  return `/mascot/cat-frame-${String(i).padStart(2, "0")}.png`;
}

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [frame, setFrame] = useState(0);
  const [catX, setCatX] = useState(-120); // mulai dari kiri luar layar
  const [phase, setPhase] = useState<"run-in" | "pause" | "run-out">("run-in");
  const [opacity, setOpacity] = useState(1);
  const rafRef = useRef<number>(0);
  const lastFrameTime = useRef(0);
  const startTime = useRef(Date.now());
  const screenW = window.innerWidth;

  // Animasi frame sprite
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

  // Animasi posisi kucing
  useEffect(() => {
    const CENTER = screenW / 2 - 60;
    const duration = {
      "run-in": 900,
      "pause": 1200,
      "run-out": 700,
    };

    if (phase === "run-in") {
      const start = performance.now();
      const from = -120, to = CENTER;
      function animate(ts: number) {
        const p = Math.min((ts - start) / duration["run-in"], 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setCatX(from + (to - from) * ease);
        if (p < 1) rafRef.current = requestAnimationFrame(animate);
        else {
          setPhase("pause");
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    } else if (phase === "pause") {
      const t = setTimeout(() => setPhase("run-out"), duration["pause"]);
      return () => clearTimeout(t);
    } else if (phase === "run-out") {
      const start = performance.now();
      const from = CENTER, to = screenW + 20;
      function animate(ts: number) {
        const p = Math.min((ts - start) / duration["run-out"], 1);
        const ease = Math.pow(p, 2);
        setCatX(from + (to - from) * ease);
        if (p < 1) rafRef.current = requestAnimationFrame(animate);
        else {
          // Fade out
          setOpacity(0);
          setTimeout(onDone, 350);
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [phase]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "#f8f5f1",
        opacity,
        transition: opacity < 1 ? "opacity 0.35s ease" : "none",
      }}
    >
      {/* Logo */}
      <img
        src="/mascot/logo.png"
        alt="Otaku Cafe"
        className="mb-8"
        style={{ width: 180, height: "auto", opacity: phase === "pause" ? 1 : 0.85, transition: "opacity 0.4s" }}
      />

      {/* Stage kucing berlari */}
      <div className="relative w-full overflow-hidden" style={{ height: 90 }}>
        {/* Ground line */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 1.5, background: "rgba(0,0,0,0.08)" }}
        />
        {/* Kucing */}
        <img
          src={buildFrameUrl(frame)}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            bottom: 4,
            left: catX,
            width: 100,
            height: 80,
            imageRendering: "pixelated",
            transition: "none",
          }}
        />
      </div>

      {/* Loading dots saat pause */}
      <div className="mt-5 flex gap-1.5" style={{ opacity: phase === "pause" ? 1 : 0, transition: "opacity 0.3s" }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: "#ff742f",
              animation: `bounce 0.8s ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
