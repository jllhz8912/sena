import { afterEach, describe, expect, it } from 'vitest';
import {
  CATEGORIAS_SERVICIO,
  CATEGORIAS_VENTA,
  SUBCATEGORIAS_POR_CATEGORIA,
  aplicarCategoriasVenta,
  categoriasVentaPredeterminadas,
  getCategoriaVentaInfo,
  idDesdeNombre,
} from '../src/utils/formatters';
import { conceptoDuplicado, conceptosPara, controlaInventario, usosDe, vendidosSinCatalogo } from '../src/utils/conceptos';
import { construirCatalogo, buscarEnCatalogo } from '../src/utils/catalogoVenta';
import { movimientosDeCompra, movimientosDeVenta } from '../src/utils/inventario';
import { Producto } from '../src/types';

const base = { unidad: 'UND', activo: true, creadoEn: '', actualizadoEn: '' };
const nexgard: Producto = { ...base, id: 'p1', nombre: 'Nexgard 10-25 kg', precioVenta: 52000 };
const consulta: Producto = { ...base, id: 's1', nombre: 'Consulta general', tipo: 'servicio', categoriaVenta: 'consultas_clinica', precioVenta: 45000, unidad: 'SERVICIO' };
const arriendo: Producto = { ...base, id: 'g1', nombre: 'Arriendo local', tipo: 'gasto', categoriaCompraId: 'cat-arriendo', ivaPct: 0 };
const catalogo = [nexgard, consulta, arriendo];

afterEach(() => aplicarCategoriasVenta(null));

describe('catálogo único de conceptos', () => {
  it('interpreta los productos antiguos (sin tipo) como productos de venta y compra con inventario', () => {
    expect(usosDe(nexgard)).toEqual(['venta', 'compra']);
    expect(controlaInventario(nexgard)).toBe(true);
    expect(controlaInventario(consulta)).toBe(false);
    expect(controlaInventario(arriendo)).toBe(false);
    expect(controlaInventario({ ...nexgard, controlaInventario: false })).toBe(false);
  });

  it('ofrece cada concepto solo donde sirve', () => {
    expect(conceptosPara(catalogo, 'venta').map((c) => c.id)).toEqual(['s1', 'p1']);
    expect(conceptosPara(catalogo, ['compra', 'gasto']).map((c) => c.id)).toEqual(['g1', 'p1']);
    expect(conceptosPara([{ ...nexgard, activo: false }], 'venta')).toEqual([]);
  });

  it('detecta nombres o códigos repetidos sin importar tildes ni mayúsculas', () => {
    expect(conceptoDuplicado(catalogo, { id: 'x', nombre: 'CONSULTA GENERAL' })?.id).toBe('s1');
    expect(conceptoDuplicado([{ ...nexgard, codigo: 'NX1' }], { id: 'x', nombre: 'Otro', codigo: 'nx1' })?.id).toBe('p1');
    expect(conceptoDuplicado(catalogo, { id: 's1', nombre: 'Consulta general' })).toBeUndefined();
  });

  it('el buscador de la venta muestra servicios del catálogo con su categoría y sin existencias, y no los gastos', () => {
    const entradas = construirCatalogo({ productos: catalogo, existencias: new Map([['p1', 3], ['s1', -2]]) });
    const c = buscarEnCatalogo(entradas, { texto: 'consulta gen' })[0];
    expect(c).toMatchObject({ productoId: 's1', tipo: 'servicio', categoria: 'consultas_clinica', precio: 45000, existencia: undefined });
    expect(buscarEnCatalogo(entradas, { texto: 'nexgard' })[0].existencia).toBe(3);
    expect(entradas.some((e) => e.productoId === 'g1')).toBe(false);
  });

  it('los servicios y gastos del catálogo no mueven inventario en compras ni ventas', () => {
    const compra = {
      id: 'd1', fechaEmision: '2026-11-01', tipoDocumento: 'factura', esGasto: false, proveedor: { razonSocial: 'X' },
      lineas: [
        { id: 'l1', descripcion: 'Nexgard 10-25 kg', cantidad: 5, valorUnitario: 38000 },
        { id: 'l2', descripcion: 'Arriendo local', cantidad: 1, valorUnitario: 2000000 },
      ],
    } as any;
    const r = movimientosDeCompra(compra, catalogo, []);
    expect(r.guardar.map((m) => m.productoId)).toEqual(['p1']);
    expect(r.productosNuevos).toEqual([]);

    const venta = { id: 'v1', fecha: '2026-11-01', items: [
      { id: 'i1', concepto: 'Consulta general', productoId: 's1', cantidad: 1 },
      { id: 'i2', concepto: 'Nexgard 10-25 kg', cantidad: 2 },
    ] } as any;
    expect(movimientosDeVenta(venta, catalogo, []).guardar.map((m) => m.productoId)).toEqual(['p1']);
  });

  it('encuentra lo vendido a mano que falta en el catálogo, con su último precio', () => {
    const ventas = [
      { id: 'v1', fecha: '2026-10-01', items: [{ id: 'a', categoria: 'banos', concepto: 'Baño medicado', cantidad: 1, precioUnitario: 30000 }] },
      { id: 'v2', fecha: '2026-10-05', items: [
        { id: 'b', categoria: 'banos', concepto: 'baño medicado', cantidad: 1, precioUnitario: 35000 },
        { id: 'c', categoria: 'consultas_clinica', concepto: 'Consulta General', cantidad: 1, precioUnitario: 45000 },
        { id: 'd', categoria: 'vitrina', concepto: 'Collar antipulgas', cantidad: 1, precioUnitario: 25000 },
      ] },
    ] as any;
    const r = vendidosSinCatalogo(ventas, catalogo, (c) => CATEGORIAS_SERVICIO.has(c));
    expect(r).toEqual([
      { nombre: 'Baño medicado', categoria: 'banos', subcategoria: undefined, precio: 35000, veces: 2, tipo: 'servicio' },
      { nombre: 'Collar antipulgas', categoria: 'vitrina', subcategoria: undefined, precio: 25000, veces: 1, tipo: 'producto' },
    ]);
  });
});

