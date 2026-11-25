import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative URLs work at both / and /repository-name/ on GitHub Pages.
  base: './',
  test: { include: ['tests/**/*.test.ts'], coverage: { include: ['src/calculator.ts', 'src/inventory.ts', 'src/weight.ts'] } },
});
