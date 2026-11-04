import { EMPRESA_DEFECTO } from '../src/data/defaults';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BaseDatosLocal, VERSION_ESQUEMA } from '../server/basedatos';

let carpeta: string;
let bd: BaseDatosLocal;

beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'vetcompras-test-'));
  bd = new BaseDatosLocal(carpeta);
});

afterEach(() => {
  bd.cerrar();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

describe('BaseDatosLocal', () => {
  it('crea el esquema y los catálogos por defecto en una instalación nueva', () => {
    expect(bd.versionEsquema()).toBe(VERSION_ESQUEMA);
    expect(bd.listar('categorias').length).toBeGreaterThan(0);
    expect(bd.listar('centrosCosto').length).toBeGreaterThan(0);
    expect(bd.obtenerConfig<any>('empresa')?.razonSocial).toBeTruthy();
    expect(fs.existsSync(path.join(carpeta, 'vetcompras.db'))).toBe(true);
  });

  it('conserva los datos al reabrir (simula reiniciar o actualizar el programa)', () => {
    bd.guardar('ventas', { id: 'v1', monto: 50000 });
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);
    expect(bd.obtener('ventas', 'v1')).toMatchObject({ monto: 50000 });
    // Al reabrir una base existente se crea el respaldo diario
    expect(bd.listarRespaldos().some((r) => r.nombre.includes('diario'))).toBe(true);
  });

  it('guarda el PDF anexo aparte y lo conserva al editar sin contenido', () => {
    bd.guardar('documentos', {
      id: 'd1',
      folio: '1',
      archivoAdjunto: { nombre: 'f.pdf', tipo: 'pdf', tamano: 10, dataUrl: 'data:application/pdf;base64,AAAA' },
    });
    const listado = bd.listar('documentos')[0];
    expect(listado.archivoAdjunto.dataUrl).toBeUndefined();
    expect(listado.archivoAdjunto.tieneContenido).toBe(true);

    // Edición desde el listado: llega sin dataUrl
    bd.guardar('documentos', { ...listado, folio: '2' });
    const completo = bd.obtener('documentos', 'd1');
    expect(completo?.folio).toBe('2');
    expect(completo?.archivoAdjunto.dataUrl).toBe('data:application/pdf;base64,AAAA');

    bd.eliminar('documentos', ['d1']);
    expect(bd.obtener('documentos', 'd1')).toBeUndefined();
  });

  it('las operaciones por lote son atómicas', () => {
    expect(() => bd.lote('ventas', [{ id: 'a' }, { id: '' } as any])).toThrow();
    expect(bd.obtener('ventas', 'a')).toBeUndefined();
  });

  it('exporta e importa un respaldo completo sin borrar lo existente', () => {
    bd.guardar('ventas', { id: 'v1', monto: 1 });
    const respaldo = bd.exportarTodo() as any;
    expect(respaldo.ventas).toHaveLength(1);
    expect(respaldo.empresa).toBeTruthy();

    bd.guardar('ventas', { id: 'v2', monto: 2 });
    const conteo = bd.importarTodo({ ventas: [{ id: 'v3', monto: 3 }], documentos: [{ id: 'd9', folio: '9' }] });
    expect(conteo.ventas).toBe(1);
    expect(bd.listar('ventas').map((v) => v.id).sort()).toEqual(['v1', 'v2', 'v3']);
    expect(bd.listarRespaldos().some((r) => r.nombre.includes('antes-de-importar'))).toBe(true);
  });

  it('rechaza abrir una base de datos creada por una versión más nueva', () => {
    bd.db.exec(`PRAGMA user_version = ${VERSION_ESQUEMA + 1}`);
    bd.cerrar();
    expect(() => new BaseDatosLocal(carpeta)).toThrow(/más nueva/);
    bd = { cerrar: () => {} } as any;
  });

  it('cambia la revisión con cada escritura', () => {
    const antes = bd.obtenerRevision();
    bd.guardarConfig('empresa', { razonSocial: 'X' });
    expect(bd.obtenerRevision()).not.toBe(antes);
  });

  it('migración v3: corrige total y saldo de compras registradas con el criterio anterior', () => {
    // Manual antiguo: total = 100.000 + 19.000 − 2.500 de retención; abonó 50.000
    bd.guardar('documentos', {
      id: 'manual', subtotal: 100000, descuentos: 0, totalIva: 19000, impoconsumo: 0, totalRetenciones: 2500,
      total: 116500, saldoPendiente: 66500, estadoPago: 'parcial', pagos: [{ id: 'p', monto: 50000 }],
    });
    // XML antiguo: total = valor de la factura, saldo sin descontar retenciones
    bd.guardar('documentos', {
      id: 'xml', subtotal: 100000, descuentos: 0, totalIva: 19000, impoconsumo: 0, totalRetenciones: 2500,
      total: 119000, saldoPendiente: 119000, estadoPago: 'pendiente', pagos: [],
    });
    bd.db.exec('PRAGMA user_version = 2');
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);

    expect(bd.obtener('documentos', 'manual')).toMatchObject({ total: 119000, saldoPendiente: 66500, estadoPago: 'parcial' });
    expect(bd.obtener('documentos', 'xml')).toMatchObject({ total: 119000, saldoPendiente: 116500 });
    expect(bd.listarRespaldos().some((r) => r.nombre.includes('antes-de-actualizar-v2'))).toBe(true);
  });
  it('migración v4: cambia la empresa de ejemplo por "Mi Empresa" y respeta datos reales', () => {
    bd.guardarConfig('empresa', { ...EMPRESA_DEFECTO });
    bd.db.exec('PRAGMA user_version = 3');
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);
    // v4 la deja neutra; desde la 2.0 genérica la v5 ya no pone ninguna marca
    expect(bd.obtenerConfig<any>('empresa')).toMatchObject({ razonSocial: 'Mi Empresa', nombreComercial: 'Mi Empresa', nit: '', logoUrl: '' });

    bd.guardarConfig('empresa', { razonSocial: 'Clínica Real SAS', nit: '900123456' });
    bd.db.exec('PRAGMA user_version = 3');
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);
    expect(bd.obtenerConfig<any>('empresa')).toMatchObject({ razonSocial: 'Clínica Real SAS', nit: '900123456' });
  });

  it('migración v6: agrega subcategorías de fábrica sin tocar las que ya existen ni las categorías propias', () => {
    bd.guardar('categorias', { id: 'cat-servicios', nombre: 'Gasto servicios públicos', esGasto: true, activo: true });
    bd.guardar('categorias', { id: 'cat-arriendo', nombre: 'Arriendo', esGasto: true, activo: true, subcategorias: [{ id: 'mia', nombre: 'Mi subcategoría' }] });
    bd.guardar('categorias', { id: 'cat-propia', nombre: 'Propia', esGasto: true, activo: true });
    bd.db.exec('PRAGMA user_version = 5');
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);
    expect((bd.obtener('categorias', 'cat-servicios') as any).subcategorias.map((x: any) => x.nombre)).toContain('Energía eléctrica');
    expect((bd.obtener('categorias', 'cat-arriendo') as any).subcategorias).toEqual([{ id: 'mia', nombre: 'Mi subcategoría' }]);
    expect((bd.obtener('categorias', 'cat-propia') as any).subcategorias).toBeUndefined();
  });

  it('migración v5 (reservada) no cambia la marca y v7 deja categorías de venta genéricas solo si no hay ventas', () => {
    bd.guardarConfig('empresa', { razonSocial: 'Ferretería Real SAS', colorPrimario: '#059669' });
    bd.db.exec('PRAGMA user_version = 4');
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);
    const e = bd.obtenerConfig<any>('empresa');
    expect(e).toMatchObject({ razonSocial: 'Ferretería Real SAS', colorPrimario: '#059669', etiquetaReferencia: 'Referencia' });
    expect(e.categoriasVenta.map((c: any) => c.label)).toEqual(['Productos', 'Servicios', 'Otros ingresos']);

    // Quien ya tiene ventas conserva sus categorías y el dato "Mascota"
    bd.guardarConfig('empresa', { razonSocial: 'Veterinaria Real' });
    bd.guardar('ventas', { id: 'v1', consecutivo: 'VNT-1', fecha: '2026-01-01', categoria: 'vacunas', concepto: 'x', monto: 1 } as any);
    bd.db.exec('PRAGMA user_version = 6');
    bd.cerrar();
    bd = new BaseDatosLocal(carpeta);
    expect(bd.obtenerConfig<any>('empresa')).toEqual({ razonSocial: 'Veterinaria Real', etiquetaReferencia: 'Mascota' });
  });

});
