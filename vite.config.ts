import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/3R/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
  },
});
