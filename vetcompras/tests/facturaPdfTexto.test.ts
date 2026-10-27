import { describe, it, expect } from 'vitest';
import { numeroCo, fechaIso, parsearQrDian, parsearTextoFactura, numeroDesdeArchivo, proveedorDesdeArchivo } from '../src/utils/facturaPdfTexto';

const CUFE = 'a'.repeat(32) + '0123456789abcdef'.repeat(4);

describe('números y fechas en formato colombiano', () => {
  it('interpreta separadores de miles y decimales', () => {
    expect(numeroCo('$ 1.234.567')).toBe(1234567);
    expect(numeroCo('1.234.567,89')).toBe(1234568);
    expect(numeroCo('1,234,567.40')).toBe(1234567);
    expect(numeroCo('119000.00')).toBe(119000);
    expect(numeroCo('$45.000')).toBe(45000);
    expect(numeroCo('2,50')).toBe(3);
  });
  it('normaliza fechas', () => {
    expect(fechaIso('2026-10-20')).toBe('2026-10-20');
    expect(fechaIso('20/10/2026')).toBe('2026-10-20');
    expect(fechaIso('5-1-2026')).toBe('2026-01-05');
    expect(fechaIso('20 de octubre de 2026')).toBe('2026-10-20');
  });
});

describe('QR de la DIAN', () => {
  it('lee el formato con claves en líneas', () => {
    const q = parsearQrDian(`NumFac: FEC24495\nFecFac: 2026-10-20\nHorFac: 10:15:00-05:00\nNitFac: 901234567\nDocAdq: 1117000000\nValFac: 250000.00\nValIva: 47500.00\nValOtroIm: 0.00\nValTolFac: 297500.00\nCUFE: ${CUFE}\nQRCode: https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${CUFE}`);
    expect(q).toMatchObject({ prefijo: 'FEC', folio: '24495', fecha: '2026-10-20', nitEmisor: '901234567', subtotal: 250000, iva: 47500, total: 297500, cufe: CUFE });
  });
  it('lee claves en una sola línea y el CUFE desde el enlace', () => {
    const q = parsearQrDian(`NumFac=SETP990001 FecFac=2026-09-01 NitFac=900111222 ValTolFac=119000 https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${CUFE}`);
    expect(q).toMatchObject({ prefijo: 'SETP', folio: '990001', nitEmisor: '900111222', total: 119000, cufe: CUFE });
  });
  it('ignora QR que no son de factura', () => {
    expect(parsearQrDian('https://www.coco-pink.com')).toBeNull();
  });
});

describe('texto de la factura', () => {
  it('factura electrónica típica', () => {
    const r = parsearTextoFactura([
      'COCO PINK S.A.S.',
      'NIT: 901.234.567-8',
      'Calle 10 # 5-20 Florencia, Caquetá',
      'FACTURA ELECTRÓNICA DE VENTA No. FEC-24495',
      'Fecha de emisión: 20/10/2026   Fecha de vencimiento: 19/11/2026',
      'Forma de pago: Crédito',
      'Cliente: LOS CRIOLLOS VET  NIT 1117000000',
      'Descripción Cant. Valor unitario Total',
      'Shampoo antipulgas 500 ml 10 25.000 250.000',
      'Subtotal $ 250.000',
      'IVA 19% $ 47.500',
      'Retención en la fuente $ 6.250',
      'ReteICA $ 1.725',
      'Total a pagar $ 297.500',
      `CUFE: ${CUFE.slice(0, 50)}`,
      CUFE.slice(50),
    ]);
    expect(r).toMatchObject({
      razonSocial: 'COCO PINK S.A.S.', nitEmisor: '901234567', dvEmisor: '8', nitAdquirente: '1117000000',
      prefijo: 'FEC', folio: '24495', fechaEmision: '2026-10-20', fechaVencimiento: '2026-11-19', formaPago: 'credito',
      subtotal: 250000, iva19: 47500, reteFuente: 6250, reteIca: 1725, total: 297500, cufe: CUFE, tipo: 'factura_electronica',
    });
  });
  it('cotización y cuenta de cobro de persona natural', () => {
    const cot = parsearTextoFactura(['AGROVET DEL SUR LTDA', 'NIT 800.555.444-1', 'COTIZACIÓN No. 345', 'Fecha: 01/10/2026', 'Valor sin IVA 1.000.000', 'IVA 190.000', 'TOTAL 1.190.000']);
    expect(cot).toMatchObject({ tipo: 'cotizacion', razonSocial: 'AGROVET DEL SUR LTDA', nitEmisor: '800555444', total: 1190000 });
    const cc = parsearTextoFactura(['CUENTA DE COBRO No. 12', 'Florencia, 15 de septiembre de 2026', 'LOS CRIOLLOS VET', 'DEBE A:', 'Juan Pérez Gómez', 'C.C. 1.117.888.999', 'La suma de $ 800.000', 'Total $ 800.000']);
    expect(cc).toMatchObject({ tipo: 'cuenta_cobro', folio: '12', total: 800000 });
  });
  it('número y proveedor desde el nombre del archivo', () => {
    const nombre = 'FACTURA_ELECTRONICA_DE_VENTA_COCO_PINK_SAS_FEC-24495.pdf';
    expect(numeroDesdeArchivo(nombre)).toEqual({ prefijo: 'FEC', folio: '24495' });
    expect(proveedorDesdeArchivo(nombre)).toBe('COCO PINK SAS');
  });
});

import { parsearItems } from '../src/utils/facturaPdfTexto';
describe('detalle de productos', () => {
  it('lee filas con columnas del PDF', () => {
    const items = parsearItems([
      'COCO PINK S.A.S.',
      'Código ¦ Descripción ¦ Cant. ¦ Valor unit. ¦ Total',
      '7701234 ¦ Shampoo antipulgas 500 ml ¦ 10 ¦ 25.000 ¦ 250.000',
      'Collar isabelino talla M ¦ 3 ¦ $ 12.500 ¦ $ 37.500',
      'Subtotal ¦ 287.500',
    ]);
    expect(items).toEqual([
      { codigo: '7701234', descripcion: 'Shampoo antipulgas 500 ml', cantidad: 10, valorUnitario: 25000, total: 250000, porcentajeIva: undefined },
      { codigo: undefined, descripcion: 'Collar isabelino talla M', cantidad: 3, valorUnitario: 12500, total: 37500, porcentajeIva: undefined },
    ]);
  });
  it('lee filas de texto reconocido (OCR) con IVA', () => {
    const items = parsearItems(['DESCRIPCION CANT VR UNIT IVA TOTAL', 'Dog Chow adulto 22 kg 2 185.000 5% 388.500', 'TOTAL 388.500']);
    expect(items[0]).toMatchObject({ descripcion: 'Dog Chow adulto 22 kg', cantidad: 2, valorUnitario: 185000, porcentajeIva: 5 });
  });
  it('no toma totales ni datos del encabezado como productos', () => {
    expect(parsearItems(['NIT 900.123.456 1 2', 'Subtotal 100 200', 'Fecha 2026 10 20'])).toEqual([]);
  });
});
