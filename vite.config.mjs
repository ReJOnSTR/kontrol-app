import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('html2pdf.js') || id.includes('pdfjs-dist') || id.includes('jspdf')) {
              return 'vendor-pdf'
            }
            if (id.includes('xlsx')) {
              return 'vendor-excel'
            }
            if (id.includes('recharts')) {
              return 'vendor-charts'
            }
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query'
            }
            if (id.includes('zod')) {
              return 'vendor-zod'
            }
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/*.timestamp-*.mjs',
        '**/database.db*',
        '**/data/**',
        '**/backups/**',
        '**/*.sqlite*',
        '**/.git/**',
        '**/.env*',
      ]
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9999',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://127.0.0.1:9999',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
