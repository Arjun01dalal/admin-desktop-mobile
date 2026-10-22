import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const sharedSrc = path.resolve(__dirname, '../shared/src');
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version?: string };

/**
 * Resolve `@astro/shared/<subpath>` to either `shared/src/<subpath>.ts`
 * or `shared/src/<subpath>/index.ts` (folder packages like opsDashboard).
 */
function astroSharedSubpathPlugin(): Plugin {
  return {
    name: 'astro-shared-subpath',
    enforce: 'pre',
    resolveId(id) {
      const match = id.match(/^@astro\/shared\/(.+)$/);
      if (!match) return null;
      const sub = match[1];
      const asFile = path.join(sharedSrc, `${sub}.ts`);
      if (existsSync(asFile)) return asFile;
      const asIndex = path.join(sharedSrc, sub, 'index.ts');
      if (existsSync(asIndex)) return asIndex;
      return null;
    },
  };
}

export default defineConfig({
  plugins: [astroSharedSubpathPlugin(), react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
  },
  resolve: {
    // Root package only here — subpaths are handled by astroSharedSubpathPlugin
    // so both `foo.ts` and `foo/index.ts` resolve correctly.
    alias: [
      {
        // Exact match only — subpaths go through astroSharedSubpathPlugin.
        find: /^@astro\/shared$/,
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
