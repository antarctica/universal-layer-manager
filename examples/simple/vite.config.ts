import process from 'node:process';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    base: isProduction ? (process.env.VITE_BASE_PATH || '/universal-layer-manager/') : '/',
    server: {
      port: 5175,
    },
  };
});
