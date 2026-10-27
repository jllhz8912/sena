import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Compila la demostración en línea (sin servidor): npm run build:demo
 * Genera dist-demo/, que luego se empaqueta en un solo HTML para publicarlo.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rolldownOptions: { input: 'demo.html', output: { codeSplitting: false } },
  },
});
