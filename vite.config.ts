import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': 'http://127.0.0.1:4174',
      '/generated': 'http://127.0.0.1:4174',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
