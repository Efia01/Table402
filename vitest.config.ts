import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.ts', 'apps/**/src/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**'],
    environment: 'node',
    globals: false,
  },
});
