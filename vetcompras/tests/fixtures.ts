/** XML UBL 2.1 de prueba (datos ficticios). */

const NS = `xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"`;

export const subtotal = (base: number, iva: number, pct: number, id = '01', nombre = 'IVA') => `
  <cac:TaxSubtotal>
    <cbc:TaxableAmount currencyID="COP">${base}</cbc:TaxableAmount>
    <cbc:TaxAmount currencyID="COP">${iva}</cbc:TaxAmount>
    <cac:TaxCategory><cbc:Percent>${pct}</cbc:Percent>
      <cac:TaxScheme><cbc:ID>${id}</cbc:ID><cbc:Name>${nombre}</cbc:Name></cac:TaxScheme>
    </cac:TaxCategory>
  </cac:TaxSubtotal>`;

const linea = (n: number, desc: string, qty: number, unit: number, pct: number) => {
  const base = qty * unit;
  const iva = Math.round((base * pct) / 100);
  return `
  <cac:InvoiceLine>
    <cbc:ID>${n}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="94">${qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="COP">${base}</cbc:LineExtensionAmount>
    <cac:TaxTotal><cbc:TaxAmount currencyID="COP">${iva}</cbc:TaxAmount>${subtotal(base, iva, pct)}</cac:TaxTotal>
    <cac:Item><cbc:Description>${desc}</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>SKU-${n}</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="COP">${unit}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
};

// Factura: 2 x 100.000 al 19% + 1 x 50.000 al 5% + 1 x 30.000 excluido; ReteFuente 2,5% y ReteICA
export const FACTURA = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice ${NS}>
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions>
    <sts:InvoiceControl><sts:AuthorizedInvoices><sts:Prefix>FV2</sts:Prefix><sts:From>1</sts:From><sts:To>5000</sts:To></sts:AuthorizedInvoices></sts:InvoiceControl>
  </sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:ID>FV21234</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">abc123def456abc123def456abc123def456</cbc:UUID>
  <cbc:IssueDate>2026-09-10</cbc:IssueDate>
  <cbc:DueDate>2026-10-10</cbc:DueDate>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PhysicalLocation><cac:Address><cbc:CityName>Florencia</cbc:CityName><cac:AddressLine><cbc:Line>Cra 11 # 15-20</cbc:Line></cac:AddressLine></cac:Address></cac:PhysicalLocation>
    <cac:PartyTaxScheme><cbc:RegistrationName>DISTRIBUIDORA VET SAS</cbc:RegistrationName>
      <cbc:CompanyID schemeID="7" schemeName="31">900123456</cbc:CompanyID>
      <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:Contact><cbc:Telephone>3001234567</cbc:Telephone><cbc:ElectronicMail>ventas@vet.co</cbc:ElectronicMail></cac:Contact>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyTaxScheme><cbc:RegistrationName>CLINICA VETERINARIA</cbc:RegistrationName>
      <cbc:CompanyID schemeID="1" schemeName="31">901000111</cbc:CompanyID>
      <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:ID>2</cbc:ID><cbc:PaymentMeansCode>42</cbc:PaymentMeansCode><cbc:PaymentDueDate>2026-10-10</cbc:PaymentDueDate></cac:PaymentMeans>
  <cac:TaxTotal><cbc:TaxAmount currencyID="COP">38000</cbc:TaxAmount>${subtotal(200000, 38000, 19)}</cac:TaxTotal>
  <cac:TaxTotal><cbc:TaxAmount currencyID="COP">2500</cbc:TaxAmount>${subtotal(50000, 2500, 5)}</cac:TaxTotal>
  <cac:TaxTotal><cbc:TaxAmount currencyID="COP">0</cbc:TaxAmount>${subtotal(30000, 0, 0)}</cac:TaxTotal>
  <cac:WithholdingTaxTotal><cbc:TaxAmount currencyID="COP">7000</cbc:TaxAmount>${subtotal(280000, 7000, 2.5, '06', 'ReteRenta')}</cac:WithholdingTaxTotal>
  <cac:WithholdingTaxTotal><cbc:TaxAmount currencyID="COP">1932</cbc:TaxAmount>${subtotal(280000, 1932, 0.69, '07', 'ReteICA')}</cac:WithholdingTaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">280000</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">250000</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">320500</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="COP">320500</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linea(1, 'APOQUEL 16MG X 20 TABLETAS', 2, 100000, 19)}
  ${linea(2, 'CONCENTRADO PRO PLAN ADULTO 3KG', 1, 50000, 5)}
  ${linea(3, 'VACUNA RABICA', 1, 30000, 0)}
</Invoice>`;

