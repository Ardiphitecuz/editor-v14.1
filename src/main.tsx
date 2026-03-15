import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";

// ── IMPORT CSS (WAJIB ADA) ──
// Urutan import ini penting:
import "./styles/tailwind.css"; // 1. Tailwind (Gaya dasar & Utility)
import "./styles/index.css";    // 2. CSS Global
import "./styles/fonts.css";    // 3. Font (Gilroy/Nunito)
import "./styles/theme.css";    // 4. Tema (Warna/Variabel Figma)

// Render Aplikasi
createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}