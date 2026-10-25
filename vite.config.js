import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on the local network
    port: 5173,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT || 4321}`, changeOrigin: true } }
  }
})
