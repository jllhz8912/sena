/**
 * Servidor local de VetCompras.
 *
 *   npm start        → modo instalado (sirve la versión compilada de /dist)
 *   npm run dev      → modo desarrollo (Vite con recarga en caliente)
 *
 * Variables opcionales en .env:
 *   PUERTO / PORT       Puerto HTTP (3000 por defecto)
 *   HOST                127.0.0.1 = solo este PC (defecto); 0.0.0.0 = toda la red local
 *   VETCOMPRAS_DATOS    Carpeta de la base de datos (defecto: <usuario>/VetCompras/datos)
 *   GEMINI_API_KEY      Habilita la lectura automática de facturas en PDF
 *   MINUTOS_INACTIVIDAD Minutos sin uso para cerrar la sesión (60 por defecto)
 */

import './server/silenciarAvisos';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { BaseDatosLocal } from './server/basedatos';
import { crearApi } from './server/api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '.env.local'), quiet: true });

const PUERTO = Number(process.env.PUERTO || process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const modoDesarrollo = process.argv.includes('--dev');

async function iniciar() {
  const bd = new BaseDatosLocal();
  console.log(`[VetCompras] Base de datos: ${bd.rutaArchivo} (esquema v${bd.versionEsquema()})`);

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (!modoDesarrollo) {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          "frame-src 'self' data: blob:",
          "object-src 'self' data: blob:",
          "connect-src 'self'",
          "base-uri 'none'",
          "form-action 'self'",
          "frame-ancestors 'self'",
        ].join('; ')
      );
    }
    next();
  });
  app.use(express.json({ limit: '60mb' }));

  let servidor: ReturnType<typeof app.listen> | undefined;
  const cerrar = () => {
    clearInterval(temporizadorRespaldo);
    servidor?.close();
    bd.cerrar();
    process.exit(0);
  };

  app.use('/api', crearApi(bd, { alApagar: cerrar }));

  // Si el programa queda abierto varios días, igual se hace el respaldo de cada día
  const temporizadorRespaldo = setInterval(() => {
    try {
      bd.respaldoDiario();
    } catch (err) {
      console.error('[VetCompras] No se pudo crear el respaldo diario:', err);
    }
  }, 60 * 60 * 1000);

  if (modoDesarrollo) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(__dirname, 'dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error('No existe la carpeta "dist". Ejecute primero "npm run build" (o instalar.bat).');
    }
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  servidor = app.listen(PUERTO, HOST, () => {
    const url = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PUERTO}`;
    console.log(`[VetCompras] Listo. Abra ${url} en el navegador.`);
    if (HOST === '0.0.0.0') console.log('[VetCompras] Compartido en la red local (use la IP de este PC).');
  });

  servidor.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[VetCompras] El puerto ${PUERTO} ya está en uso: probablemente VetCompras ya está abierto.`);
    } else {
      console.error('[VetCompras] Error del servidor:', err);
    }
    bd.cerrar();
    process.exit(1);
  });
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

iniciar().catch((err) => {
  console.error('[VetCompras] No fue posible iniciar:', err?.message || err);
  process.exit(1);
});