describe('categorías de venta editables', () => {
  it('sin configuración usa las de fábrica', () => {
    aplicarCategoriasVenta(undefined);
    expect(CATEGORIAS_VENTA.map((c) => c.id)).toEqual(categoriasVentaPredeterminadas().map((c) => c.id));
    expect(CATEGORIAS_SERVICIO.has('vacunas')).toBe(true);
  });

  it('crea, renombra, ordena y elimina conservando el nombre para ventas antiguas', () => {
    const config = categoriasVentaPredeterminadas();
    const vacunas = config.find((c) => c.id === 'vacunas')!;
    vacunas.label = 'Vacunación';
    vacunas.subcategorias = [{ value: 'antirrabica', label: 'Antirrábica' }, { value: 'refuerzo', label: 'Refuerzo anual' }];
    config.find((c) => c.id === 'purinas_granel')!.activo = false;
    const hospital = { id: idDesdeNombre('Hospitalización', config.map((c) => c.id)), label: 'Hospitalización', tipo: 'servicio' as const, activo: true, subcategorias: [] };
    aplicarCategoriasVenta([hospital, ...config]);

    expect(hospital.id).toBe('hospitalizacion');
    expect(CATEGORIAS_VENTA[0]).toEqual({ id: 'hospitalizacion', label: 'Hospitalización' });
    expect(CATEGORIAS_VENTA.some((c) => c.id === 'purinas_granel')).toBe(false);
    expect(getCategoriaVentaInfo('purinas_granel').label).toBe('Purinas a granel');
    expect(getCategoriaVentaInfo('vacunas').label).toBe('Vacunación');
    expect(CATEGORIAS_SERVICIO.has('hospitalizacion')).toBe(true);
    expect(SUBCATEGORIAS_POR_CATEGORIA.vacunas.map((s) => s.nombreCorto)).toEqual(['Antirrábica', 'Refuerzo anual']);
    expect(SUBCATEGORIAS_POR_CATEGORIA.purinas_granel).toBeUndefined();
  });

  it('al restaurar vuelven las de fábrica con sus subcategorías', () => {
    aplicarCategoriasVenta([{ id: 'otra', label: 'Otra', tipo: 'producto', activo: true }]);
    expect(CATEGORIAS_VENTA.map((c) => c.id)).toEqual(['otra']);
    aplicarCategoriasVenta(null);
    expect(CATEGORIAS_VENTA.length).toBe(8);
    expect(SUBCATEGORIAS_POR_CATEGORIA.vacunas.length).toBe(6);
  });

  it('crea identificadores sin tildes y sin repetir', () => {
    expect(idDesdeNombre('Peluquería & Spa')).toBe('peluqueria_spa');
    expect(idDesdeNombre('Vacunas', ['vacunas'])).toBe('vacunas_2');
  });
});
