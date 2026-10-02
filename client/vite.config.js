import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/api': 'http://localhost:5000',
  '/socket.io': { target: 'http://localhost:5000', ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  // `npm run preview` serves the production build (with the service worker) — same API proxy.
  preview: { port: 4173, proxy },
});
