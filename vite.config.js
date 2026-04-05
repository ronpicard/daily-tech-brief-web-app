import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Project Pages: https://<user>.github.io/<repo>/
const repoName = 'daily-tech-brief-web-app'

export default defineConfig(({ command }) => ({
  // '/' for dev; repo subpath for production (GitHub Pages)
  base:
    process.env.VITE_BASE_PATH ??
    (command === 'build' ? `/${repoName}/` : '/'),
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
}))
