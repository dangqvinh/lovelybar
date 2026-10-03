import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api and /uploads are proxied to the Go backend so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
})
