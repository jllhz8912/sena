import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import { archivosOcr } from './vite.config';

/**
 * Compila la app de celular (Android): npm run build:movil
 * Genera dist-movil/, que Capacitor empaqueta dentro del APK.
 * Incluye el lector OCR en español para leer fotos y PDF de facturas sin internet.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    archivosOcr(),
    {
      // Capacitor abre index.html
      name: 'pagina-inicio-movil',
      closeBundle() {
        const origen = path.resolve(import.meta.dirname, 'dist-movil/movil.html');
        if (fs.existsSync(origen)) fs.renameSync(origen, path.resolve(import.meta.dirname, 'dist-movil/index.html'));
      },
    },
  ],
  base: './',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  build: {
    outDir: 'dist-movil',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
    rolldownOptions: { input: 'movil.html' },
  },
});
