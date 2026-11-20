import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona no GitHub Pages (em /ulisses-live/) e em qualquer outro endereço.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2019', sourcemap: false, chunkSizeWarningLimit: 900 },
})
