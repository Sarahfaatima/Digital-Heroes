import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API is proxied so no CORS setup / localhost URL is baked into the bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
})
