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
      formats: ['es', 'cjs'],
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
  test: {
    alias: {
      '@ulm/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
