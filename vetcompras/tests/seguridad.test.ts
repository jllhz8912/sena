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
  // Las pruebas de contraseñas usan el modo con usuarios; el modo libre se prueba aparte
  bd.guardarConfig('modoAcceso', { modo: 'usuarios' });
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

describe('copias de seguridad y observaciones', () => {
  it('registra la última copia y permite configurar el recordatorio', async () => {
    const admin = await configurarAdmin();
    let estado = (await admin('/respaldos/estado')).cuerpo;
    expect(estado.ultima).toBeNull();
    expect(estado.diasRecordatorio).toBe(7);

    await admin('/respaldos', { method: 'POST' });
    estado = (await admin('/respaldos/estado')).cuerpo;
    expect(estado.ultima.medio).toBe('copia manual');
    expect(estado.diasSinCopia).toBe(0);

    expect((await admin('/respaldos/politica', { method: 'PUT', body: { diasRecordatorio: 3 } })).cuerpo.diasRecordatorio).toBe(3);
    expect((await admin('/respaldos/politica', { method: 'PUT', body: { diasRecordatorio: 0 } })).status).toBe(400);
  });

  it('carga un archivo .db válido y rechaza archivos que no son copias', async () => {
    const admin = await configurarAdmin();
    const { cuerpo } = await admin('/respaldos', { method: 'POST' });
    const contenido = fs.readFileSync(cuerpo.ruta);
    const subir = async (datos: Buffer) => {
      // Inicia sesión con fetch directo para enviar binario
      const ingreso = await fetch(base + '/api/sesion/ingresar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-VetCompras': '1' },
        body: JSON.stringify({ usuario: 'admin', clave: 'Clinica2026' }),
      });
      const galleta = ingreso.headers.get('set-cookie')!.split(';')[0];
      const r = await fetch(base + '/api/respaldos/cargar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-VetCompras': '1', Cookie: galleta },
        body: new Uint8Array(datos),
      });
      return { status: r.status, cuerpo: await r.json() };
    };

    const valido = await subir(contenido);
    expect(valido.status).toBe(200);
    expect(valido.cuerpo.nombre).toMatch(/cargado\.db$/);
    expect(bd.listarRespaldos().some((r) => r.nombre === valido.cuerpo.nombre)).toBe(true);

    const invalido = await subir(Buffer.from('esto no es una base de datos de VetCompras'.repeat(10)));
    expect(invalido.status).toBe(400);
    expect(bd.listarRespaldos().filter((r) => r.nombre.includes('cargado'))).toHaveLength(1);
  });

  it('el auxiliar deja observaciones pero no las borra', async () => {
    const admin = await configurarAdmin();
    await admin('/usuarios', { method: 'POST', body: { usuario: 'aux', nombre: 'Aux', rol: 'auxiliar', clave: 'Temporal123' } });
    const aux = cliente();
    await aux('/sesion/ingresar', { method: 'POST', body: { usuario: 'aux', clave: 'Temporal123' } });
    await aux('/sesion/cambiar-clave', { method: 'POST', body: { claveActual: 'Temporal123', claveNueva: 'MiClave456' } });

    const obs = { id: 'o1', fecha: new Date().toISOString(), usuario: 'Aux', modulo: 'Ventas', tipo: 'error', descripcion: 'Falla X', estado: 'nueva' };
    expect((await aux('/observaciones/o1', { method: 'PUT', body: obs })).status).toBe(200);
    expect((await admin('/observaciones')).cuerpo).toHaveLength(1);
    expect((await aux('/observaciones/o1', { method: 'DELETE' })).status).toBe(403);
  });
});


