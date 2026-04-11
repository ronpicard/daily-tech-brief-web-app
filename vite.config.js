import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Project Pages: https://<user>.github.io/<repo>/
const repoName = 'daily-tech-brief-web-app'

function rssProxyPlugin() {
  return {
    name: 'rss-fetch-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/rss?')) {
          next()
          return
        }
        try {
          const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : ''
          const u = new URLSearchParams(q).get('u')
          if (!u || !/^https?:\/\//i.test(u)) {
            res.statusCode = 400
            res.end('Missing or invalid feed URL')
            return
          }
          const r = await fetch(u, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; DailyBrief/1.0)',
              Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            },
          })
          const text = await r.text()
          res.setHeader(
            'Content-Type',
            r.headers.get('content-type') || 'application/xml; charset=utf-8',
          )
          res.statusCode = r.status
          res.end(text)
        } catch (e) {
          res.statusCode = 502
          res.end(String(e?.message || e))
        }
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  // '/' for dev; repo subpath for production (GitHub Pages)
  base:
    process.env.VITE_BASE_PATH ??
    (command === 'build' ? `/${repoName}/` : '/'),
  plugins: [react(), rssProxyPlugin()],
  server: {
    proxy: {
      // Lobsters often blocks browser CORS; use in dev only.
      '/api/lobsters-hottest': {
        target: 'https://lobste.rs',
        changeOrigin: true,
        rewrite: () => '/hottest.json',
      },
      '/api/mymemory': {
        target: 'https://api.mymemory.translated.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mymemory/, ''),
      },
    },
  },
}))
