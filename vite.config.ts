import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// 프로덕션 빌드 전용 JS 난독화 플러그인 (개발 서버에서는 비활성)
function obfuscatorPlugin(): Plugin {
  return {
    name: 'javascript-obfuscator',
    apply: 'build',       // build 시에만 실행
    enforce: 'post',      // 다른 플러그인 변환 후 마지막에 적용
    async renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('.js') && !chunk.fileName.endsWith('.mjs')) return null
      const { default: JavaScriptObfuscator } = await import('javascript-obfuscator')
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: false,   // 성능 영향 큼 → 비활성
        deadCodeInjection: false,        // 번들 크기 증가 → 비활성
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        rotateStringArray: true,
        shuffleStringArray: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,            // Vite 번들과 호환성 문제 방지
      })
      return { code: result.getObfuscatedCode(), map: null }
    },
  }
}

export default defineConfig({
  root: 'src/renderer',
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: { '@renderer': resolve(__dirname, 'src/renderer/src') }
  },
  plugins: [react(), obfuscatorPlugin()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})
