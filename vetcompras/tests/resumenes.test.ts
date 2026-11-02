import { describe, expect, it } from 'vitest';
import { comprasPorCategoria, resumenMensual, ventasPorCategoria } from '../src/utils/resumenes';

const ventas = [
  { id: 'v1', fecha: '2026-10-05', monto: 100000, items: [
    { id: 'a', categoria: 'tratamientos_clinica', concepto: 'Parvovirus', cantidad: 1, precioUnitario: 80000, subtotal: 80000 },
    { id: 'b', categoria: 'vacunas', concepto: 'Antirrábica', cantidad: 1, precioUnitario: 20000, subtotal: 20000 },
  ] },
  { id: 'v2', fecha: '2026-11-01', monto: 30000, items: [
    { id: 'c', categoria: 'medicamentos', concepto: 'Antibiótico', cantidad: 1, precioUnitario: 30000, subtotal: 30000 },
  ] },
] as any;

describe('resúmenes del panel central', () => {
  it('ventas por categoría: todas las vigentes, ordenadas por valor, con participación y alias normalizados', () => {
    const r = ventasPorCategoria(
      ventas,
      [{ key: 'vacunas', label: 'Vacunas' }, { key: 'tratamientos_clinica', label: 'Tratamientos clínica' }, { key: 'banos', label: 'Baños' }],
      (k) => k
    );
    expect(r.map((x) => [x.key, x.total, x.cantidad])).toEqual([
      ['tratamientos_clinica', 110000, 2],
      ['vacunas', 20000, 1],
      ['banos', 0, 0],
    ]);
    expect(r[0].porcentaje).toBeCloseTo(84.6, 1);
    expect(r.reduce((s, x) => s + x.porcentaje, 0)).toBeCloseTo(100, 5);
  });

  it('compras y gastos por categoría, incluidas las categorías sin movimiento', () => {
    const categorias = [
      { id: 'cat-mercancia', nombre: 'Mercancía', esGasto: false, color: '#9330b3', activo: true },
      { id: 'cat-arriendo', nombre: 'Arriendo', esGasto: true, activo: true },
      { id: 'cat-vieja', nombre: 'Inactiva', esGasto: false, activo: false },
    ] as any;
    const docs = [
      { id: 'd1', categoriaId: 'cat-mercancia', total: 300000, fechaEmision: '2026-10-02' },
      { id: 'd2', categoriaId: 'cat-mercancia', total: 100000, fechaEmision: '2026-10-09' },
      { id: 'd3', categoriaId: 'otra', esGasto: true, total: 100000, fechaEmision: '2026-10-10' },
    ] as any;
    const r = comprasPorCategoria(docs, categorias);
    expect(r.map((x) => [x.nombre, x.total, x.cantidad, x.esGasto])).toEqual([
      ['Mercancía', 400000, 2, false],
      ['Sin categoría', 100000, 1, true],
      ['Arriendo', 0, 0, true],
    ]);
    expect(r[0].porcentaje).toBe(80);
  });

  it('mes a mes con resultado = ventas − compras − gastos, solo del año pedido', () => {
    const docs = [
      { id: 'd1', fechaEmision: '2026-10-02', total: 40000, esGasto: false },
      { id: 'd2', fechaEmision: '2026-10-20', total: 70000, esGasto: true },
      { id: 'd3', fechaEmision: '2025-10-20', total: 999999, esGasto: true },
    ] as any;
    const m = resumenMensual(ventas, docs, 2026);
    expect(m).toHaveLength(12);
    expect(m[9]).toMatchObject({ nombre: 'Octubre', ventas: 100000, compras: 40000, gastos: 70000, resultado: -10000 });
    expect(m[10]).toMatchObject({ ventas: 30000, resultado: 30000 });
    expect(m[0].resultado).toBe(0);
  });
});
