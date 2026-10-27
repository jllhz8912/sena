/**
 * ============================================================================
 * SERVICIO DE EXTRACCIÓN XML UBL 2.1 - FACTURA ELECTRÓNICA DIAN COLOMBIA
 * ============================================================================
 *
 * Soporta documentos estándar UBL 2.1 (Invoice, CreditNote) y contenedores
 * AttachedDocument emitidos y validados por la DIAN (Dirección de Impuestos y
 * Aduanas Nacionales de Colombia).
 *
 * Utiliza DOMParser nativo del navegador, siendo completamente tolerante a
 * diferentes prefijos de namespace (cbc, cac, fe, b, etc.) mediante búsqueda
 * por localName.
 */

import { CompraDocumento, LineaFactura, TipoDocumento } from '../types';
import { fechaLocal } from '../utils/formatters';

/**
 * Busca el primer elemento descendiente que coincida con el localName especificado,
 * ignorando cualquier prefijo de namespace (ej: 'ID' coincidirá con <cbc:ID>, <ID>, <fe:ID>)
 */
function findElementByLocalName(parent: Element | Document, localName: string): Element | null {
  // 1. Probar primero getElementsByTagNameNS si está disponible
  if ('getElementsByTagNameNS' in parent) {
    const list = parent.getElementsByTagNameNS('*', localName);
    if (list && list.length > 0) return list[0];
  }

  // 2. Fallback recorriendo elementos recursivamente
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName === localName || el.nodeName.split(':').pop() === localName) {
      return el;
    }
  }
  return null;
}

/**
 * Busca todos los elementos descendientes que coincidan con el localName
 */
function findAllElementsByLocalName(parent: Element | Document, localName: string): Element[] {
  const result: Element[] = [];
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName === localName || el.nodeName.split(':').pop() === localName) {
      result.push(el);
    }
  }
  return result;
}

/**
 * Obtiene el valor textual de un nodo por su localName
 */
function getTextValue(parent: Element | Document, localName: string, defaultValue = ''): string {
  const el = findElementByLocalName(parent, localName);
  return el?.textContent?.trim() || defaultValue;
}

/**
 * Obtiene el valor numérico de un nodo por su localName
 */
function getNumberValue(parent: Element | Document, localName: string, defaultValue = 0): number {
  const text = getTextValue(parent, localName);
  if (!text) return defaultValue;
  const num = parseFloat(text.replace(/,/g, ''));
  return isNaN(num) ? defaultValue : num;
}


/**
 * Hijos directos con el localName indicado. Necesario porque en UBL los nodos
 * TaxTotal, ID, etc. se repiten dentro de cada línea, y una búsqueda en
 * profundidad mezclaría los totales del documento con los de las líneas.
 */
function hijosDirectos(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter(
    (el) => el.localName === localName || el.nodeName.split(':').pop() === localName
  );
}

function textoHijo(parent: Element, localName: string, defaultValue = ''): string {
  return hijosDirectos(parent, localName)[0]?.textContent?.trim() || defaultValue;
}

/**
 * Sugiere la categoría del catálogo por defecto con base en palabras clave del
 * producto o servicio. Los ids corresponden a CATEGORIAS_DEFECTO; si el usuario
 * los modificó, la pantalla de revisión permite reasignarla.
 */
export function sugerirCategoriaVeterinaria(descripcion: string): string {
  const desc = descripcion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const contiene = (...palabras: string[]) => palabras.some((p) => desc.includes(p));

  if (contiene('energia', 'acueducto', 'alcantarillado', 'internet', 'telefonia', 'gas natural', 'aseo urbano', 'recoleccion', 'residuos biologicos', 'kwh')) {
    return 'cat-servicios';
  }
  if (contiene('arriendo', 'arrendamiento', 'canon')) {
    return 'cat-arriendo';
  }
  if (contiene('honorario', 'nomina', 'salario', 'prestacion de servicios profesionales', 'seguridad social')) {
    return 'cat-personal';
  }
  if (contiene('papeleria', 'cafeteria', 'mantenimiento', 'reparacion', 'publicidad', 'software', 'licencia', 'transporte', 'flete', 'domicilio')) {
    return 'cat-varios';
  }
  // Medicamentos, biológicos, concentrados, accesorios e insumos clínicos son mercancía / inventario.
  return 'cat-mercancia';
}

