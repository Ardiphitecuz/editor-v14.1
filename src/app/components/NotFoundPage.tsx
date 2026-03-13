import { useEffect } from "react";
import { useNavigate } from "react-router";
import { mascotSrc } from "./MascotEmptyState";

export function NotFoundPage() {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#f8f5f1" }}
    >
      {/* 404 besar transparan */}
      <div className="relative flex items-center justify-center mb-2" style={{ height: 80 }}>
        <p style={{ fontSize: 100, fontWeight: 900, color: "#ede9e4", lineHeight: 1, letterSpacing: "-6px", userSelect: "none" }}>404</p>
      </div>

      {/* Maskot garuk kepala */}
      <div className="relative mb-3">
        <img
          src={mascotSrc("garuk")}
          alt=""
          draggable={false}
          style={{ height: 200, width: "auto" }}
        />
        {/* Tanda tanya melayang */}
        <span className="absolute" style={{ top: 20, right: -8, fontSize: 22, color: "#ff742f", animation: "floatQ1 2s ease-in-out infinite" }}>?</span>
        <span className="absolute" style={{ top: 4, right: 16, fontSize: 14, color: "#c97240", animation: "floatQ2 2.5s ease-in-out infinite" }}>?</span>
      </div>

      <p style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>
        Halaman tidak ditemukan
      </p>
      <p style={{ fontSize: 13, color: "#a09890", lineHeight: 1.6, maxWidth: 240, marginBottom: 24 }}>
        Bahkan maskot kita pun bingung kamu nyasar ke mana 🐱
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-3 rounded-2xl font-bold active:scale-95 transition-transform"
          style={{ background: "#f0ede9", color: "#666", fontSize: 13 }}
        >← Kembali</button>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-3 rounded-2xl text-white font-bold active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg,#ff742f,#ff9a5c)", fontSize: 13 }}
        >Ke Beranda</button>
      </div>

      <style>{`
        @keyframes floatQ1 { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-10px) rotate(6deg)} }
        @keyframes floatQ2 { 0%,100%{transform:translateY(0) rotate(3deg)} 50%{transform:translateY(-14px) rotate(-7deg)} }
      `}</style>
    </div>
  );
}
