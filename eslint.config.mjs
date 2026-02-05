// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // TypeScript Best Practices - Strict Mode
      '@typescript-eslint/no-explicit-any': 'error', // ✅ Changed from 'off' to 'error'
      '@typescript-eslint/no-floating-promises': 'error', // ✅ Changed from 'warn' to 'error'
      '@typescript-eslint/no-unsafe-argument': 'error', // ✅ Changed from 'warn' to 'error'
      '@typescript-eslint/no-unsafe-assignment': 'error', // ✅ Added
      '@typescript-eslint/no-unsafe-call': 'error', // ✅ Added
      '@typescript-eslint/no-unsafe-member-access': 'error', // ✅ Added
      '@typescript-eslint/no-unsafe-return': 'error', // ✅ Added
      
      // Code Style
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      
      // SonarJS Code Smell Detection
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/prefer-immediate-return': 'warn',
      
      // Magic Numbers
      '@typescript-eslint/no-magic-numbers': ['warn', { 
        ignore: [0, 1, -1],
        ignoreEnums: true,
        ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true,
        ignoreArrayIndexes: true,
      }],
    },
  },
);
