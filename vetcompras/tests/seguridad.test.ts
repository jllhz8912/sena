import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { BaseDatosLocal, VERSION_ESQUEMA } from '../server/basedatos';
import { crearApi } from '../server/api';
import { cifrarClave, verificarClave } from '../server/seguridad';

let carpeta: string;
let bd: BaseDatosLocal;
let servidor: Server;
let base: string;

/** Cliente HTTP mínimo que conserva la cookie de sesión, como un navegador. */
function cliente() {
  let cookie = '';
  return async (ruta: string, opciones: { method?: string; body?: unknown; sinCabecera?: boolean } = {}) => {
    const r = await fetch(base + '/api' + ruta, {
      method: opciones.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opciones.sinCabecera ? {} : { 'X-VetCompras': '1' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
    });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
  };
}

beforeEach(async () => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'vetcompras-seg-'));
  bd = new BaseDatosLocal(carpeta);
  const app = express();
  app.use(express.json());
  app.use('/api', crearApi(bd));
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(() => {
  servidor.close();
  bd.cerrar();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

async function configurarAdmin() {
  const admin = cliente();
  const r = await admin('/sesion/configuracion-inicial', {
    method: 'POST',
    body: { usuario: 'admin', nombre: 'Dra. Admin', clave: 'Clinica2026', empresa: { razonSocial: 'Vet Prueba' } },
  });
  expect(r.status).toBe(200);
  return admin;
}

describe('contraseñas', () => {
  it('se guardan cifradas y se verifican', () => {
    const hash = cifrarClave('Clinica2026');
    expect(hash).not.toContain('Clinica2026');
    expect(verificarClave('Clinica2026', hash)).toBe(true);
    expect(verificarClave('clinica2026', hash)).toBe(false);
  });
});

describe('acceso a la API', () => {
  it('sin sesión no se puede leer ni escribir información', async () => {
    const anonimo = cliente();
    await configurarAdmin();
    expect((await anonimo('/documentos')).status).toBe(401);
    expect((await anonimo('/ventas/v1', { method: 'PUT', body: { id: 'v1' } })).status).toBe(401);
  });

  it('el primer uso crea el administrador una sola vez', async () => {
    const r0 = await cliente()('/sesion');
    expect(r0.cuerpo.requiereConfiguracion).toBe(true);
    await configurarAdmin();
    const otro = await cliente()('/sesion/configuracion-inicial', {
      method: 'POST',
      body: { usuario: 'intruso', nombre: 'X', clave: 'Clave12345' },
    });
    expect(otro.status).toBe(409);
    expect(bd.obtenerConfig<any>('empresa').razonSocial).toBe('Vet Prueba');
  });

  it('rechaza cambios sin la cabecera propia (protección CSRF)', async () => {
    const admin = await configurarAdmin();
    const r = await admin('/ventas/v1', { method: 'PUT', body: { id: 'v1' }, sinCabecera: true });
    expect(r.status).toBe(403);
  });

  it('bloquea temporalmente tras varios intentos fallidos', async () => {
    await configurarAdmin();
    const c = cliente();
    for (let i = 0; i < 5; i++) {
      expect((await c('/sesion/ingresar', { method: 'POST', body: { usuario: 'admin', clave: 'mala1234' } })).status).toBe(401);
    }
    const bloqueado = await c('/sesion/ingresar', { method: 'POST', body: { usuario: 'admin', clave: 'Clinica2026' } });
    expect(bloqueado.status).toBe(429);
  });
});

describe('roles y auditoría', () => {
  it('el auxiliar registra pero no borra ni configura, y todo queda en la bitácora', async () => {
    const admin = await configurarAdmin();
    expect(
      (await admin('/usuarios', { method: 'POST', body: { usuario: 'aux', nombre: 'Auxiliar', rol: 'auxiliar', clave: 'Temporal123' } })).status
    ).toBe(200);

    const aux = cliente();
    const ingreso = await aux('/sesion/ingresar', { method: 'POST', body: { usuario: 'aux', clave: 'Temporal123' } });
    expect(ingreso.cuerpo.usuario.debeCambiarClave).toBe(true);
    // Con contraseña temporal no puede trabajar hasta cambiarla
    expect((await aux('/documentos')).status).toBe(403);
    expect(
      (await aux('/sesion/cambiar-clave', { method: 'POST', body: { claveActual: 'Temporal123', claveNueva: 'MiClave456' } })).status
    ).toBe(200);

    expect((await aux('/documentos/d1', { method: 'PUT', body: { id: 'd1', folio: '1', total: 1000 } })).status).toBe(200);
    expect((await aux('/documentos/d1', { method: 'DELETE' })).status).toBe(403);
    expect((await aux('/documentos/lote', { method: 'POST', body: { eliminar: ['d1'] } })).status).toBe(403);
    expect((await aux('/configuracion/empresa', { method: 'PUT', body: { razonSocial: 'X' } })).status).toBe(403);
    expect((await aux('/categorias/c1', { method: 'PUT', body: { id: 'c1', nombre: 'X' } })).status).toBe(403);
    expect((await aux('/mantenimiento/limpiar-documentos', { method: 'POST' })).status).toBe(403);
    expect((await aux('/usuarios')).status).toBe(403);

    expect((await admin('/documentos/d1', { method: 'DELETE' })).status).toBe(200);

    const bitacora = (await admin('/auditoria')).cuerpo as { usuario: string; accion: string }[];
    const acciones = bitacora.map((e) => `${e.usuario}: ${e.accion}`);
    expect(acciones).toContain('aux: Creó compra/gasto');
    expect(acciones).toContain('admin: Eliminó compra/gasto');
    expect(acciones).toContain('admin: Usuario creado');
  });

  it('no permite dejar el sistema sin administrador activo', async () => {
    const admin = await configurarAdmin();
    const [yo] = (await admin('/usuarios')).cuerpo;
    expect((await admin(`/usuarios/${yo.id}`, { method: 'PUT', body: { activo: false } })).status).toBe(400);
  });
});

describe('respaldos', () => {
  it('restaura un respaldo y guarda antes el estado actual', async () => {
    const admin = await configurarAdmin();
    await admin('/ventas/v1', { method: 'PUT', body: { id: 'v1', monto: 100 } });
    const { cuerpo } = await admin('/respaldos', { method: 'POST' });
    const nombre = path.basename(cuerpo.ruta);

    await admin('/ventas/v2', { method: 'PUT', body: { id: 'v2', monto: 200 } });
    const r = await admin(`/respaldos/${nombre}/restaurar`, { method: 'POST' });
    expect(r.status).toBe(200);
    expect(bd.listar('ventas').map((v) => v.id)).toEqual(['v1']);
    expect(bd.listarRespaldos().some((x) => x.nombre.includes('antes-de-restaurar'))).toBe(true);
  });

  it('no acepta nombres de archivo fuera de la carpeta de respaldos', async () => {
    const admin = await configurarAdmin();
    const r = await admin(`/respaldos/${encodeURIComponent('..%2Fvetcompras.db')}/restaurar`, { method: 'POST' });
    expect(r.status).toBe(400);
  });

  it('copia cada respaldo a la carpeta externa configurada', async () => {
    const admin = await configurarAdmin();
    const externa = path.join(carpeta, 'usb');
    const r = await admin('/respaldos/externo', { method: 'PUT', body: { carpeta: externa } });
    expect(r.cuerpo.ultimoRespaldoExterno.ok).toBe(true);
    expect(fs.readdirSync(externa).some((f) => f.endsWith('.db'))).toBe(true);
  });
});

describe('actualización del programa', () => {
  it('migra una base de la versión 1 a la 2 sin perder información', () => {
    bd.guardar('ventas', { id: 'v-antigua', monto: 123 });
    // Simular una base creada por la versión anterior del programa
    bd.db.exec('DROP TABLE sesiones; DROP TABLE usuarios; DROP TABLE auditoria; PRAGMA user_version = 1;');
    bd.cerrar();

    bd = new BaseDatosLocal(carpeta);
    expect(bd.versionEsquema()).toBe(VERSION_ESQUEMA);
    expect(bd.obtener('ventas', 'v-antigua')).toMatchObject({ monto: 123 });
    expect(bd.listarRespaldos().some((r) => r.nombre.includes('antes-de-actualizar-v1-a-v'))).toBe(true);
  });
});
