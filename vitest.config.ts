import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false, // Run test files sequentially to avoid browser resource conflicts
    hookTimeout: 30000, // Increase hook timeout for browser cleanup
  },
});
