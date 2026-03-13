import { ReactNode } from "react";

// Mapping ekspresi maskot ke file
export type MascotExpr =
  | "nunjuk"      // nunjuk ke user — untuk empty state utama (draft)
  | "sedih"       // sedih murung — untuk saved kosong
  | "tanya"       // ? bingung — untuk search no result
  | "capek"       // capek hembus — untuk error/offline
  | "ngantuk"     // ngantuk — untuk idle/loading lama
  | "jutek"       // jutek setengah mata — untuk 403/akses ditolak
  | "pusing"      // facepalm — untuk error fatal
  | "garuk"       // garuk kepala — untuk 404
  | "nutupin"     // nutupin mulut — untuk konfirmasi lucu
  | "datar"       // datar — untuk state netral
  | "cekjam";     // cek jam — untuk timeout/lambat

export function mascotSrc(expr: MascotExpr) {
  return `/mascot/expr/expr-${expr}.png`;
}

interface MascotEmptyStateProps {
  expr: MascotExpr;
  title: string;
  desc?: string;
  action?: ReactNode;
  /** Ukuran gambar maskot, default 160 */
  imgSize?: number;
  /** Kelas tambahan untuk wrapper */
  className?: string;
}

export function MascotEmptyState({
  expr,
  title,
  desc,
  action,
  imgSize = 160,
  className = "",
}: MascotEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-8 gap-3 text-center ${className}`}
      style={{ height: "calc(100dvh - var(--header-h, 140px))", maxHeight: "calc(100dvh - var(--header-h, 140px))", overflow: "hidden" }}>
      <img
        src={mascotSrc(expr)}
        alt=""
        draggable={false}
        style={{ height: imgSize, width: "auto" }}
      />
      <div className="flex flex-col gap-1">
        <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>{title}</p>
        {desc && (
          <p style={{ fontSize: 13, color: "#a09890", lineHeight: 1.6, maxWidth: 260 }}>{desc}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
