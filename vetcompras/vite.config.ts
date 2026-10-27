import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Reconocimiento de texto (OCR) sin internet para PDF escaneados y fotos de facturas:
 * el programa de lectura y el idioma español se sirven desde el propio PC en /ocr/.
 */
const ARCHIVOS_OCR: Record<string, string> = {
  'ocr/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'ocr/core/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'ocr/core/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'ocr/lang/spa.traineddata.gz': 'node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz',
};

function archivosOcr(): Plugin {
  return {
    name: 'vetcompras-ocr',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const origen = ARCHIVOS_OCR[(req.url || '').split('?')[0].replace(/^\//, '')];
        if (!origen) return next();
        res.setHeader('Content-Type', origen.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        fs.createReadStream(path.resolve(import.meta.dirname, origen)).pipe(res);
      });
    },
    generateBundle() {
      for (const [destino, origen] of Object.entries(ARCHIVOS_OCR)) {
        this.emitFile({ type: 'asset', fileName: destino, source: fs.readFileSync(path.resolve(import.meta.dirname, origen)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), archivosOcr()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  build: {
    // Aplicación local: un solo paquete grande no afecta (se carga desde el disco del PC)
    chunkSizeWarningLimit: 2500,
  },
});
