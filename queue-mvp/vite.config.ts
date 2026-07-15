import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  appType: 'spa',
  build: { outDir: 'dist' },
  server: { port: 5173, host: true },
});
