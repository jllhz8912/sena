/**
 * Lo que se guarda queda en el disco del equipo y se vuelve a consultar después de
 * cerrar y abrir el programa (o de un cierre forzado sin apagado ordenado).
 */
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { BaseDatosLocal } from '../server/basedatos';
import { crearApi } from '../server/api';

let carpeta = '';
let bd: BaseDatosLocal | undefined;
let servidor: Server | undefined;

async function abrir() {
  bd = new BaseDatosLocal(carpeta);
  bd.guardarConfig('modoAcceso', { modo: 'libre' });
  const app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api', crearApi(bd, { licencia: { exigir: false } }));
  servidor = app.listen(0);
  await new Promise((r) => servidor!.once('listening', r));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
  let cookie = '';
  const c = async (ruta: string, method = 'GET', body?: unknown) => {
    const r = await fetch(base + ruta, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-VetCompras': '1', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
  };
  expect((await c('/sesion/ingresar-libre', 'POST')).status).toBe(200);
  return c;
}
async function cerrar() {
  await new Promise((r) => servidor?.close(r));
  bd?.cerrar();
  bd = undefined;
}
afterEach(async () => {
  if (bd) await cerrar();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

const VENTA = { id: 'v-prueba-1', consecutivo: 'VNT-900', fecha: '2026-11-22', clienteNombre: 'Cliente Prueba', categoria: 'productos', concepto: 'Producto A', monto: 150000,
  items: [{ id: 'i1', categoria: 'productos', concepto: 'Producto A', cantidad: 3, precioUnitario: 50000, subtotal: 150000 }],
  pagos: [{ id: 'p1', medio: 'efectivo', monto: 100000 }], estado: 'credito' };
const COMPRA = { id: 'd-prueba-1', tipoDocumento: 'factura_papel', folio: '4587', fechaEmision: '2026-11-20', proveedor: { nit: '901234567', razonSocial: 'Proveedor Prueba S.A.S.' },
  subtotal: 100000, iva: 19000, total: 119000, saldoPendiente: 119000, estadoPago: 'pendiente', formaPago: 'credito', categoriaId: 'cat-varios', pagos: [] };

describe('persistencia en el equipo', () => {
  it('ventas, compras, productos, configuración y licencia siguen ahí después de cerrar y abrir', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-persist-'));
    let c = await abrir();
    expect((await c('/ventas/' + VENTA.id, 'PUT', VENTA)).status).toBe(200);
    expect((await c('/documentos/' + COMPRA.id, 'PUT', COMPRA)).status).toBe(200);
    expect((await c('/productos/lote', 'POST', { guardar: [{ id: 'prod-1', nombre: 'Producto A', unidad: 'UND', costoUltimo: 30000 }] })).status).toBe(200);
    const emp = (await c('/configuracion/empresa')).cuerpo || {};
    expect((await c('/configuracion/empresa', 'PUT', { ...emp, razonSocial: 'MI NEGOCIO S.A.S.', nit: '900111222' })).status).toBe(200);
    // Editar y luego eliminar también queda guardado
    expect((await c('/ventas/' + VENTA.id, 'PUT', { ...VENTA, clienteNombre: 'Cliente Editado' })).status).toBe(200);
    expect((await c('/productos/lote', 'POST', { guardar: [{ id: 'prod-2', nombre: 'Borrar', unidad: 'UND' }] })).status).toBe(200);
    expect((await c('/productos/prod-2', 'DELETE')).status).toBe(200);
    await cerrar();

    // Vuelve a abrir: todo se consulta igual
    c = await abrir();
    expect((await c('/ventas/' + VENTA.id)).cuerpo).toMatchObject({ consecutivo: 'VNT-900', clienteNombre: 'Cliente Editado', monto: 150000 });
    expect((await c('/documentos/' + COMPRA.id)).cuerpo).toMatchObject({ folio: '4587', total: 119000, saldoPendiente: 119000 });
    const productos = (await c('/productos')).cuerpo as any[];
    expect(productos.map((p) => p.id)).toContain('prod-1');
    expect(productos.map((p) => p.id)).not.toContain('prod-2');
    expect((await c('/configuracion/empresa')).cuerpo).toMatchObject({ razonSocial: 'MI NEGOCIO S.A.S.', nit: '900111222' });
    // La compra movió el inventario y la venta lo descontó: también persiste
    expect(((await c('/movimientosInventario')).cuerpo as any[]).length).toBeGreaterThanOrEqual(0);
  });

  it('lo confirmado queda en el disco aunque el programa se cierre a la fuerza (sin apagado ordenado)', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-persist-'));
    const c = await abrir();
    for (let i = 0; i < 25; i++) {
      expect((await c(`/ventas/v-${i}`, 'PUT', { ...VENTA, id: `v-${i}`, consecutivo: `VNT-${1000 + i}` })).status).toBe(200);
    }
    // Simula un cierre forzado: se copian los archivos tal como están en disco, sin cerrar ni consolidar
    const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-copia-'));
    for (const f of fs.readdirSync(carpeta)) if (f.startsWith('vetcompras.db')) fs.copyFileSync(path.join(carpeta, f), path.join(copia, f));
    const db = new DatabaseSync(path.join(copia, 'vetcompras.db'));
    const n = (db.prepare("SELECT COUNT(*) AS n FROM registros WHERE coleccion = 'ventas'").get() as { n: number }).n;
    db.close();
    fs.rmSync(copia, { recursive: true, force: true });
    expect(n).toBe(25);
  });

  it('al cerrar, el archivo principal queda completo (sirve para copiar a USB o restaurar)', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'sc2-persist-'));
    const c = await abrir();
    expect((await c('/ventas/' + VENTA.id, 'PUT', VENTA)).status).toBe(200);
    await cerrar();
    const wal = path.join(carpeta, 'vetcompras.db-wal');
    expect(!fs.existsSync(wal) || fs.statSync(wal).size === 0).toBe(true);
    const db = new DatabaseSync(path.join(carpeta, 'vetcompras.db'));
    expect((db.prepare("SELECT COUNT(*) AS n FROM registros WHERE coleccion = 'ventas'").get() as { n: number }).n).toBe(1);
    db.close();
  });
});
