import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.13.166')
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('html2pdf.js') || id.includes('pdfjs-dist') || id.includes('jspdf')) {
            return 'vendor-pdf'
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) {
            return 'vendor-query'
          }
          if (id.includes('xlsx')) {
            return 'vendor-excel'
          }
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts'
          }
          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd'
          }
          if (id.includes('zod')) {
            return 'vendor-zod'
          }
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
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
  optimizeDeps: {
    exclude: [
      'better-sqlite3',
      '@prisma/client',
      '@prisma/adapter-better-sqlite3',
      '@prisma/adapter-pg',
      'pg',
      'electron',
      'electron-log',
      'electron-store',
      'electron-updater'
    ]
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/node_modules.nosync/**',
        '**/dist/**',
        '**/dist-electron/**',
        '**/electron/**',
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
