/// <reference types="vitest" />
import camelCase from 'camelcase';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import packageJson from './package.json';

const packageName = packageJson.name.split('/').pop() ?? packageJson.name;

const externalDeps = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
];

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
    dts({ rollupTypes: true }),
  ],
});
