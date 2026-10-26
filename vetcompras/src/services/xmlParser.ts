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
 * Sugiere una categoría veterinaria adecuada con base en las palabras clave del producto
 */
function sugerirCategoriaVeterinaria(descripcion: string): string {
  const desc = descripcion.toLowerCase();

  if (
    desc.includes('concentrado') ||
    desc.includes('alimento') ||
    desc.includes('croqueta') ||
    desc.includes('royal canin') ||
    desc.includes('hills') ||
    desc.includes('pro plan') ||
    desc.includes('taste of the wild') ||
    desc.includes('pedigree') ||
    desc.includes('whiskas') ||
    desc.includes('chunky') ||
    desc.includes('snack') ||
    desc.includes('nutricion') ||
    desc.includes('prescrip')
  ) {
    return 'cat-concentrados';
  }

  if (
    desc.includes('vacuna') ||
    desc.includes('nobivac') ||
    desc.includes('vanguard') ||
    desc.includes('rabia') ||
    desc.includes('séxtuple') ||
    desc.includes('sextuple') ||
    desc.includes('parvovirus') ||
    desc.includes('biologico') ||
    desc.includes('trivalente')
  ) {
    return 'cat-vacunas';
  }

  if (
    desc.includes('sutura') ||
    desc.includes('cateter') ||
    desc.includes('catéter') ||
    desc.includes('jeringa') ||
    desc.includes('aguja') ||
    desc.includes('guante') ||
    desc.includes('bisturi') ||
    desc.includes('gasa') ||
    desc.includes('tubo') ||
    desc.includes('solucion salina') ||
    desc.includes('hartmann') ||
    desc.includes('suero') ||
    desc.includes('sonda') ||
    desc.includes('quirurg')
  ) {
    return 'cat-quirurgico';
  }

  if (
    desc.includes('juguete') ||
    desc.includes('collar') ||
    desc.includes('arnes') ||
    desc.includes('arnés') ||
    desc.includes('trailla') ||
    desc.includes('correa') ||
    desc.includes('rascador') ||
    desc.includes('cama') ||
    desc.includes('bozal') ||
    desc.includes('placa') ||
    desc.includes('accesorio')
  ) {
    return 'cat-accesorios';
  }

  if (
    desc.includes('apoquel') ||
    desc.includes('bravecto') ||
    desc.includes('simparica') ||
    desc.includes('nexgard') ||
    desc.includes('convenia') ||
    desc.includes('meloxicam') ||
    desc.includes('tramadol') ||
    desc.includes('amoxicilina') ||
    desc.includes('doxiciclina') ||
    desc.includes('cefalexina') ||
    desc.includes('antiparasitario') ||
    desc.includes('antibiotico') ||
    desc.includes('farmaco') ||
    desc.includes('inyectable') ||
    desc.includes('gotas') ||
    desc.includes('unguento') ||
    desc.includes('comprimido') ||
    desc.includes('tableta')
  ) {
    return 'cat-medicamentos';
  }

  if (desc.includes('shampoo') || desc.includes('champu') || desc.includes('corte') || desc.includes('grooming')) {
    return 'cat-medicamentos';
  }

  return 'cat-medicamentos'; // Categoría predeterminada para compras de insumos
}

/**
 * Función principal que procesa un archivo XML de factura electrónica
 */
