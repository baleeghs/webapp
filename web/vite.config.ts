import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// One origin in every mode:
// - development: Vite serves the UI on :5173 and proxies /api (and the probes) to the Rust server;
// - production: `pnpm build` writes the UI into server/static, which the Rust server serves at `/`
//   next to /api/v1/*, so there is no separate web server and no CORS.
const API_TARGET = process.env['API_TARGET'] ?? 'http://localhost:8080';
const OUT_DIR = fileURLToPath(new URL('../server/static', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': API_TARGET,
      '/healthz': API_TARGET,
      '/readyz': API_TARGET,
    },
  },
  build: {
    outDir: OUT_DIR,
    // The folder is outside web/, so Vite only empties it when told to.
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2023',
    rolldownOptions: {
      output: {
        // Libraries change far less often than app code: separate chunks stay cached across deploys.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
