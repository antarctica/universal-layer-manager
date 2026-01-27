/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import camelCase from 'camelcase';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
) as PackageJson;

const packageName = packageJson.name.split('/').pop() ?? packageJson.name;

const externalDeps = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
];

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      name: camelCase(packageName, { pascalCase: true }),
      fileName: packageName,
    },
    rollupOptions: {
      external: externalDeps,
    },
  },
  plugins: [
    dts({ rollupTypes: true }),
  ],
});
