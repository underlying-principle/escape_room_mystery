import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CrazyGames hosts games inside an iframe on their CDN, so the build must use
// relative asset paths ('./') and stay fully self-contained (no external URLs).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
