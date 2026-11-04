import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../core/dist/ui', emptyOutDir: true, assetsDir: 'assets' },
})
