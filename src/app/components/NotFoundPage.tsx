import { useNavigate } from "react-router";
import { MascotEmpty, MascotActionButton } from "./MascotEmpty";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#f8f5f1" }}>
      {/* 404 number */}
      <div className="relative mb-2">
        <p style={{ fontSize: 96, fontWeight: 900, color: "#f0ede9", lineHeight: 1, letterSpacing: "-4px", userSelect: "none" }}>404</p>
        <p className="absolute inset-0 flex items-center justify-center"
           style={{ fontSize: 96, fontWeight: 900, color: "#ff742f", lineHeight: 1, letterSpacing: "-4px", opacity: 0.12 }}>404</p>
      </div>

      <MascotEmpty
        expression="not_found"
        title="Halaman tidak ditemukan"
        description="Sepertinya kamu nyasar ke tempat yang salah... bahkan maskot pun ikut sedih 😢"
        size={180}
      >
        <div className="flex gap-3">
          <MascotActionButton onClick={() => navigate(-1 as never)} label="← Kembali" variant="secondary" />
          <MascotActionButton onClick={() => navigate("/")} label="Ke Beranda" />
        </div>
      </MascotEmpty>

      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
