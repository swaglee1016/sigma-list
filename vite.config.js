import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://sigma-list.vercel.app',
        changeOrigin: true,
      },
    },
  },
});
