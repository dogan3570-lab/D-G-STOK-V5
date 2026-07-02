import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:4000',
      '/api-status': 'http://localhost:4000',
      '/marketplaces': 'http://localhost:4000',
      '/dashboard': 'http://localhost:4000',
      '/actions': 'http://localhost:4000',
      '/sse': {
        target: 'http://localhost:4000',
        ws: true
      }
    }
  }
});

