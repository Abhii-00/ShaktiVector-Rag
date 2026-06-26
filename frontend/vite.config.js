import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '^/(upload|ask|search|documents|history|config|suggestions|health)(/.*)?$': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
