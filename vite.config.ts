import { defineConfig } from 'vite'
import path from 'path'
// Jika project Anda menggunakan Tailwind v4 / plugin khusus, biarkan baris ini.
// Jika error "module not found", hapus baris import tailwindcss ini.
import tailwindcss from '@tailwindcss/vite' 
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  
  // 1. PENGATURAN ALIAS (Digabung jadi satu)
  resolve: {
    alias: {
      // Alias standar "@" ke folder src
      '@': path.resolve(__dirname, './src'),
      
      // Alias Khusus: Mengarahkan "figma:asset" ke folder assets lokal
      'figma:asset': path.resolve(__dirname, './src/assets') 
    },
  },

  // 2. PENGATURAN FFMPEG (Wajib agar tidak error saat load library video)
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },

  // 3. PENGATURAN SERVER (Header wajib untuk SharedArrayBuffer/Video Processing)
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      // COEP dihapus — gambar cross-origin bisa dimuat langsung
      // Jika butuh FFmpeg/SharedArrayBuffer, aktifkan kembali dan pakai image proxy
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})