import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  // Only PORT is read here; the music settings stay on the server.
  const { PORT = '4321' } = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version) },
    server: {
      host: true, // expose on the local network
      port: 5173,
      proxy: { '/api': { target: `http://127.0.0.1:${PORT}`, changeOrigin: true } }
    }
  }
})
