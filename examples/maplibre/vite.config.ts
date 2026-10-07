import process from 'node:process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    // For GitHub Pages, use the repository name as base path
    // Set VITE_BASE_PATH env var to override (e.g., '/' for root)
    // Only use base path in production builds
    base: isProduction ? (process.env.VITE_BASE_PATH || '/universal-layer-manager/') : '/',
    plugins: [react()],
    // VitePress keeps React 18 at the repository root for its search box.
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    // Pre-bundling moves maplibre-gl away from the worker file it loads by URL.
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    // MapLibre starts its worker as a module.
    worker: {
      format: 'es',
    },
    server: {
      port: 5178,
    },
  };
});
