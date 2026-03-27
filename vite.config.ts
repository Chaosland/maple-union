import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'
import type { Plugin } from 'vite'

function obfuscatorPlugin(): Plugin {
  return {
    name: 'javascript-obfuscator',
    apply: 'build',
    enforce: 'post',
    async renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('.js') && !chunk.fileName.endsWith('.mjs')) return null
      // preload는 contextBridge IPC 브릿지 — 난독화하면 window.api 프로퍼티 손상 가능
      if (chunk.fileName === 'preload.js') return null
      // 렌더러/워커 번들 제외
      if (chunk.fileName.startsWith('assets/')) return null
      const { default: JavaScriptObfuscator } = await import('javascript-obfuscator')
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        rotateStringArray: true,
        shuffleStringArray: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false
      })
      return { code: result.getObfuscatedCode(), map: null }
    }
  }
}

function devCharlistApiPlugin(): Plugin {
  return {
    name: 'dev-charlist-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/charlist')) {
          next()
          return
        }

        try {
          const apiKey = req.headers['x-api-key']
          const key = Array.isArray(apiKey) ? apiKey[0] : apiKey
          if (!key) {
            res.statusCode = 401
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: false, error: 'API 키 없음' }))
            return
          }

          const BASE = 'https://open.api.nexon.com'
          const nxHeaders = {
            'x-nxopen-api-key': key,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          }

          const listRes = await fetch(`${BASE}/maplestory/v1/character/list`, {
            headers: nxHeaders,
            cache: 'no-store'
          })
          if (!listRes.ok) {
            const msg = await listRes.text()
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: false, error: `목록 조회 실패: ${msg}` }))
            return
          }

          const listJson = await listRes.json() as {
            account_list: Array<{ character_list: Array<{ ocid: string }> }>
          }
          const ocids = (listJson.account_list ?? []).flatMap(a => (a.character_list ?? []).map(c => c.ocid))
          if (ocids.length === 0) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: true, data: [] }))
            return
          }

          const BATCH = 5
          const results: Array<Record<string, unknown>> = []
          for (let i = 0; i < ocids.length; i += BATCH) {
            const chunk = ocids.slice(i, i + BATCH)
            const settled = await Promise.allSettled(
              chunk.map(ocid =>
                fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`, {
                  headers: nxHeaders,
                  cache: 'no-store'
                })
                  .then(r => r.json())
                  .then(d => ({ ...(d as object), ocid } as Record<string, unknown>))
              )
            )
            settled.forEach(r => { if (r.status === 'fulfilled') results.push(r.value) })
            if (i + BATCH < ocids.length) await new Promise(r => setTimeout(r, 150))
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
          res.end(JSON.stringify({ ok: true, data: results }))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: String(e) }))
        }
      })
    }
  }
}

export default defineConfig({
  root: 'src/renderer',
  publicDir: resolve(__dirname, 'public'),
  plugins: [
    devCharlistApiPlugin(),
    react(),
    electron({
      main: {
        entry: resolve(__dirname, 'src/main/main.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron')
          }
        }
      },
      preload: {
        input: resolve(__dirname, 'src/preload/preload.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js'
              }
            }
          }
        }
      }
    }),
    obfuscatorPlugin()
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.cjs')
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})
