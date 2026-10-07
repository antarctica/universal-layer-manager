/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import camelCase from 'camelcase';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import packageJson from './package.json' with { type: 'json' };

const packageName = packageJson.name.split('/').pop() ?? packageJson.name;

const externalDeps = Object.keys(packageJson.peerDependencies);

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      // maplibre-gl 6 ships ES modules only.
      formats: ['es'],
      name: camelCase(packageName, { pascalCase: true }),
      fileName: packageName,
    },
    rollupOptions: {
      external: externalDeps,
    },
  },
  plugins: [
    dts({ bundleTypes: true }),
  ],
  // Pre-bundling moves maplibre-gl away from the worker file it loads by URL.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  test: {
    alias: {
      '@ulm/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
    setupFiles: ['test/require-webgl2.ts'],
    browser: {
      enabled: true,
      // SwiftShader gives headless Chromium a software WebGL2 context.
      provider: playwright({
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      }),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
