import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { BaseDatosLocal } from '../server/basedatos';
import { crearApi } from '../server/api';
import { alertaCopiaPendiente, estadoAlertaCopia } from '../src/utils/alertaCopia';

describe('regla de la alerta semanal', () => {
  const ahora = new Date('2026-11-09T10:00:00Z');
  it('aparece si nunca se ha aceptado o si pasaron 7 días o más', () => {
    expect(alertaCopiaPendiente(null, ahora)).toBe(true);
    expect(alertaCopiaPendiente('fecha dañada', ahora)).toBe(true);
    expect(alertaCopiaPendiente('2026-11-02T10:00:00Z', ahora)).toBe(true);
    expect(alertaCopiaPendiente('2026-11-02T10:00:01Z', ahora)).toBe(false);
    expect(alertaCopiaPendiente('2026-11-08T08:00:00Z', ahora)).toBe(false);
  });
  it('informa los días sin copia de seguridad', () => {
    expect(estadoAlertaCopia('2026-11-08T08:00:00Z', { fecha: '2026-10-30T10:00:00Z' }, ahora)).toEqual({
      pendiente: false,
      ultimaAceptacion: '2026-11-08T08:00:00Z',
      ultimaCopia: '2026-10-30T10:00:00Z',
      diasSinCopia: 10,
    });
    expect(estadoAlertaCopia(null, null, ahora).diasSinCopia).toBeNull();
  });
});

describe('alerta semanal en el servidor local', () => {
  let carpeta: string;
  let bd: BaseDatosLocal;
  let servidor: Server;
  let base: string;

  beforeEach(async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'vetcompras-alerta-'));
    bd = new BaseDatosLocal(carpeta);
    const app = express();
    app.use(express.json());
    app.use('/api', crearApi(bd));
    servidor = app.listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
  });
  afterEach(() => {
    servidor.close();
    bd.cerrar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  it('se consulta y se acepta sin haber ingresado (bloquea la pantalla de inicio) y queda en la bitácora', async () => {
    const antes = await (await fetch(base + '/alerta-copia')).json();
    expect(antes.pendiente).toBe(true);

    const sinCabecera = await fetch(base + '/alerta-copia/aceptar', { method: 'POST' });
    expect(sinCabecera.status).toBe(403);

    const r = await fetch(base + '/alerta-copia/aceptar', { method: 'POST', headers: { 'X-VetCompras': '1' } });
    expect(r.status).toBe(200);
    expect((await r.json()).pendiente).toBe(false);
    expect((await (await fetch(base + '/alerta-copia')).json()).pendiente).toBe(false);
    expect(bd.listarAuditoria(300, 'Alerta semanal').length).toBe(1);
  });

  it('vuelve a aparecer a los 7 días', async () => {
    bd.guardarConfig('alertaCopiaSemanal', { fecha: new Date(Date.now() - 7 * 86400000 - 1000).toISOString() });
    expect((await (await fetch(base + '/alerta-copia')).json()).pendiente).toBe(true);
  });
});
