import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Tüm API isteklerini backend'e yönlendir
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api-status': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/xml-sources': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/products': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/categories': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/marketplaces': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/marketplace': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/actions': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/debug': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/brands': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/variants': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/orders': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/settings': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/audit-logs': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/templates': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/shipments': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/finance': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/messages': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/sse': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});