describe('ingreso sin contraseña (pantalla de inicio)', () => {
  beforeEach(() => bd.guardarConfig('modoAcceso', { modo: 'libre' }));

  it('el botón Ingresar abre una sesión de administrador sin pedir datos', async () => {
    const c = cliente();
    const r0 = await c('/sesion');
    expect(r0.cuerpo.modoAcceso).toBe('libre');
    expect(r0.cuerpo.requiereConfiguracion).toBe(false);
    expect(r0.cuerpo.marca.nombre).toBe('Los Criollos Vet');
    expect((await c('/documentos')).status).toBe(401);

    const r = await c('/sesion/ingresar-libre', { method: 'POST' });
    expect(r.status).toBe(200);
    expect(r.cuerpo.usuario.rol).toBe('administrador');
    expect((await c('/documentos')).status).toBe(200);
    // Queda en la bitácora
    const bitacora = await c('/auditoria');
    expect(JSON.stringify(bitacora.cuerpo)).toContain('sin contraseña');
  });

  it('exige la cabecera anti-CSRF', async () => {
    const r = await cliente()('/sesion/ingresar-libre', { method: 'POST', sinCabecera: true });
    expect(r.status).toBe(403);
  });

  it('la marca de la pantalla de inicio usa los datos de la veterinaria', async () => {
    bd.guardarConfig('empresa', { razonSocial: 'Clínica Patitas SAS', nombreComercial: 'Patitas', slogan: 'Amor animal', logoUrl: 'data:image/png;base64,AAA' });
    const r = await cliente()('/sesion');
    expect(r.cuerpo.marca).toMatchObject({ nombre: 'Patitas', slogan: 'Amor animal', logoUrl: 'data:image/png;base64,AAA' });
  });

  it('se puede activar la contraseña y volver al ingreso libre', async () => {
    const c = cliente();
    await c('/sesion/ingresar-libre', { method: 'POST' });
    const debil = await c('/configuracion/acceso', { method: 'PUT', body: { modo: 'usuarios', usuario: 'dueno', clave: 'corta' } });
    expect(debil.status).toBe(400);
    const r = await c('/configuracion/acceso', { method: 'PUT', body: { modo: 'usuarios', usuario: 'dueno', clave: 'Patitas2026' } });
    expect(r.cuerpo.modoAcceso).toBe('usuarios');

    // Con contraseña activada el botón ya no sirve, pero el usuario y clave sí
    const otro = cliente();
    expect((await otro('/sesion/ingresar-libre', { method: 'POST' })).status).toBe(403);
    expect((await otro('/sesion/ingresar', { method: 'POST', body: { usuario: 'dueno', clave: 'Patitas2026' } })).status).toBe(200);

    expect((await otro('/configuracion/acceso', { method: 'PUT', body: { modo: 'libre' } })).cuerpo.modoAcceso).toBe('libre');
    expect((await cliente()('/sesion/ingresar-libre', { method: 'POST' })).status).toBe(200);
  });

  it('un auxiliar no puede quitar la contraseña', async () => {
    bd.guardarConfig('modoAcceso', { modo: 'usuarios' });
    const admin = await configurarAdmin();
    await admin('/usuarios', { method: 'POST', body: { usuario: 'aux', nombre: 'Aux', rol: 'auxiliar', clave: 'Temporal2026' } });
    const aux = cliente();
    await aux('/sesion/ingresar', { method: 'POST', body: { usuario: 'aux', clave: 'Temporal2026' } });
    await aux('/sesion/cambiar-clave', { method: 'POST', body: { claveActual: 'Temporal2026', claveNueva: 'Propia2026x' } });
    expect((await aux('/configuracion/acceso', { method: 'PUT', body: { modo: 'libre' } })).status).toBe(403);
  });
});

describe('borrar todo', () => {
  it('exige la palabra BORRAR, deja copia y conserva la veterinaria y los respaldos', async () => {
    const admin = await configurarAdmin();
    await admin('/documentos/d1', { method: 'PUT', body: { id: 'd1', total: 1000 } });
    await admin('/ventas/v1', { method: 'PUT', body: { id: 'v1', monto: 500 } });
    await admin('/proveedores/p1', { method: 'PUT', body: { id: 'p1', razonSocial: 'X' } });

    expect((await admin('/mantenimiento/borrar-todo', { method: 'POST', body: {} })).status).toBe(400);
    expect(bd.listar('documentos')).toHaveLength(1);

    const r = await admin('/mantenimiento/borrar-todo', { method: 'POST', body: { confirmacion: 'BORRAR' } });
    expect(r.status).toBe(200);
    expect(bd.listar('documentos')).toHaveLength(0);
    expect(bd.listar('ventas')).toHaveLength(0);
    expect(bd.listar('proveedores')).toHaveLength(0);
    expect(bd.listar('categorias').length).toBeGreaterThan(0);
    expect(bd.obtenerConfig<any>('empresa').razonSocial).toBe('Vet Prueba');
    expect(bd.listarRespaldos().some((x) => x.nombre.includes('antes-de-borrar-todo'))).toBe(true);
  });

  it('un auxiliar no puede borrar todo', async () => {
    const admin = await configurarAdmin();
    await admin('/usuarios', { method: 'POST', body: { usuario: 'aux', nombre: 'Aux', rol: 'auxiliar', clave: 'Temporal2026' } });
    const aux = cliente();
    await aux('/sesion/ingresar', { method: 'POST', body: { usuario: 'aux', clave: 'Temporal2026' } });
    await aux('/sesion/cambiar-clave', { method: 'POST', body: { claveActual: 'Temporal2026', claveNueva: 'Propia2026x' } });
    expect((await aux('/mantenimiento/borrar-todo', { method: 'POST', body: { confirmacion: 'BORRAR' } })).status).toBe(403);
  });
});
