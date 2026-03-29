import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const webPort = Number(process.env.PORT ?? '4173') || 4173
const apiPort = Number(process.env.VITE_API_PORT ?? '4174') || 4174

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: webPort,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
      '/generated': `http://127.0.0.1:${apiPort}`,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: webPort,
  },
})
