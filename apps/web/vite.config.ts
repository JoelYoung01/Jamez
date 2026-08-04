import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// VITE_BASE is set by the GitHub Pages workflow (e.g. "/Jamez/").
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    // The workspace hoists one React for web + Expo; never bundle two copies.
    dedupe: ['react', 'react-dom'],
  },
})
