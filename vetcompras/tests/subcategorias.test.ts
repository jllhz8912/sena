import { describe, expect, it } from 'vitest';
import { nombreSubcategoria, prepararSubcategorias, subcategoriasActivas } from '../src/utils/subcategorias';
import { agruparCompras, filtrarCompras } from '../src/utils/reportesPerfil';
import { calcularPagosCompra } from '../src/utils/pagosCompra';
import { CATEGORIAS_DEFECTO } from '../src/data/defaults';

describe('subcategorías de compras y gastos', () => {
  it('las categorías de fábrica traen subcategorías (servicios públicos: energía, agua, gas…)', () => {
    const servicios = CATEGORIAS_DEFECTO.find((c) => c.id === 'cat-servicios')!;
    expect(subcategoriasActivas(servicios).map((s) => s.nombre)).toEqual(expect.arrayContaining(['Energía eléctrica', 'Acueducto y alcantarillado', 'Gas natural', 'Internet y telefonía']));
    expect(CATEGORIAS_DEFECTO.every((c) => (c.subcategorias || []).length > 0)).toBe(true);
  });

  it('al guardar: crea ids, quita vacías y repetidas, y deja inactivas las eliminadas', () => {
    const anteriores = [{ id: 'energia', nombre: 'Energía' }, { id: 'gas', nombre: 'Gas' }];
    const r = prepararSubcategorias([{ id: 'energia', nombre: 'Energía eléctrica' }, { nombre: 'Agua potable' }, { nombre: '  ' }, { nombre: 'agua POTABLE' }], anteriores);
    expect(r).toEqual([
      { id: 'energia', nombre: 'Energía eléctrica' },
      { id: 'agua_potable', nombre: 'Agua potable' },
      { id: 'gas', nombre: 'Gas', activo: false },
    ]);
    const cat = { id: 'c', subcategorias: r } as any;
    expect(subcategoriasActivas(cat).map((s) => s.id)).toEqual(['energia', 'agua_potable']);
    // Un documento con la subcategoría eliminada conserva su nombre
    expect(nombreSubcategoria([cat], 'c', 'gas')).toBe('Gas');
    expect(nombreSubcategoria([cat], 'c', undefined)).toBe('');
  });

  it('reportes: filtro y agrupación por subcategoría', () => {
    const cats = [{ id: 'cat-servicios', nombre: 'Servicios públicos', subcategorias: [{ id: 'energia', nombre: 'Energía' }, { id: 'gas', nombre: 'Gas' }] }] as any;
    const base = { fechaEmision: '2026-11-03', categoriaId: 'cat-servicios', esGasto: true, totalIva: 0, totalRetenciones: 0, saldoPendiente: 0, pagos: [], lineas: [] };
    const docs = [
      { ...base, id: '1', subcategoriaId: 'energia', total: 300000 },
      { ...base, id: '2', subcategoriaId: 'energia', total: 200000 },
      { ...base, id: '3', subcategoriaId: 'gas', total: 80000 },
      { ...base, id: '4', total: 10000 },
    ] as any;
    const rango = { desde: '2026-11-01', hasta: '2026-11-30' };
    expect(filtrarCompras(docs, { rango, subcategoriaId: 'energia' }).map((d) => d.id)).toEqual(['1', '2']);
    expect(agruparCompras(docs, 'subcategoria', cats).map((f) => [f.categoria, f.etiqueta, f.cantidad, f.total])).toEqual([
      ['Servicios públicos', 'Energía', 2, 500000],
      ['Servicios públicos', 'Gas', 1, 80000],
      ['Servicios públicos', 'Sin subcategoría', 1, 10000],
    ]);
    expect(agruparCompras(docs, 'documento', cats).find((f) => f.documentoId === '3')!.subcategoria).toBe('Gas');
  });
});

describe('cambiar la forma de pago de una compra ya guardada', () => {
  const base = { neto: 500000, medioPorDefecto: 'Efectivo', fecha: '2026-11-03' };
  const pagoContado = { id: 'p1', fecha: '2026-11-03', monto: 500000, medio: 'Efectivo', nota: 'Pago de contado' };
  const abonoPosterior = { id: 'p2', fecha: '2026-11-10', monto: 100000, medio: 'Nequi', nota: 'Abono quincena' };

  it('de contado a crédito: se quita el pago de contado y queda todo por pagar', () => {
    expect(calcularPagosCompra({ ...base, formaPago: 'credito', pagos: [pagoContado] })).toMatchObject({ pagado: 0, saldo: 500000, estado: 'pendiente', medio: 'Crédito Proveedor' });
  });
  it('de crédito a crédito: los abonos hechos después en Cuentas por pagar se conservan', () => {
    expect(calcularPagosCompra({ ...base, formaPago: 'credito', pagos: [abonoPosterior] })).toMatchObject({ pagado: 100000, saldo: 400000, estado: 'parcial' });
  });
  it('de crédito a contado: abonos previos + pago del resto = pagada', () => {
    const resto = { id: 'p3', fecha: '2026-11-15', monto: 400000, medio: 'Efectivo', nota: 'Pago de contado' };
    expect(calcularPagosCompra({ ...base, formaPago: 'contado', pagos: [abonoPosterior, resto] })).toMatchObject({ pagado: 500000, saldo: 0, estado: 'pagada', error: '' });
  });
});
