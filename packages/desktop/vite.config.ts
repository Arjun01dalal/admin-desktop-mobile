import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const sharedSrc = path.resolve(__dirname, '../shared/src');
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version?: string };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
  },
  resolve: {
    // More specific aliases MUST come first — otherwise `@astro/shared`
    // steals `@astro/shared/permissions` (etc.) and resolution fails.
    alias: [
      {
        find: /^@astro\/shared\/api$/,
        replacement: path.join(sharedSrc, 'api/index.ts'),
      },
      {
        find: /^@astro\/shared\/(.+)$/,
        replacement: path.join(sharedSrc, '$1.ts'),
      },
      {
        find: '@astro/shared',
        replacement: path.join(sharedSrc, 'index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../shared')],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Strip console.* / debugger from production renderer bundles.
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },
});
