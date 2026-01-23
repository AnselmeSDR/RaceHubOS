import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendPort = process.env.BACKEND_PORT || 3001

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/health': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
