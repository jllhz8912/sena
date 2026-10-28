import { describe, it, expect } from 'vitest';
import { construirCatalogo, buscarEnCatalogo, separarCantidad } from '../src/utils/catalogoVenta';

const catalogo = construirCatalogo({
  fichas: [{ id: 'f1', tipo: 'servicio', nombre: 'Vacuna antirrábica aplicada', categoriaVenta: 'vacunas', precioVenta: 35000, activo: true } as any],
  productos: [
    { id: 'p1', nombre: 'Nexgard 10-25 kg', codigo: '7702001', grupo: 'Antiparasitarios', alias: ['Nexgard M'], unidad: 'UND', precioVenta: 52000, activo: true } as any,
    { id: 'p2', nombre: 'Dog Chow adulto 22 kg', grupo: 'Alimentos', unidad: 'BULTO', precioVenta: 198000, activo: true } as any,
  ],
  existencias: new Map([['p1', 4]]),
  ventas: [
    { id: 'v1', fecha: '2026-10-01', items: [{ id: 'i', categoria: 'banos', concepto: 'Baño perro mediano', cantidad: 1, precioUnitario: 30000, subtotal: 30000 }] } as any,
    { id: 'v2', fecha: '2026-10-02', items: [{ id: 'i', categoria: 'vitrina', concepto: 'Nexgard 10-25 kg', cantidad: 3, precioUnitario: 50000, subtotal: 150000 }] } as any,
  ],
});

describe('buscador de la venta', () => {
  it('busca por letras sueltas, sin tildes y en cualquier orden', () => {
    expect(buscarEnCatalogo(catalogo, { texto: 'rab vac' })[0].nombre).toBe('Vacuna antirrábica aplicada');
    expect(buscarEnCatalogo(catalogo, { texto: 'BANO MED' })[0].nombre).toBe('Baño perro mediano');
    expect(buscarEnCatalogo(catalogo, { texto: 'nex 10' })[0]).toMatchObject({ nombre: 'Nexgard 10-25 kg', precio: 52000, existencia: 4, vendidos: 3 });
  });
  it('busca por código, otro nombre, grupo y categoría', () => {
    expect(buscarEnCatalogo(catalogo, { texto: '7702001' })[0].productoId).toBe('p1');
    expect(buscarEnCatalogo(catalogo, { texto: 'nexgard m' })[0].productoId).toBe('p1');
    expect(buscarEnCatalogo(catalogo, { texto: 'alimentos' })[0].nombre).toBe('Dog Chow adulto 22 kg');
    expect(buscarEnCatalogo(catalogo, { texto: 'vacunas' }).some((e) => e.nombre === 'Antirrábica')).toBe(true);
  });
  it('filtra por categoría, tipo y más vendidos', () => {
    expect(buscarEnCatalogo(catalogo, { texto: '', categoria: 'banos' }).every((e) => e.categoria === 'banos')).toBe(true);
    expect(buscarEnCatalogo(catalogo, { texto: '', tipo: 'servicio' }).every((e) => e.tipo === 'servicio')).toBe(true);
    expect(buscarEnCatalogo(catalogo, { texto: '', soloFrecuentes: true }).map((e) => e.nombre)).toEqual(['Nexgard 10-25 kg', 'Baño perro mediano']);
  });
  it('cantidad rápida con 3*', () => {
    expect(separarCantidad('3*nexgard')).toEqual({ cantidad: 3, texto: 'nexgard' });
    expect(separarCantidad('2 x baño')).toEqual({ cantidad: 2, texto: 'baño' });
    expect(separarCantidad('nexgard 10')).toEqual({ cantidad: 1, texto: 'nexgard 10' });
  });
});
