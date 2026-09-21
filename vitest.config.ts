import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'examples/newsletter/fixtures/**/*.test.ts',
    ],
    testTimeout: 20000,
  },
});
