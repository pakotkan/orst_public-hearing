import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production Nginx serves the built app and routes /api and /uploads to the backend.
const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Needed when running in Docker on Windows (see docker-compose.dev.yml).
    watch: process.env.VITE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': apiUrl,
      '/uploads': apiUrl,
    },
  },
})
