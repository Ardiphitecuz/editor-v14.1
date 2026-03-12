import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite' 
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'figma:asset': path.resolve(__dirname, './src/assets') 
    },
  },

  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router'],
          'vendor-ui':      ['lucide-react'],
          'vendor-tf':      ['@tensorflow/tfjs'],
          'vendor-upscaler': ['upscaler', '@upscalerjs/esrgan-legacy'],
          'page-editor':    ['./src/app/components/EditorPage.tsx'],
          'page-article':   ['./src/app/components/ArticlePage.tsx'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },

  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
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