export function procesarFacturaXml(xmlContent: string, nombreArchivo = 'factura.xml'): Partial<CompraDocumento> {
  const parser = new DOMParser();
  let xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

  // Verificar si hay errores de sintaxis XML
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('El archivo XML no tiene una estructura válida: ' + parserError[0].textContent);
  }

  let rootElement = xmlDoc.documentElement;

  // Si es un AttachedDocument de la DIAN, extraer el Invoice incrustado
  const rootLocalName = rootElement.localName || rootElement.nodeName.split(':').pop();

  if (rootLocalName === 'AttachedDocument') {
    // Buscar Attachment -> ExternalReference -> Description que contiene el Invoice
    const attachmentEl = findElementByLocalName(rootElement, 'Attachment');
    if (attachmentEl) {
      const descriptionEl = findElementByLocalName(attachmentEl, 'Description');
      if (descriptionEl && descriptionEl.textContent) {
        let embeddedXml = descriptionEl.textContent.trim();

        // En caso de que venga codificado en Base64
        if (!embeddedXml.startsWith('<') && !embeddedXml.startsWith('<?xml')) {
          try {
            embeddedXml = atob(embeddedXml);
          } catch {
            // No era base64, continuar
          }
        }

        if (embeddedXml.includes('<Invoice') || embeddedXml.includes('<CreditNote')) {
          const innerDoc = parser.parseFromString(embeddedXml, 'application/xml');
          if (innerDoc.getElementsByTagName('parsererror').length === 0) {
            xmlDoc = innerDoc;
            rootElement = innerDoc.documentElement;
          }
        }
      }
    }
  }

  // 1. Número de Factura y Prefijo
  const idCompleto = getTextValue(rootElement, 'ID', '');
  let prefijo = '';
  let folio = idCompleto;

  // Analizar prefijo común colombiano (ej: FE1234, SETP9901, F-8812)
  const idMatch = idCompleto.match(/^([A-Za-z\-]+)(\d+)$/);
  if (idMatch) {
    prefijo = idMatch[1].replace('-', '');
    folio = idMatch[2];
  }

  // 2. CUFE / CUDE
  const cufe = getTextValue(rootElement, 'UUID', '');

  // 3. Fechas
  const fechaEmision = getTextValue(rootElement, 'IssueDate', new Date().toISOString().split('T')[0]);
  let fechaVencimiento = getTextValue(rootElement, 'DueDate', '');
  if (!fechaVencimiento) {
    const paymentDueDate = getTextValue(rootElement, 'PaymentDueDate', '');
    fechaVencimiento = paymentDueDate || fechaEmision;
  }

  // 4. Forma y Medio de Pago
  let formaPago: 'contado' | 'credito' = 'contado';
  let diasCredito = 0;
  let medioPago = 'transferencia';

  const paymentTermsEl = findElementByLocalName(rootElement, 'PaymentTerms');
  if (paymentTermsEl) {
    const termId = getTextValue(paymentTermsEl, 'ID');
    const termNote = getTextValue(paymentTermsEl, 'Note');
    if (termId === '2' || termNote.toLowerCase().includes('crédito') || termNote.toLowerCase().includes('credito')) {
      formaPago = 'credito';
    }
  }

  const paymentMeansEl = findElementByLocalName(rootElement, 'PaymentMeans');
  if (paymentMeansEl) {
    const meansCode = getTextValue(paymentMeansEl, 'PaymentMeansCode');
    const meansId = getTextValue(paymentMeansEl, 'ID');
    if (meansId === '2' || meansCode === '2') {
      formaPago = 'credito';
    }

    if (meansCode === '10') medioPago = 'efectivo';
    else if (meansCode === '41' || meansCode === '42') medioPago = 'transferencia';
    else if (meansCode === '48') medioPago = 'tarjeta_credito';
    else if (meansCode === '49') medioPago = 'tarjeta_debito';
    else medioPago = 'transferencia';
  }

  // Calcular días de crédito si hay fecha de vencimiento
  if (fechaEmision && fechaVencimiento && fechaVencimiento !== fechaEmision) {
    const diffTime = Math.abs(new Date(fechaVencimiento).getTime() - new Date(fechaEmision).getTime());
    diasCredito = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diasCredito > 0) formaPago = 'credito';
  }

  // 5. Proveedor (AccountingSupplierParty)
  let nitProveedor = '';
  let dvProveedor = '';
  let razonSocialProveedor = '';
  let direccionProveedor = '';
  let ciudadProveedor = 'Bogotá D.C.';
  let telefonoProveedor = '';
  let emailProveedor = '';

  const supplierPartyEl = findElementByLocalName(rootElement, 'AccountingSupplierParty');
  if (supplierPartyEl) {
    const partyEl = findElementByLocalName(supplierPartyEl, 'Party') || supplierPartyEl;

    // Razón Social
    const legalEntityEl = findElementByLocalName(partyEl, 'PartyLegalEntity');
    if (legalEntityEl) {
      razonSocialProveedor = getTextValue(legalEntityEl, 'RegistrationName');
    }
    if (!razonSocialProveedor) {
      razonSocialProveedor = getTextValue(partyEl, 'RegistrationName') || getTextValue(partyEl, 'Name');
    }

    // NIT y Dígito de Verificación
    const companyIdEl = findElementByLocalName(partyEl, 'CompanyID');
    if (companyIdEl) {
      nitProveedor = companyIdEl.textContent?.trim() || '';
      dvProveedor = companyIdEl.getAttribute('schemeID') || '';
    } else {
      const partyIdEl = findElementByLocalName(partyEl, 'ID');
      if (partyIdEl) {
        nitProveedor = partyIdEl.textContent?.trim() || '';
        dvProveedor = partyIdEl.getAttribute('schemeID') || '';
      }
    }

    // Ubicación y contacto
    const addressEl = findElementByLocalName(partyEl, 'PhysicalLocation') || findElementByLocalName(partyEl, 'PostalAddress');
    if (addressEl) {
      ciudadProveedor = getTextValue(addressEl, 'CityName') || ciudadProveedor;
      direccionProveedor = getTextValue(addressEl, 'Line');
    }

    const contactEl = findElementByLocalName(partyEl, 'Contact');
    if (contactEl) {
      telefonoProveedor = getTextValue(contactEl, 'Telephone');
      emailProveedor = getTextValue(contactEl, 'ElectronicMail');
    }
  }

  // 6. Adquirente (AccountingCustomerParty)
  let nitAdquirente = '';
  let razonSocialAdquirente = '';
  const customerPartyEl = findElementByLocalName(rootElement, 'AccountingCustomerParty');
  if (customerPartyEl) {
    const partyEl = findElementByLocalName(customerPartyEl, 'Party') || customerPartyEl;
    const companyIdEl = findElementByLocalName(partyEl, 'CompanyID') || findElementByLocalName(partyEl, 'ID');
    if (companyIdEl) nitAdquirente = companyIdEl.textContent?.trim() || '';

    const legalEl = findElementByLocalName(partyEl, 'PartyLegalEntity') || partyEl;
    razonSocialAdquirente = getTextValue(legalEl, 'RegistrationName') || getTextValue(partyEl, 'Name');
  }

  // 7. Moneda
  const moneda = getTextValue(rootElement, 'DocumentCurrencyCode', 'COP');

  // 8. Totales Monetarios (LegalMonetaryTotal)
  let subtotal = 0;
  let descuentos = 0;
  let totalPagar = 0;

  const monetaryTotalEl = findElementByLocalName(rootElement, 'LegalMonetaryTotal');
  if (monetaryTotalEl) {
    subtotal = getNumberValue(monetaryTotalEl, 'LineExtensionAmount', 0);
    descuentos = getNumberValue(monetaryTotalEl, 'AllowanceTotalAmount', 0);
    totalPagar = getNumberValue(monetaryTotalEl, 'PayableAmount', 0);
    if (!totalPagar) {
      totalPagar = getNumberValue(monetaryTotalEl, 'TaxInclusiveAmount', 0);
    }
  }

  // 9. Impuestos y Retenciones (TaxTotal / TaxSubtotal)
  let baseIva0 = 0;
  let baseIva5 = 0;
  let baseIva19 = 0;
  let iva5 = 0;
  let iva19 = 0;
  let totalIva = 0;
  let impoconsumo = 0;

  let reteFuente = 0;
  let porcentajeReteFuente = 0;
  let reteIva = 0;
  let porcentajeReteIva = 0;
  let reteIca = 0;
  let porcentajeReteIca = 0;
  let totalRetenciones = 0;

  // Analizar todos los bloques TaxTotal
  const taxTotalElements = findAllElementsByLocalName(rootElement, 'TaxTotal');

  for (const taxEl of taxTotalElements) {
    const subtotalElements = findAllElementsByLocalName(taxEl, 'TaxSubtotal');

    for (const subEl of subtotalElements) {
      const taxableAmount = getNumberValue(subEl, 'TaxableAmount', 0);
      const taxAmount = getNumberValue(subEl, 'TaxAmount', 0);
      const percent = Math.round(getNumberValue(subEl, 'Percent', 0));

      const taxSchemeEl = findElementByLocalName(subEl, 'TaxScheme');
      const schemeId = taxSchemeEl ? getTextValue(taxSchemeEl, 'ID') : '';
      const schemeName = taxSchemeEl ? getTextValue(taxSchemeEl, 'Name').toUpperCase() : '';

      // Discriminación por código estándar DIAN:
      // '01' o 'IVA'
      if (schemeId === '01' || schemeName.includes('IVA')) {
        totalIva += taxAmount;
        if (percent === 19 || Math.abs(percent - 19) < 1) {
          baseIva19 += taxableAmount;
          iva19 += taxAmount;
        } else if (percent === 5 || Math.abs(percent - 5) < 1) {
          baseIva5 += taxableAmount;
          iva5 += taxAmount;
        } else if (percent === 0) {
          baseIva0 += taxableAmount;
        } else {
          // Si es otra tarifa o no vino porcentaje específico
          if (taxableAmount > 0 && taxAmount > 0) {
            const calculatedPercent = Math.round((taxAmount / taxableAmount) * 100);
            if (calculatedPercent === 19) {
              baseIva19 += taxableAmount;
              iva19 += taxAmount;
            } else if (calculatedPercent === 5) {
              baseIva5 += taxableAmount;
              iva5 += taxAmount;
            }
          }
        }
      }
      // '04' o 'INC' (Impuesto Nacional al Consumo)
      else if (schemeId === '04' || schemeName.includes('CONSUMO') || schemeName.includes('INC')) {
        impoconsumo += taxAmount;
      }
      // '05' = ReteIVA
      else if (schemeId === '05' || schemeName.includes('RETEIVA')) {
        reteIva += taxAmount;
        if (percent > 0) porcentajeReteIva = percent;
      }
      // '06' = ReteFuente
      else if (schemeId === '06' || schemeName.includes('RETEFUENTE') || schemeName.includes('RENTA')) {
        reteFuente += taxAmount;
        if (percent > 0) porcentajeReteFuente = percent;
      }
      // '07' = ReteICA
      else if (schemeId === '07' || schemeName.includes('RETEICA') || schemeName.includes('ICA')) {
        reteIca += taxAmount;
        if (percent > 0) porcentajeReteIca = percent;
      }
    }
  }

  totalRetenciones = reteFuente + reteIva + reteIca;

  // Si no se discriminó base 0 pero subtotal es mayor que base5 + base19:
  if (subtotal > 0 && subtotal > baseIva5 + baseIva19 && baseIva0 === 0) {
    const restante = Math.max(0, subtotal - (baseIva5 + baseIva19));
    if (restante > 0 && totalIva === iva5 + iva19) {
      baseIva0 = restante;
    }
  }

  // 10. Detalle de Líneas de Factura (cac:InvoiceLine)
  const lineas: LineaFactura[] = [];
  const lineElements = findAllElementsByLocalName(rootElement, 'InvoiceLine');

  let categoriaSugeridaGlobal = 'cat-medicamentos';

  for (let i = 0; i < lineElements.length; i++) {
    const lineEl = lineElements[i];

    const lineaId = getTextValue(lineEl, 'ID', String(i + 1));

    // Cantidad y Unidad
    const qtyEl = findElementByLocalName(lineEl, 'InvoicedQuantity');
    const cantidad = qtyEl ? parseFloat(qtyEl.textContent || '1') || 1 : 1;
    const unidad = qtyEl?.getAttribute('unitCode') || 'UND';

    // Importe de línea
    const totalLinea = getNumberValue(lineEl, 'LineExtensionAmount', 0);

    // Precio Unitario
    const priceEl = findElementByLocalName(lineEl, 'Price');
    const valorUnitario = priceEl ? getNumberValue(priceEl, 'PriceAmount', 0) : totalLinea / (cantidad || 1);

    // Descripción del Item
    const itemEl = findElementByLocalName(lineEl, 'Item');
    const descripcion = itemEl ? getTextValue(itemEl, 'Description', 'Producto / Insumo veterinario') : 'Insumo veterinario';

    // Código
    let codigo = '';
    if (itemEl) {
      const codeEl = findElementByLocalName(itemEl, 'SellersItemIdentification') || findElementByLocalName(itemEl, 'StandardItemIdentification');
      if (codeEl) codigo = getTextValue(codeEl, 'ID');
    }

    // Descuento en la línea
    const allowanceEl = findElementByLocalName(lineEl, 'AllowanceCharge');
    const descuento = allowanceEl ? getNumberValue(allowanceEl, 'Amount', 0) : 0;

    // IVA de la línea
    let porcentajeIvaLinea = 0;
    let valorIvaLinea = 0;
    const lineTaxEl = findElementByLocalName(lineEl, 'TaxTotal');
    if (lineTaxEl) {
      const lineSubtaxEl = findElementByLocalName(lineTaxEl, 'TaxSubtotal');
      if (lineSubtaxEl) {
        porcentajeIvaLinea = Math.round(getNumberValue(lineSubtaxEl, 'Percent', 0));
        valorIvaLinea = getNumberValue(lineSubtaxEl, 'TaxAmount', 0);
      }
    }

    const catSugerida = sugerirCategoriaVeterinaria(descripcion);
    if (i === 0) categoriaSugeridaGlobal = catSugerida;

    lineas.push({
      id: 'lin-' + (i + 1),
      codigo,
      descripcion,
      cantidad,
      unidad,
      valorUnitario: Math.round(valorUnitario),
      descuento: Math.round(descuento),
      porcentajeIva: porcentajeIvaLinea,
      valorIva: Math.round(valorIvaLinea),
      totalLinea: Math.round(totalLinea + valorIvaLinea),
      categoriaSugerida: catSugerida,
    });
  }

  // Si no se extrajo total a pagar directo, calcularlo: Subtotal + IVA + INC - Retenciones
  if (!totalPagar) {
    totalPagar = subtotal - descuentos + totalIva + impoconsumo - totalRetenciones;
  }

  const tipoDoc: TipoDocumento = rootLocalName === 'CreditNote' ? 'otro' : 'factura_electronica';

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
      razonSocial: razonSocialProveedor || 'PROVEEDOR VETERINARIO',
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
    subtotal: Math.round(subtotal),
    descuentos: Math.round(descuentos),
    baseIva0: Math.round(baseIva0),
    baseIva5: Math.round(baseIva5),
    baseIva19: Math.round(baseIva19),
    iva5: Math.round(iva5),
    iva19: Math.round(iva19),
    totalIva: Math.round(totalIva),
    impoconsumo: Math.round(impoconsumo),
    reteFuente: Math.round(reteFuente),
    porcentajeReteFuente,
    reteIva: Math.round(reteIva),
    porcentajeReteIva,
    reteIca: Math.round(reteIca),
    porcentajeReteIca,
    totalRetenciones: Math.round(totalRetenciones),
    total: Math.round(totalPagar),
    saldoPendiente: formaPago === 'contado' ? 0 : Math.round(totalPagar),
    estadoPago: formaPago === 'contado' ? 'pagada' : 'pendiente',
    fechaPago: formaPago === 'contado' ? fechaEmision : undefined,
    categoriaId: categoriaSugeridaGlobal,
    centroCostoId: 'cc-clinica',
    esGasto: false,
    lineas,
    archivoAdjunto: {
      nombre: nombreArchivo,
      tipo: 'xml',
      tamano: xmlContent.length,
      contenidoXml: xmlContent,
    },
    metadatosExtraccion: {
      motor: 'xml_parser',
      confianzaBaja: false,
    },
  };
}
