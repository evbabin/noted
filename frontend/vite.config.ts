/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    // Exclude Playwright e2e tests — they run via `pnpm test:e2e`, not Vitest.
    exclude: ['e2e/**', 'node_modules/**'],
    // Don't fail CI when no unit test files exist yet.
    passWithNoTests: true,
  },
});
