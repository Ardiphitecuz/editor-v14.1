/**
 * LazyImage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gambar efisien dengan:
 *   • Auto-proxy cross-origin via /api/img — bypass COEP blocking
 *   • IntersectionObserver (rootMargin 350px) — mulai load sebelum masuk viewport
 *   • Skeleton placeholder animasi saat belum dimuat
 *   • Fallback otomatis jika gagal (coba tanpa proxy dulu, lalu fallback URL)
 *   • decoding="async" + loading="lazy" — tidak blokir thread utama
 *   • Fade-in halus setelah gambar siap
 */

import { useEffect, useRef, useState } from "react";
import { handleImgError } from "../../services/fetcherUtils";

// Inline SVG placeholder — tidak butuh request jaringan
const SKELETON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

const DEFAULT_FALLBACK =
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=70";

/**
 * Wrap URL cross-origin melalui /api/img proxy.
 * Diperlukan karena COEP "require-corp" memblokir gambar cross-origin secara langsung.
 */
function toProxied(src: string): string {
  if (!src) return src;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return "/api/img?url=" + encodeURIComponent(src);
}

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** URL gambar utama */
  src?: string;
  /** URL fallback jika src gagal */
  fallback?: string;
  /** Kelas tambahan untuk wrapper div */
  wrapperClass?: string;
  /** Style tambahan untuk wrapper div */
  wrapperStyle?: React.CSSProperties;
  /** Nonaktifkan proxy (default: proxy aktif) */
  noProxy?: boolean;
}

export function LazyImage({
  src,
  fallback = DEFAULT_FALLBACK,
  alt = "",
  className,
  style,
  wrapperClass,
  wrapperStyle,
  noProxy = false,
  onError,
  onLoad,
  ...rest
}: LazyImageProps) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Observe kapan elemen masuk viewport (+ 350px buffer)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "350px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Reset saat src berubah
  useEffect(() => {
    setLoaded(false);
  }, [src]);

  const rawSrc = src || fallback;
  const initialSrc = inView ? (noProxy ? rawSrc : toProxied(rawSrc)) : SKELETON_SVG;

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
      {!loaded && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg,#f0ede9 25%,#e8e4e0 50%,#f0ede9 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      )}

      {inView && (
        <img
          src={initialSrc}
          data-original-src={rawSrc} // Store real original URL for fallback logic
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
            handleImgError(e, rawSrc);
            (onError as React.ReactEventHandler<HTMLImageElement>)?.(e);
          }}
          {...rest}
        />
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