import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@engines': fileURLToPath(new URL('./src/engines', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.test.ts']
  }
})
