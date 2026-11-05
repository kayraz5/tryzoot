// EDITOR: KAYRA
import { readdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * Dev only: serve the Vercel functions in api/ from the Vite server, so /api/plan
 * and /api/summary work under `pnpm dev`. Server-only vars (GROQ_API_KEY) are read
 * from .env into process.env here and never reach the browser bundle.
 */
function vercelApiDev() {
  return {
    name: 'vercel-api-dev',
    apply: (_config, { command }) => command === 'serve' && !process.env.VITEST,
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use('/api', async (req, res, next) => {
        const name = req.url.split('?')[0].replace(/^\/+/, '')
        if (!/^[a-z-]+$/.test(name)) return next()
        let mod
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`)
        } catch {
          return next()
        }
        let raw = ''
        for await (const chunk of req) raw += chunk
        try {
          req.body = raw ? JSON.parse(raw) : {}
        } catch {
          req.body = {}
        }
        res.status = (code) => {
          res.statusCode = code;
          return res
        }
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data))
        }
        try {
          await mod.default(req, res)
        } catch (err) {
          res.status(500).json({ error: String(err.message || err) })
        }
      })
    }
  }
}

// Stamp art lives in public/stamps/ (served as /stamps/<name>.png). The file names are baked in
// at start-up so the app knows which places have art; restart the dev server after adding one.
const stampIds = readdirSync(fileURLToPath(new URL('./public/stamps', import.meta.url)))
  .filter((file) => file.endsWith('.png'))
  .map((file) => file.slice(0, -4))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), vercelApiDev(),],
  define: {
    __STAMP_IDS__: JSON.stringify(stampIds),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
