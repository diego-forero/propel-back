import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    reporters: 'default',
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
