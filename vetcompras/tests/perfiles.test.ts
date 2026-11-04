import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { BaseDatosLocal } from '../server/basedatos';
import { crearApi } from '../server/api';
import { ID_ADMINISTRACION, MODULOS_SISTEMA, PERFILES_DEFECTO, migrarPerfiles, modulosDe, moduloInicial, normalizarPerfiles } from '../src/utils/perfiles';

describe('reglas de perfiles', () => {
  it('los perfiles de fábrica separan ventas, compras y administración', () => {
    const [ventas, compras, admin] = PERFILES_DEFECTO;
    expect([...modulosDe(ventas)]).toEqual(['panel_ventas', 'ventas', 'precios', 'reportes_ventas', 'catalogos']);
    expect(modulosDe(ventas).has('compras')).toBe(false);
    expect(modulosDe(compras).has('compras') && modulosDe(compras).has('inventario') && !modulosDe(compras).has('ventas')).toBe(true);
    expect(modulosDe(admin).size).toBe(MODULOS_SISTEMA.length);
    expect(moduloInicial(ventas)).toBe('panel_ventas');
    expect(moduloInicial(compras)).toBe('panel_compras');
    expect(moduloInicial(admin)).toBe('dashboard');
  });

  it('Administración siempre conserva todos los módulos y no se puede eliminar', () => {
    expect(modulosDe({ id: ID_ADMINISTRACION, modulos: [] }).size).toBe(MODULOS_SISTEMA.length);
    expect(() => normalizarPerfiles([PERFILES_DEFECTO[0]])).toThrow(/Administración/);
    expect(() => normalizarPerfiles([{ nombre: 'Caja', modulos: [] }, PERFILES_DEFECTO[2]])).toThrow(/al menos un módulo/);
    expect(() => normalizarPerfiles([])).toThrow();
  });

  it('los perfiles guardados en la 2.11 reciben su panel al actualizar', () => {
    const viejos = [
      { id: 'ventas', modulos: ['ventas', 'precios'] },
      { id: 'compras', modulos: ['compras', 'inventario'] },
      { id: 'caja', modulos: ['catalogos'] },
    ];
    expect(migrarPerfiles(viejos).map((p) => p.modulos)).toEqual([
      ['panel_ventas', 'ventas', 'precios', 'reportes_ventas'],
      ['panel_compras', 'compras', 'inventario', 'reportes_compras'],
      ['catalogos'],
    ]);
    // Guardados en la 2.12 (versión 2): solo reciben los reportes
    expect(migrarPerfiles([{ modulos: ['panel_ventas', 'ventas'] }], 2)[0].modulos).toEqual(['panel_ventas', 'ventas', 'reportes_ventas']);
    expect(migrarPerfiles(viejos, 3)).toBe(viejos);
  });

  it('crea el identificador desde el nombre y descarta módulos desconocidos', () => {
    const r = normalizarPerfiles([{ nombre: 'Peluquería & Baños', modulos: ['ventas', 'nada'] }, PERFILES_DEFECTO[2]]);
    expect(r[0]).toMatchObject({ id: 'peluqueria_banos', modulos: ['ventas'] });
  });
});

describe('perfiles en el servidor local', () => {
  let carpeta: string;
  let bd: BaseDatosLocal;
  let servidor: Server;
  let base: string;
  let cookie = '';
  const llamar = async (ruta: string, metodo = 'GET', cuerpo?: unknown) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-VetCompras': '1', ...(cookie ? { Cookie: cookie } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const c = r.headers.get('set-cookie');
    if (c) cookie = c.split(';')[0];
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
  };

  beforeEach(async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'vetcompras-perfiles-'));
    bd = new BaseDatosLocal(carpeta);
    const app = express();
    app.use(express.json());
    app.use('/api', crearApi(bd, { licencia: { exigir: false } }));
    servidor = app.listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
    cookie = '';
  });
  afterEach(() => {
    servidor.close();
    bd.cerrar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  it('exige haber ingresado, entrega los tres perfiles y registra el ingreso en la bitácora', async () => {
    expect((await llamar('/perfiles')).status).toBe(401);
    await llamar('/sesion/ingresar-libre', 'POST', {});
    const lista = await llamar('/perfiles');
    expect(lista.cuerpo.map((p: any) => p.nombre)).toEqual(['Ventas', 'Compras y Gastos', 'Administración']);
    const r = await llamar('/perfiles/entrar', 'POST', { id: 'ventas' });
    expect(r.cuerpo).toMatchObject({ id: 'ventas', tienePin: false });
    expect(bd.listarAuditoria(300, 'perfil Ventas').length).toBe(1);
  });

  it('Administración edita módulos y PIN; el PIN se guarda cifrado y se exige al entrar', async () => {
    await llamar('/sesion/ingresar-libre', 'POST', {});
    const perfiles = (await llamar('/perfiles')).cuerpo;
    perfiles[0].modulos = ['ventas', 'catalogos', 'inventario'];
    perfiles[2].pin = '2468';
    const guardado = await llamar('/perfiles', 'PUT', { perfiles });
    expect(guardado.status).toBe(200);
    expect(guardado.cuerpo[0].modulos).toEqual(['ventas', 'catalogos', 'inventario']);
    expect(guardado.cuerpo[2]).toMatchObject({ tienePin: true });
    expect(JSON.stringify(guardado.cuerpo)).not.toContain('2468');
    expect(JSON.stringify(bd.obtenerConfig('perfilesAcceso'))).not.toContain('2468');

    expect((await llamar('/perfiles/entrar', 'POST', { id: ID_ADMINISTRACION, pin: '1111' })).status).toBe(401);
    expect((await llamar('/perfiles/entrar', 'POST', { id: ID_ADMINISTRACION, pin: '2468' })).status).toBe(200);

    // Guardar sin escribir PIN lo conserva; quitarPin lo elimina
    const otra = await llamar('/perfiles', 'PUT', { perfiles: guardado.cuerpo });
    expect(otra.cuerpo[2].tienePin).toBe(true);
    const sinPin = await llamar('/perfiles', 'PUT', { perfiles: otra.cuerpo.map((p: any, i: number) => (i === 2 ? { ...p, quitarPin: true } : p)) });
    expect(sinPin.cuerpo[2].tienePin).toBe(false);
  });

  it('un perfil guardado antes de los paneles (2.11) los recibe al leerlo', async () => {
    bd.guardarConfig('perfilesAcceso', { perfiles: [{ id: 'ventas', nombre: 'Ventas', descripcion: '', modulos: ['ventas'] }, { ...PERFILES_DEFECTO[2] }] });
    await llamar('/sesion/ingresar-libre', 'POST', {});
    expect((await llamar('/perfiles')).cuerpo[0].modulos).toEqual(['panel_ventas', 'ventas', 'reportes_ventas']);
  });

  it('rechaza PIN no numérico y quitar Administración', async () => {
    await llamar('/sesion/ingresar-libre', 'POST', {});
    const perfiles = (await llamar('/perfiles')).cuerpo;
    expect((await llamar('/perfiles', 'PUT', { perfiles: perfiles.map((p: any, i: number) => (i === 0 ? { ...p, pin: '12ab' } : p)) })).status).toBe(400);
    expect((await llamar('/perfiles', 'PUT', { perfiles: perfiles.slice(0, 2) })).status).toBe(400);
  });
});
