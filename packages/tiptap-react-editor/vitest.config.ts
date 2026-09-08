import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Actual CSS (not stubbed) so tests that assert on visibility/layout
    // driven by our stylesheet (e.g. the collapsed-state regression test)
    // reflect what a real browser would compute, not just DOM structure.
    css: true,
  },
});
