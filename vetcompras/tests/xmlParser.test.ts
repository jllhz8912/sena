// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { procesarFacturaXml } from '../src/services/xmlParser';
import { FACTURA, subtotal } from './fixtures';

describe('procesarFacturaXml - factura UBL 2.1', () => {
  const r = procesarFacturaXml(FACTURA, 'fv21234.xml');

  it('separa prefijo autorizado y folio aunque el prefijo tenga dígitos', () => {
    expect(r.prefijo).toBe('FV2');
    expect(r.folio).toBe('1234');
    expect(r.cufe).toBe('abc123def456abc123def456abc123def456');
  });

  it('no duplica el IVA de las líneas y discrimina bases por tarifa', () => {
    expect(r.baseIva19).toBe(200000);
    expect(r.iva19).toBe(38000);
    expect(r.baseIva5).toBe(50000);
    expect(r.iva5).toBe(2500);
    expect(r.baseIva0).toBe(30000);
    expect(r.totalIva).toBe(40500);
  });

  it('lee las retenciones de WithholdingTaxTotal', () => {
    expect(r.reteFuente).toBe(7000);
    expect(r.porcentajeReteFuente).toBe(2.5);
    expect(r.reteIca).toBe(1932);
    expect(r.reteIva).toBe(0);
    expect(r.totalRetenciones).toBe(8932);
  });

  it('toma proveedor, DV, crédito y total', () => {
    expect(r.proveedor?.nit).toBe('900123456');
    expect(r.proveedor?.dv).toBe('7');
    expect(r.proveedor?.razonSocial).toBe('DISTRIBUIDORA VET SAS');
    expect(r.proveedor?.ciudad).toBe('Florencia');
    expect(r.adquirente?.nit).toBe('901000111');
    expect(r.formaPago).toBe('credito');
    expect(r.diasCredito).toBe(30);
    expect(r.total).toBe(320500);
    expect(r.saldoPendiente).toBe(320500);
    expect(r.estadoPago).toBe('pendiente');
    expect(r.metadatosExtraccion?.advertencias).toEqual([]);
  });

  it('extrae líneas y asigna una categoría existente del catálogo', () => {
    expect(r.lineas).toHaveLength(3);
    expect(r.lineas?.[0]).toMatchObject({ codigo: 'SKU-1', cantidad: 2, valorUnitario: 100000, porcentajeIva: 19, valorIva: 38000 });
    expect(r.categoriaId).toBe('cat-mercancia');
    expect(r.esGasto).toBe(false);
  });
});

describe('procesarFacturaXml - AttachedDocument', () => {
  it('extrae la factura incrustada en el contenedor de la DIAN', () => {
    const contenedor = `<?xml version="1.0" encoding="UTF-8"?>
<AttachedDocument xmlns="urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>CONT-1</cbc:ID>
  <cac:Attachment><cac:ExternalReference><cbc:MimeCode>text/xml</cbc:MimeCode>
    <cbc:Description><![CDATA[${FACTURA.replace('<?xml version="1.0" encoding="UTF-8"?>', '')}]]></cbc:Description>
  </cac:ExternalReference></cac:Attachment>
</AttachedDocument>`;
    const r = procesarFacturaXml(contenedor);
    expect(r.folio).toBe('1234');
    expect(r.totalIva).toBe(40500);
  });
});

describe('procesarFacturaXml - nota crédito', () => {
  it('registra valores negativos para que resten en IVA y compras', () => {
    const nota = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>NC45</cbc:ID>
  <cbc:UUID>cude999888777666555444333222111000</cbc:UUID>
  <cbc:IssueDate>2026-09-15</cbc:IssueDate>
  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>FV21234</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme><cbc:RegistrationName>DISTRIBUIDORA VET SAS</cbc:RegistrationName>
    <cbc:CompanyID schemeID="7">900123456</cbc:CompanyID></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount>19000</cbc:TaxAmount>${subtotal(100000, 19000, 19)}</cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount>100000</cbc:LineExtensionAmount><cbc:PayableAmount>119000</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:CreditNoteLine><cbc:ID>1</cbc:ID><cbc:CreditedQuantity unitCode="94">1</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount>100000</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>DEVOLUCION APOQUEL</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount>100000</cbc:PriceAmount></cac:Price></cac:CreditNoteLine>
</CreditNote>`;
    const r = procesarFacturaXml(nota);
    expect(r.tipoDocumento).toBe('nota_credito');
    expect(r.prefijo).toBe('NC');
    expect(r.folio).toBe('45');
    expect(r.baseIva19).toBe(-100000);
    expect(r.iva19).toBe(-19000);
    expect(r.total).toBe(-119000);
    expect(r.saldoPendiente).toBe(0);
    expect(r.documentoReferencia).toBe('FV21234');
    expect(r.lineas).toHaveLength(1);
  });
});

describe('procesarFacturaXml - errores', () => {
  it('rechaza XML mal formado', () => {
    expect(() => procesarFacturaXml('<Invoice><cbc:ID>')).toThrow(/estructura válida/);
  });
});
