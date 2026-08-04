import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = (env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      modulePreload: {
        polyfill: true,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-select')) return 'vendor-select';
            if (id.includes('docx-preview') || id.includes('html2pdf.js') || id.includes('jszip')) {
              return 'vendor-docs';
            }
            // Keep the React runtime graph in one chunk to avoid vendor ↔ vendor-react cycles.
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('scheduler') ||
              /[/\\](react|react-dom)[/\\]/.test(id)
            ) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
        },
        '/uploads': {
          target: backend,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 5173,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
        },
        '/uploads': {
          target: backend,
          changeOrigin: true,
        },
      },
    },
  };
});
