import { ReactNode } from "react";

// Tipe ekspresi yang tersedia — satu per konteks empty state
export type MascotExpression =
  | "draft_empty"        // cek jam — menunggu konten
  | "saved_empty"        // bored — belum ada simpanan
  | "search_empty"       // tanda tanya — tidak ditemukan
  | "not_found"          // sedih — halaman tidak ada
  | "error"              // kesal — sesuatu error
  | "subscriptions_empty"// tunjuk — tambah sumber dulu
  | "offline"            // nangis — tidak ada koneksi
  | "processing"         // gigit jari — sedang proses
  | "neutral_wait"       // netral — placeholder umum
  | "confused";          // pusing — waduh

function mascotUrl(expr: MascotExpression) {
  return `/mascot/expr/${expr}.png`;
}

interface MascotEmptyProps {
  expression: MascotExpression;
  title: string;
  description?: string;
  /** Konten tambahan: tombol action, dll */
  children?: ReactNode;
  /** Ukuran gambar maskot, default 160 */
  size?: number;
  /** Override className wrapper */
  className?: string;
}

export function MascotEmpty({
  expression,
  title,
  description,
  children,
  size = 160,
  className = "",
}: MascotEmptyProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-8 text-center gap-3 ${className}`}
      style={{ minHeight: "calc(100dvh - 140px)" }}>
      <img
        src={mascotUrl(expression)}
        alt=""
        draggable={false}
        style={{ height: size, width: "auto", marginBottom: 2 }}
      />
      <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.3 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 13, color: "#a09890", lineHeight: 1.6, maxWidth: 260 }}>{description}</p>
      )}
      {children && <div className="mt-1 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}

// Tombol aksi standar untuk reuse
interface MascotActionButtonProps {
  onClick: () => void;
  label: string;
  variant?: "primary" | "secondary";
}

export function MascotActionButton({ onClick, label, variant = "primary" }: MascotActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
      style={
        variant === "primary"
          ? { background: "linear-gradient(135deg,#ff742f,#ff9a5c)", color: "white" }
          : { background: "#f0ede9", color: "#555" }
      }
    >
      {label}
    </button>
  );
}
