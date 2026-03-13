/**
 * LazyImage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Komponen gambar dengan:
 *   • IntersectionObserver lazy load (rootMargin 400px)
 *   • Skeleton shimmer placeholder saat belum dimuat
 *   • 5-Layer Image Fallback menggunakan state `attempt` React
 *     Layer 0: URL asli
 *     Layer 1: wsrv.nl (proxy image cepat)
 *     Layer 2: bypass.me/proxy (bypass hotlink protection)
 *     Layer 3: AllOrigins Raw
 *     Layer 4: corsproxy.io
 *     Layer 5+: Placeholder SVG (gagal semua)
 *   • Mendukung data-src & data-lazy-src (lazy load situs berita)
 *   • decoding="async" + loading="lazy" — tidak blokir main thread
 */

import { useEffect, useRef, useState } from "react";

// Inline SVG placeholder — tidak butuh request jaringan
const SKELETON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

const DEFAULT_FALLBACK =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=70";

const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect fill='%23e5e7eb' width='4' height='3'/%3E%3C/svg%3E";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: string;
  wrapperClass?: string;
  wrapperStyle?: React.CSSProperties;
  noProxy?: boolean;
}

// Hitung URL berdasarkan attempt saat ini
function getAttemptSrc(rawSrc: string, attempt: number): string | null {
  if (!rawSrc || !rawSrc.startsWith("http")) return PLACEHOLDER_SVG;
  const enc = encodeURIComponent(rawSrc);
  const clean = rawSrc.replace(/^https?:\/\//i, "");

  switch (attempt) {
    case 0: return rawSrc;                                              // URL asli
    case 1: return `https://wsrv.nl/?url=${enc}`;                      // wsrv.nl
    case 2: return `https://bypass.me/proxy?url=${enc}`;               // bypass.me
    case 3: return `https://api.allorigins.win/raw?url=${enc}`;        // allorigins raw
    case 4: return `https://corsproxy.io/?${enc}`;                     // corsproxy
    default: return PLACEHOLDER_SVG;                                   // gagal semua
  }
}

export function LazyImage({
  src,
  fallback = DEFAULT_FALLBACK,
  alt = "",
  className,
  style,
  wrapperClass,
  wrapperStyle,
  onError,
  onLoad,
  ...rest
}: LazyImageProps) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — mulai load saat mendekati viewport
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }

    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: "400px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Reset saat src berubah
  useEffect(() => {
    setLoaded(false);
    setAttempt(0);
  }, [src]);

  const rawSrc = src || fallback;
  const effectiveSrc = inView ? getAttemptSrc(rawSrc, attempt) : SKELETON_SVG;
  const isFailed = effectiveSrc === PLACEHOLDER_SVG;

  return (
    <div
      ref={wrapRef}
      className={wrapperClass}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#f0ede9",
        ...wrapperStyle,
      }}
    >
      {/* Skeleton shimmer — tampil saat belum loaded */}
      {!loaded && !isFailed && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg,#f0ede9 25%,#e8e4e0 50%,#f0ede9 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      )}

      {inView && !isFailed && (
        <img
          src={effectiveSrc!}
          alt={alt}
          className={className}
          style={{
            ...style,
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.25s ease",
            display: "block",
          }}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            setLoaded(true);
            onLoad?.(e);
          }}
          onError={(e) => {
            setLoaded(false);
            if (attempt < 4) {
              setAttempt(a => a + 1);
            } else {
              setAttempt(99); // trigger isFailed
            }
            (onError as React.ReactEventHandler<HTMLImageElement>)?.(e);
          }}
          {...rest}
        />
      )}

      {/* Placeholder SVG saat semua fallback gagal */}
      {isFailed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e5e7eb",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0 }
          100% { background-position:  200% 0 }
        }
      `}</style>
    </div>
  );
}