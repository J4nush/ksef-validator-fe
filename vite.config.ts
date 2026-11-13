import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { ViteSSGOptions } from 'vite-ssg'
import { securityHeaders } from './scripts/lib/security-headers.mjs'

const ssgOptions: ViteSSGOptions = {
  script: 'async',
  // 'minify' strips whitespace between inline text nodes and breaks hydration.
  formatting: 'none',
  dirStyle: 'nested',
  includedRoutes: () => ['/', '/404'],
  htmlFileName: (filename) => (filename === '404/index.html' ? '404.html' : undefined),
}

export default defineConfig({
  plugins: [vue()],
  define: {
    __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./vendor/ksef-pdf-generator/src/shared', import.meta.url)),
      'ksef-pdf-generator': fileURLToPath(new URL('./vendor/ksef-pdf-generator/src', import.meta.url)),
    },
  },
  build: {
    // font-src 'self' rejects fonts inlined as data: URIs.
    assetsInlineLimit: 0,
  },
  preview: {
    headers: securityHeaders,
  },
  ssgOptions,
})
