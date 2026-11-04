import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { BaseDatosLocal } from '../server/basedatos';
import { crearApi } from '../server/api';
import { codigoEquipo, firmarLicencia, verificarLicencia, type DatosLicencia } from '../server/licencia';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUBLICA = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const EQUIPO = codigoEquipo('win:prueba-1234');
const datos = (extra: Partial<DatosLicencia> = {}): DatosLicencia => ({ v: 1, p: 'sistema-control-2', c: 'Ferretería La 14', d: '900123456', e: EQUIPO, ed: 'Estándar', f: '2026-11-04', n: 'L-0001', ...extra });

describe('licencia por equipo', () => {
  it('el código de equipo es estable y legible', () => {
    expect(EQUIPO).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(codigoEquipo('win:prueba-1234')).toBe(EQUIPO);
    expect(codigoEquipo('win:otro-equipo')).not.toBe(EQUIPO);
  });

  it('acepta una clave firmada para este equipo', () => {
    const e = verificarLicencia(firmarLicencia(datos(), privateKey), EQUIPO, new Date('2026-11-05'), PUBLICA);
    expect(e).toMatchObject({ activa: true, cliente: 'Ferretería La 14', documento: '900123456', numero: 'L-0001' });
  });

  it('rechaza la clave en otro equipo, vencida, alterada o firmada por otra llave', () => {
    const clave = firmarLicencia(datos(), privateKey);
    expect(verificarLicencia(clave, codigoEquipo('win:otro'), new Date(), PUBLICA).motivo).toMatch(/otro equipo/);
    const vencida = firmarLicencia(datos({ x: '2026-12-31' }), privateKey);
    expect(verificarLicencia(vencida, EQUIPO, new Date('2026-12-31T12:00:00'), PUBLICA).activa).toBe(true);
    expect(verificarLicencia(vencida, EQUIPO, new Date('2027-01-01T08:00:00'), PUBLICA).motivo).toMatch(/venció/);
    // Cambiar el cliente sin volver a firmar invalida la firma
    const [cuerpo, firma] = clave.slice(4).split('.');
    const alterado = Buffer.from(JSON.stringify({ ...datos(), c: 'Pirata' })).toString('base64url');
    expect(verificarLicencia(`SC2-${alterado}.${firma}`, EQUIPO, new Date(), PUBLICA).motivo).toMatch(/firma/);
    expect(cuerpo).toBeTruthy();
    const otraLlave = crypto.generateKeyPairSync('ed25519').privateKey;
    expect(verificarLicencia(firmarLicencia(datos(), otraLlave), EQUIPO, new Date(), PUBLICA).motivo).toMatch(/firma/);
    expect(verificarLicencia(firmarLicencia(datos({ p: 'otro' }), privateKey), EQUIPO, new Date(), PUBLICA).motivo).toMatch(/otro producto/);
    expect(verificarLicencia('hola', EQUIPO, new Date(), PUBLICA).motivo).toMatch(/SC2-/);
    expect(verificarLicencia(undefined, EQUIPO).activa).toBe(false);
  });
});

describe('licencia en el servidor local', () => {
  let carpeta: string;
  let bd: BaseDatosLocal;
  let servidor: Server;
  let base: string;
  const iniciar = async () => {
    bd = new BaseDatosLocal(carpeta);
    const app = express();
    app.use(express.json());
    app.use('/api', crearApi(bd, { licencia: { equipo: EQUIPO, clavePublica: PUBLICA } }));
    servidor = app.listen(0);
    await new Promise((r) => servidor.once('listening', r));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
  };
  const detener = () => {
    servidor.close();
    bd.cerrar();
  };
  beforeEach(async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-licencia-'));
    await iniciar();
  });
  afterEach(() => {
    detener();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });
  const post = (clave: string, cabecera = true) =>
    fetch(base + '/licencia', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cabecera ? { 'X-VetCompras': '1' } : {}) }, body: JSON.stringify({ clave }) });

  it('sin licencia bloquea todo salvo la consulta y la activación; la activación queda en archivo aparte', async () => {
    const estado = await (await fetch(base + '/licencia')).json();
    expect(estado).toMatchObject({ activa: false, equipo: EQUIPO, exigida: true });
    const bloqueada = await fetch(base + '/sesion');
    expect(bloqueada.status).toBe(402);
    expect((await bloqueada.json()).codigo).toBe('LICENCIA');

    expect((await post(firmarLicencia(datos(), privateKey), false)).status).toBe(403);
    const otroEquipo = await post(firmarLicencia(datos({ e: codigoEquipo('win:otro') }), privateKey));
    expect(otroEquipo.status).toBe(400);
    expect((await otroEquipo.json()).error).toMatch(/otro equipo/);

    const ok = await post(firmarLicencia(datos(), privateKey));
    expect(ok.status).toBe(200);
    expect((await ok.json()).activa).toBe(true);
    expect((await fetch(base + '/sesion')).status).toBe(200);
    expect(fs.existsSync(path.join(carpeta, 'licencia.lic'))).toBe(true);

    // Sigue activa tras reiniciar el programa
    detener();
    await iniciar();
    expect((await (await fetch(base + '/licencia')).json()).activa).toBe(true);
  });
});
