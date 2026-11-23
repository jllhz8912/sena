import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Versión de prueba del celular en UNA sola página web (para abrirla en el navegador
 * sin instalar): VITE_PRUEBA=1 vite build --config vite.movil-web.config.ts
 * Sin el lector OCR (pesado); el resto de módulos funciona igual.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  build: {
    outDir: 'dist-movil-web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 8000,
    assetsInlineLimit: 100_000_000,
    rolldownOptions: { input: 'movil.html', output: { codeSplitting: false } },
  },
});
