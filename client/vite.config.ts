import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Stamps the service worker with a unique build id so every deploy gets a fresh cache name. */
function swVersion(): Plugin {
  return {
    name: 'sw-version',
    apply: 'build',
    closeBundle() {
      const file = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(file)) {
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('__BUILD_ID__', Date.now().toString(36)));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersion()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000', '/uploads': 'http://localhost:3000', '/sitemap.xml': 'http://localhost:3000' },
  },
  build: {
    target: ['es2019', 'safari14'],
    cssTarget: ['safari14'],
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/three|@react-three/.test(id)) return 'three';
            if (/firebase|@firebase/.test(id)) return 'firebase';
            if (/gsap|lenis/.test(id)) return 'motion';
            if (/framer-motion|motion-dom|motion-utils/.test(id)) return 'framer';
            if (/react-dom|react-router|scheduler|\/react\//.test(id)) return 'react';
          }
        },
      },
    },
  },
});