const ESQUEMAS_IVA = ['01'];
const ESQUEMAS_INC = ['04'];
const ESQUEMA_RETEIVA = '05';
const ESQUEMA_RETEFUENTE = '06';
const ESQUEMA_RETEICA = '07';

interface Subtotal {
  base: number;
  impuesto: number;
  porcentaje: number;
  esquemaId: string;
  esquemaNombre: string;
}

function leerSubtotales(bloques: Element[]): Subtotal[] {
  const resultado: Subtotal[] = [];
  for (const bloque of bloques) {
    for (const sub of hijosDirectos(bloque, 'TaxSubtotal')) {
      const categoria = hijosDirectos(sub, 'TaxCategory')[0];
      const esquema = categoria ? hijosDirectos(categoria, 'TaxScheme')[0] : findElementByLocalName(sub, 'TaxScheme');
      const porcentajeTexto = categoria ? textoHijo(categoria, 'Percent') : textoHijo(sub, 'Percent');
      resultado.push({
        base: parseFloat(textoHijo(sub, 'TaxableAmount', '0')) || 0,
        impuesto: parseFloat(textoHijo(sub, 'TaxAmount', '0')) || 0,
        porcentaje: parseFloat(porcentajeTexto || '0') || 0,
        esquemaId: esquema ? textoHijo(esquema, 'ID') : '',
        esquemaNombre: esquema ? textoHijo(esquema, 'Name').toUpperCase() : '',
      });
    }
  }
  return resultado;
}

/** Tarifa efectiva del subtotal: la informada, o la calculada si no viene. */
function tarifaDe(s: Subtotal): number {
  if (s.porcentaje > 0) return s.porcentaje;
  if (s.base > 0 && s.impuesto > 0) return Math.round((s.impuesto / s.base) * 10000) / 100;
  return 0;
}

/**
 * Función principal que procesa un archivo XML de factura electrónica,
 * nota crédito o nota débito (UBL 2.1 DIAN), incluido el contenedor AttachedDocument.
 */
