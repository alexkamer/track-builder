import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

/** Where `scripts/extract_car.py` writes, relative to the project root. Gitignored. */
const DEV_CARS_DIR = resolve(import.meta.dirname, 'dev-cars')
const DEV_CARS_ROUTE = '/dev-cars/'

const CONTENT_TYPES: Record<string, string> = {
  '.obj': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

/**
 * Serves locally-extracted car models during development only.
 *
 * These files come from car packs that may be used inside an end product but not
 * redistributed, so they deliberately do NOT live in `public/`: Vite copies that directory
 * verbatim into `dist/`, which would put non-redistributable geometry into every build. Serving
 * them from outside the published tree makes it impossible for a build to carry them, while
 * keeping the URL (`/dev-cars/<id>.obj`) the app's dev-only car loader expects.
 *
 * `apply: 'serve'` keeps the plugin out of the build entirely. See docs/dev-cars.md.
 */
function devCarsPlugin(): Plugin {
  return {
    name: 'trackforge:dev-cars',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(DEV_CARS_ROUTE, (req, res, next) => {
        // Strip any query string, then normalize and confine the path to the cars directory so
        // a crafted URL cannot read files elsewhere on the machine.
        const requested = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        const filePath = join(DEV_CARS_DIR, normalize(requested))
        if (!filePath.startsWith(DEV_CARS_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next()
          return
        }
        res.setHeader('Content-Type', CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream')
        // No caching: re-running the extractor should show up on the next reload.
        res.setHeader('Cache-Control', 'no-store')
        createReadStream(filePath).pipe(res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devCarsPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('node_modules/@react-three/')) return 'react-three'
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
