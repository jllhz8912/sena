import { describe, it, expect } from 'vitest';
import { resumenIvaPeriodo, retencionesPorTercero } from '../src/utils/dian';

const doc = (o: any) => ({ subtotal: 0, descuentos: 0, baseIva0: 0, baseIva5: 0, baseIva19: 0, iva5: 0, iva19: 0, reteFuente: 0, reteIva: 0, reteIca: 0, ...o });

describe('reportes DIAN', () => {
  it('Form. 300: suma IVA por tarifa y las notas crédito restan', () => {
    const r = resumenIvaPeriodo([
      doc({ baseIva19: 100000, iva19: 19000, baseIva5: 20000, iva5: 1000, baseIva0: 5000 }),
      doc({ baseIva19: -10000, iva19: -1900 }),
    ] as any, 'Octubre 2026');
    expect(r).toMatchObject({ base19: 90000, iva19: 17100, iva5: 1000, base0: 5000, totalBaseGravable: 115000, totalIvaDescontable: 18100 });
  });
  it('Form. 350: agrupa por proveedor solo los documentos con retención', () => {
    const r = retencionesPorTercero([
      doc({ proveedor: { nit: '900', razonSocial: 'A' }, subtotal: 1000000, descuentos: 100000, reteFuente: 22500, reteIca: 6210 }),
      doc({ proveedor: { nit: '900', razonSocial: 'A' }, subtotal: 500000, reteFuente: 12500 }),
      doc({ proveedor: { nit: '800', razonSocial: 'B' }, subtotal: 300000 }),
    ] as any);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nit: '900', totalBase: 1400000, reteFuente: 35000, reteIca: 6210, totalRetenido: 41210, cantidadDocumentos: 2 });
  });
});
