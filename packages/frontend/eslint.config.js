import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['vite.config.js', 'vitest.config.js', 'playwright.config.js', 'tests/**/*.js', 'vite/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Vitest runs with globals: true (describe, test, expect, vi)
    files: ['src/**/*.test.{js,jsx}', 'vite/**/*.test.js'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // An add-on's web entry exports its pages in one object, as docs/ADDONS.md describes
    files: ['tests/fixtures/addons/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
