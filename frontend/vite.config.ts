import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

function copySiteImages(): Plugin {
  return {
    name: 'copy-site-src-assets',
    apply: 'build',
    closeBundle() {
      const srcAssets = resolve(root, 'src/assets')
      const distAssets = resolve(root, 'dist/src/assets')
      if (fs.existsSync(srcAssets)) fs.cpSync(srcAssets, distAssets, { recursive: true, force: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), copySiteImages()],
  resolve: {
    alias: {
      '@shared': resolve(root, 'src/shared'),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      '/v1': {
        target: process.env.SABZINE_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/go': {
        target: process.env.SABZINE_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
