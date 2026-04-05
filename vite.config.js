import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Lobsters often blocks browser CORS; use in dev only.
      '/api/lobsters-hottest': {
        target: 'https://lobste.rs',
        changeOrigin: true,
        rewrite: () => '/hottest.json',
      },
    },
  },
})