export function procesarFacturaXml(xmlContent: string, nombreArchivo = 'factura.xml'): Partial<CompraDocumento> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('El archivo XML no tiene una estructura válida: ' + xmlDoc.getElementsByTagName('parsererror')[0].textContent);
  }

  let root = xmlDoc.documentElement;
  let rootLocalName = root.localName || root.nodeName.split(':').pop() || '';

  // AttachedDocument (contenedor que entrega el proveedor): extraer el documento incrustado
  if (rootLocalName === 'AttachedDocument') {
    const attachmentEl = hijosDirectos(root, 'Attachment')[0] || findElementByLocalName(root, 'Attachment');
    const descriptionEl = attachmentEl ? findElementByLocalName(attachmentEl, 'Description') : null;
    let embebido = descriptionEl?.textContent?.trim() || '';

    if (embebido && !embebido.startsWith('<')) {
      try {
        const binario = atob(embebido);
        embebido = new TextDecoder('utf-8').decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
      } catch {
        // No era base64
      }
    }

    if (/<(\w+:)?(Invoice|CreditNote|DebitNote)[\s>]/.test(embebido)) {
      const interno = parser.parseFromString(embebido, 'application/xml');
      if (interno.getElementsByTagName('parsererror').length === 0) {
        root = interno.documentElement;
        rootLocalName = root.localName || root.nodeName.split(':').pop() || '';
      }
    }
    if (rootLocalName === 'AttachedDocument') {
      throw new Error('El AttachedDocument no contiene una factura o nota legible en su anexo.');
    }
  }

  const esNotaCredito = rootLocalName === 'CreditNote';
  const esNotaDebito = rootLocalName === 'DebitNote';
  if (!['Invoice', 'CreditNote', 'DebitNote'].includes(rootLocalName)) {
    throw new Error(`Tipo de documento XML no soportado (${rootLocalName}). Se esperaba Invoice, CreditNote o DebitNote.`);
  }
  // Las notas crédito se registran con valores negativos para que resten en los informes de IVA y compras.
  const signo = esNotaCredito ? -1 : 1;

  // 1. Número, prefijo y CUFE/CUDE (hijos directos del documento)
  const idCompleto = textoHijo(root, 'ID');
  let prefijo = '';
  let folio = idCompleto;

  const prefijoAutorizado = getTextValue(root, 'Prefix'); // sts:AuthorizedInvoices/sts:Prefix (DianExtensions)
  if (prefijoAutorizado && idCompleto.toUpperCase().startsWith(prefijoAutorizado.toUpperCase())) {
    prefijo = idCompleto.slice(0, prefijoAutorizado.length);
    folio = idCompleto.slice(prefijoAutorizado.length).replace(/^-/, '');
  } else {
    const idMatch = idCompleto.match(/^([A-Za-z][A-Za-z0-9]*?)-?(\d+)$/);
    if (idMatch) {
      prefijo = idMatch[1];
      folio = idMatch[2];
    }
  }

  const cufe = textoHijo(root, 'UUID');

  // 2. Fechas
  const fechaEmision = textoHijo(root, 'IssueDate', fechaLocal());
  const paymentMeansEl = hijosDirectos(root, 'PaymentMeans')[0];
  let fechaVencimiento =
    textoHijo(root, 'DueDate') || (paymentMeansEl ? textoHijo(paymentMeansEl, 'PaymentDueDate') : '') || fechaEmision;

  // 3. Forma de pago (PaymentMeans/ID: 1 = contado, 2 = crédito) y medio de pago
  let formaPago: 'contado' | 'credito' = 'contado';
  let medioPago = 'transferencia';
  if (paymentMeansEl) {
    if (textoHijo(paymentMeansEl, 'ID') === '2') formaPago = 'credito';
    const meansCode = textoHijo(paymentMeansEl, 'PaymentMeansCode');
    if (meansCode === '10') medioPago = 'efectivo';
    else if (meansCode === '48') medioPago = 'tarjeta_credito';
    else if (meansCode === '49') medioPago = 'tarjeta_debito';
    else if (meansCode === '20') medioPago = 'cheque';
  }

  let diasCredito = 0;
  if (fechaVencimiento !== fechaEmision) {
    const diff = new Date(fechaVencimiento).getTime() - new Date(fechaEmision).getTime();
    diasCredito = Math.max(0, Math.round(diff / 86400000));
    if (diasCredito > 0) formaPago = 'credito';
  }
  if (!fechaVencimiento) fechaVencimiento = fechaEmision;

  // 4. Proveedor (AccountingSupplierParty)
  let nitProveedor = '';
  let dvProveedor = '';
  let razonSocialProveedor = '';
  let direccionProveedor = '';
  let ciudadProveedor = '';
  let telefonoProveedor = '';
  let emailProveedor = '';

  const supplierPartyEl = hijosDirectos(root, 'AccountingSupplierParty')[0];
  if (supplierPartyEl) {
    const partyEl = findElementByLocalName(supplierPartyEl, 'Party') || supplierPartyEl;
    const taxSchemeEl = findElementByLocalName(partyEl, 'PartyTaxScheme');
    const legalEntityEl = findElementByLocalName(partyEl, 'PartyLegalEntity');

    razonSocialProveedor =
      (taxSchemeEl && getTextValue(taxSchemeEl, 'RegistrationName')) ||
      (legalEntityEl && getTextValue(legalEntityEl, 'RegistrationName')) ||
      getTextValue(partyEl, 'Name');

    const companyIdEl =
      (taxSchemeEl && findElementByLocalName(taxSchemeEl, 'CompanyID')) || findElementByLocalName(partyEl, 'CompanyID');
    if (companyIdEl) {
      nitProveedor = companyIdEl.textContent?.trim() || '';
      dvProveedor = companyIdEl.getAttribute('schemeID') || '';
    }

    const addressEl = findElementByLocalName(partyEl, 'PhysicalLocation') || findElementByLocalName(partyEl, 'RegistrationAddress');
    if (addressEl) {
      ciudadProveedor = getTextValue(addressEl, 'CityName');
      direccionProveedor = getTextValue(addressEl, 'Line');
    }

    const contactEl = findElementByLocalName(partyEl, 'Contact');
    if (contactEl) {
      telefonoProveedor = getTextValue(contactEl, 'Telephone');
      emailProveedor = getTextValue(contactEl, 'ElectronicMail');
    }
  }

  // 5. Adquirente (AccountingCustomerParty)
  let nitAdquirente = '';
  let razonSocialAdquirente = '';
  const customerPartyEl = hijosDirectos(root, 'AccountingCustomerParty')[0];
  if (customerPartyEl) {
    const partyEl = findElementByLocalName(customerPartyEl, 'Party') || customerPartyEl;
    const companyIdEl = findElementByLocalName(partyEl, 'CompanyID');
    if (companyIdEl) nitAdquirente = companyIdEl.textContent?.trim() || '';
    razonSocialAdquirente = getTextValue(partyEl, 'RegistrationName') || getTextValue(partyEl, 'Name');
  }

  // 6. Moneda y totales (LegalMonetaryTotal / RequestedMonetaryTotal en notas débito)
  const moneda = textoHijo(root, 'DocumentCurrencyCode', 'COP');
  const totalesEl = hijosDirectos(root, 'LegalMonetaryTotal')[0] || hijosDirectos(root, 'RequestedMonetaryTotal')[0];
  const subtotal = totalesEl ? parseFloat(textoHijo(totalesEl, 'LineExtensionAmount', '0')) || 0 : 0;
  const descuentos = totalesEl ? parseFloat(textoHijo(totalesEl, 'AllowanceTotalAmount', '0')) || 0 : 0;
  let totalPagar = totalesEl
    ? parseFloat(textoHijo(totalesEl, 'PayableAmount', '0')) || parseFloat(textoHijo(totalesEl, 'TaxInclusiveAmount', '0')) || 0
    : 0;

  // 7. Impuestos del documento: solo TaxTotal de primer nivel (no los de cada línea)
  let baseIva0 = 0;
  let baseIva5 = 0;
  let baseIva19 = 0;
  let iva5 = 0;
  let iva19 = 0;
  let totalIva = 0;
  let impoconsumo = 0;
  const advertencias: string[] = [];

  for (const s of leerSubtotales(hijosDirectos(root, 'TaxTotal'))) {
    const esIva = ESQUEMAS_IVA.includes(s.esquemaId) || (!s.esquemaId && s.esquemaNombre === 'IVA');
    const esInc = ESQUEMAS_INC.includes(s.esquemaId) || (!s.esquemaId && s.esquemaNombre.startsWith('INC'));
    if (esIva) {
      totalIva += s.impuesto;
      const tarifa = tarifaDe(s);
      if (Math.abs(tarifa - 19) < 0.5) {
        baseIva19 += s.base;
        iva19 += s.impuesto;
      } else if (Math.abs(tarifa - 5) < 0.5) {
        baseIva5 += s.base;
        iva5 += s.impuesto;
      } else if (tarifa === 0) {
        baseIva0 += s.base;
      } else {
        advertencias.push(`Tarifa de IVA no estándar (${tarifa}%) por $${Math.round(s.impuesto)}: revisar clasificación.`);
      }
    } else if (esInc) {
      impoconsumo += s.impuesto;
    }
  }

  // 8. Retenciones informadas por el proveedor (WithholdingTaxTotal, códigos DIAN 05/06/07)
  let reteFuente = 0;
  let porcentajeReteFuente = 0;
  let reteIva = 0;
  let porcentajeReteIva = 0;
  let reteIca = 0;
  let porcentajeReteIca = 0;

  const bloquesRetencion = [
    ...hijosDirectos(root, 'WithholdingTaxTotal'),
    // Algunos facturadores reportan retenciones dentro de TaxTotal con esquemas 05/06/07
    ...hijosDirectos(root, 'TaxTotal'),
  ];
  for (const s of leerSubtotales(bloquesRetencion)) {
    if (s.esquemaId === ESQUEMA_RETEIVA || (!s.esquemaId && s.esquemaNombre.includes('RETEIVA'))) {
      reteIva += s.impuesto;
      if (s.porcentaje > 0) porcentajeReteIva = s.porcentaje;
    } else if (s.esquemaId === ESQUEMA_RETEFUENTE || (!s.esquemaId && (s.esquemaNombre.includes('RETEFUENTE') || s.esquemaNombre.includes('RETERENTA')))) {
      reteFuente += s.impuesto;
      if (s.porcentaje > 0) porcentajeReteFuente = s.porcentaje;
    } else if (s.esquemaId === ESQUEMA_RETEICA || (!s.esquemaId && s.esquemaNombre.includes('RETEICA'))) {
      reteIca += s.impuesto;
      if (s.porcentaje > 0) porcentajeReteIca = s.porcentaje;
    }
  }
  const totalRetenciones = reteFuente + reteIva + reteIca;

  // Base excluida/exenta no discriminada: la diferencia entre el subtotal y las bases gravadas
  const basesGravadas = baseIva5 + baseIva19;
  if (baseIva0 === 0 && subtotal - descuentos > basesGravadas + 1) {
    baseIva0 = subtotal - descuentos - basesGravadas;
  }

  // 9. Líneas (InvoiceLine / CreditNoteLine / DebitNoteLine)
  const nombreLinea = esNotaCredito ? 'CreditNoteLine' : esNotaDebito ? 'DebitNoteLine' : 'InvoiceLine';
  const nombreCantidad = esNotaCredito ? 'CreditedQuantity' : esNotaDebito ? 'DebitedQuantity' : 'InvoicedQuantity';
  const lineas: LineaFactura[] = [];
  const conteoCategorias: Record<string, number> = {};

  hijosDirectos(root, nombreLinea).forEach((lineEl, i) => {
    const qtyEl = hijosDirectos(lineEl, nombreCantidad)[0];
    const cantidad = qtyEl ? parseFloat(qtyEl.textContent || '1') || 1 : 1;
    const unidad = qtyEl?.getAttribute('unitCode') || 'UND';
    const valorLinea = parseFloat(textoHijo(lineEl, 'LineExtensionAmount', '0')) || 0;

    const priceEl = hijosDirectos(lineEl, 'Price')[0];
    const valorUnitario = priceEl ? parseFloat(textoHijo(priceEl, 'PriceAmount', '0')) || 0 : valorLinea / (cantidad || 1);

    const itemEl = hijosDirectos(lineEl, 'Item')[0];
    const descripcion = (itemEl && textoHijo(itemEl, 'Description')) || 'Producto / insumo';
    let codigo = '';
    if (itemEl) {
      const codeEl =
        hijosDirectos(itemEl, 'SellersItemIdentification')[0] || hijosDirectos(itemEl, 'StandardItemIdentification')[0];
      if (codeEl) codigo = textoHijo(codeEl, 'ID');
    }

    // Descuentos de la línea (ChargeIndicator = false); los cargos ya están en LineExtensionAmount
    let descuento = 0;
    for (const ac of hijosDirectos(lineEl, 'AllowanceCharge')) {
      if (textoHijo(ac, 'ChargeIndicator').toLowerCase() === 'false') {
        descuento += parseFloat(textoHijo(ac, 'Amount', '0')) || 0;
      }
    }

    let porcentajeIvaLinea = 0;
    let valorIvaLinea = 0;
    for (const s of leerSubtotales(hijosDirectos(lineEl, 'TaxTotal'))) {
      if (ESQUEMAS_IVA.includes(s.esquemaId) || (!s.esquemaId && s.esquemaNombre === 'IVA')) {
        porcentajeIvaLinea = Math.round(tarifaDe(s));
        valorIvaLinea += s.impuesto;
      }
    }

    const catSugerida = sugerirCategoriaVeterinaria(descripcion);
    conteoCategorias[catSugerida] = (conteoCategorias[catSugerida] || 0) + valorLinea;

    lineas.push({
      id: 'lin-' + (i + 1),
      codigo,
      descripcion,
      cantidad,
      unidad,
      valorUnitario: Math.round(valorUnitario),
      descuento: Math.round(descuento),
      porcentajeIva: porcentajeIvaLinea,
      valorIva: Math.round(valorIvaLinea) * signo,
      totalLinea: Math.round(valorLinea + valorIvaLinea) * signo,
      categoriaSugerida: catSugerida,
    });
  });

  // Categoría del documento: la que concentra mayor valor en las líneas
  const categoriaDocumento =
    Object.entries(conteoCategorias).sort((a, b) => b[1] - a[1])[0]?.[0] || 'cat-mercancia';

  if (!totalPagar) {
    totalPagar = subtotal - descuentos + totalIva + impoconsumo;
  }

  // Cuadre: subtotal - descuentos + impuestos debe coincidir con el total del documento
  const totalCalculado = subtotal - descuentos + totalIva + impoconsumo;
  const sumaCargos = totalesEl ? parseFloat(textoHijo(totalesEl, 'ChargeTotalAmount', '0')) || 0 : 0;
  if (Math.abs(totalCalculado + sumaCargos - totalPagar) > 2) {
    advertencias.push(
      `El total del documento ($${Math.round(totalPagar)}) no cuadra con subtotal − descuentos + impuestos ($${Math.round(totalCalculado + sumaCargos)}).`
    );
  }

  // Factura afectada por la nota (BillingReference/InvoiceDocumentReference/ID)
  let documentoReferencia: string | undefined;
  const billingRefEl = hijosDirectos(root, 'BillingReference')[0];
  if (billingRefEl) {
    const invRefEl = findElementByLocalName(billingRefEl, 'InvoiceDocumentReference');
    documentoReferencia = invRefEl ? textoHijo(invRefEl, 'ID') || undefined : undefined;
  }

  const tipoDoc: TipoDocumento = esNotaCredito ? 'nota_credito' : esNotaDebito ? 'nota_debito' : 'factura_electronica';
  const r = (v: number) => Math.round(v) * signo;
  const total = r(totalPagar);
  const sinSaldo = formaPago === 'contado' || esNotaCredito;

  return {
    tipoDocumento: tipoDoc,
    origen: 'electronica',
    prefijo,
    folio,
    cufe,
    fechaEmision,
    fechaVencimiento,
    formaPago,
    medioPago,
    diasCredito,
    proveedor: {
      nit: nitProveedor,
      dv: dvProveedor,
      razonSocial: razonSocialProveedor || 'PROVEEDOR SIN NOMBRE',
      direccion: direccionProveedor,
      ciudad: ciudadProveedor,
      telefono: telefonoProveedor,
      email: emailProveedor,
    },
    adquirente: {
      nit: nitAdquirente,
      razonSocial: razonSocialAdquirente,
    },
    moneda,
    subtotal: r(subtotal),
    descuentos: r(descuentos),
    baseIva0: r(baseIva0),
    baseIva5: r(baseIva5),
    baseIva19: r(baseIva19),
    iva5: r(iva5),
    iva19: r(iva19),
    totalIva: r(totalIva),
    impoconsumo: r(impoconsumo),
    reteFuente: r(reteFuente),
    porcentajeReteFuente,
    reteIva: r(reteIva),
    porcentajeReteIva,
    reteIca: r(reteIca),
    porcentajeReteIca,
    totalRetenciones: r(totalRetenciones),
    total,
    // Lo que se le debe al proveedor: valor de la factura menos retenciones (se pagan a la DIAN)
    saldoPendiente: sinSaldo ? 0 : total - r(totalRetenciones),
    estadoPago: sinSaldo ? 'pagada' : 'pendiente',
    fechaPago: sinSaldo ? fechaEmision : undefined,
    categoriaId: categoriaDocumento,
    centroCostoId: 'cc-clinica',
    esGasto: categoriaDocumento !== 'cat-mercancia',
    lineas,
    documentoReferencia,
    observaciones: documentoReferencia
      ? `${esNotaCredito ? 'Nota crédito' : 'Nota débito'} que afecta la factura ${documentoReferencia}.`
      : undefined,
    archivoAdjunto: {
      nombre: nombreArchivo,
      tipo: 'xml',
      tamano: xmlContent.length,
      contenidoXml: xmlContent,
    },
    metadatosExtraccion: {
      motor: 'xml_parser',
      confianzaBaja: advertencias.length > 0,
      advertencias,
    },
  };
}
