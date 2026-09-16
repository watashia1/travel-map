import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

function maplibreRuntimeAssets(): Plugin {
  let shouldEmitBuildAssets = false;
  const assets = [
    {
      fileName: 'assets/maplibre-gl-worker.mjs',
      sourcePath: require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'),
    },
    {
      fileName: 'assets/maplibre-gl-shared.mjs',
      sourcePath: require.resolve('maplibre-gl/dist/maplibre-gl-shared.mjs'),
    },
  ];

  return {
    name: 'maplibre-runtime-assets',
    configResolved(config) {
      shouldEmitBuildAssets = config.command === 'build';
    },
    buildStart() {
      if (!shouldEmitBuildAssets) return;
      for (const asset of assets) {
        this.emitFile({
          type: 'asset',
          fileName: asset.fileName,
          source: readFileSync(asset.sourcePath),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split('?', 1)[0];
        const asset = assets.find((candidate) => `/${candidate.fileName}` === requestPath);
        if (!asset) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(asset.sourcePath));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), maplibreRuntimeAssets()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
