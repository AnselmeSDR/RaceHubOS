import path from 'path'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Unit tests never see the developer's own add-ons: the folder below has none
process.env.RACEHUBOS_ADDONS_DIR ??= path.resolve(import.meta.dirname, 'tests/fixtures/no-addons')

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{js,jsx}', 'vite/**/*.test.js'],
      setupFiles: ['./src/test/setup.js'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{js,jsx}', 'vite/**/*.js'],
        exclude: ['src/**/*.test.{js,jsx}', 'vite/**/*.test.js', 'src/test/**'],
        reporter: ['text-summary', 'text', 'html'],
      },
    },
  })
)
