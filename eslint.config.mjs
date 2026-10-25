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
]);
