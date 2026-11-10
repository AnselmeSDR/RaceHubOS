// Backend, shared package and repository scripts. The interface has its own
// config in packages/frontend: ESLint uses the config nearest to each file.
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/dist', 'packages/backend/public', 'packages/backend/prisma/generated']),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['packages/backend/src/__tests__/**'],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    // The site's page scripts run in the browser as classic scripts
    files: ['site/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },
  {
    // Playwright scripts: callbacks handed to page.evaluate run in the page
    files: ['site/tests/*.spec.mjs', 'site/scripts/screenshots.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
]);
