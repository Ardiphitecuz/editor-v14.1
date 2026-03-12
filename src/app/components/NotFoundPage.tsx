import { useNavigate } from "react-router";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#f8f5f1" }}
    >
      {/* Maskot sad */}
      <div className="relative mb-2">
        <img
          src="/mascot/maskot-404.png"
          alt="Maskot Otaku Cafe"
          style={{ width: 200, height: "auto" }}
        />
        {/* Efek question marks melayang */}
        <div className="absolute top-4 right-0" style={{ fontSize: 22, animation: "float1 2s ease-in-out infinite" }}>?</div>
        <div className="absolute top-0 right-8" style={{ fontSize: 16, color: "#ff742f", animation: "float2 2.4s ease-in-out infinite" }}>?</div>
      </div>

      {/* 404 text */}
      <div className="relative mb-3">
        <p style={{ fontSize: 96, fontWeight: 900, color: "#f0ede9", lineHeight: 1, letterSpacing: "-4px" }}>404</p>
        <p
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: 96, fontWeight: 900, color: "#ff742f", lineHeight: 1, letterSpacing: "-4px", opacity: 0.15 }}
        >404</p>
      </div>

      <p style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
        Halaman tidak ditemukan
      </p>
      <p className="text-neutral-400 mb-8" style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 260 }}>
        Sepertinya kamu nyasar ke tempat yang salah... bahkan kucing di sini pun bingung 🐱
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-3 rounded-2xl font-bold transition-all active:scale-95"
          style={{ background: "#f0ede9", color: "#555", fontSize: 14 }}
        >
          ← Kembali
        </button>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-3 rounded-2xl text-white font-bold transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)", fontSize: 14 }}
        >
          Ke Beranda
        </button>
      </div>

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(-14px) rotate(-8deg); }
        }
      `}</style>
    </div>
  );
}
