import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/main.ts'
      },
      preload: {
        input: resolve(__dirname, 'src/preload/preload.ts')
      },
      renderer: {}
    })
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.js')
  }
})
