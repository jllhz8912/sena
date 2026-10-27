import { CompraDocumento } from '../types';

const n = (v: unknown) => Number(v) || 0;

/**
 * IVA descontable del período para el Formulario 300, por tarifa.
 * Las notas crédito se guardan con valores negativos, así que restan solas.
 */
export function resumenIvaPeriodo(documentos: CompraDocumento[], periodoTexto: string) {
  const r = { base0: 0, base5: 0, iva5: 0, base19: 0, iva19: 0, totalBaseGravable: 0, totalIvaDescontable: 0, periodoTexto };
  for (const d of documentos) {
    r.base0 += n(d.baseIva0);
    r.base5 += n(d.baseIva5);
    r.iva5 += n(d.iva5);
    r.base19 += n(d.baseIva19);
    r.iva19 += n(d.iva19);
  }
  r.totalBaseGravable = r.base0 + r.base5 + r.base19;
  r.totalIvaDescontable = r.iva5 + r.iva19;
  return r;
}

/** Retenciones practicadas a cada proveedor en el período (Formulario 350 y exógena). */
export function retencionesPorTercero(documentos: CompraDocumento[]) {
  const mapa = new Map<string, { nit: string; razonSocial: string; totalBase: number; reteFuente: number; reteIva: number; reteIca: number; totalRetenido: number; cantidadDocumentos: number }>();
  for (const d of documentos) {
    const retenido = n(d.reteFuente) + n(d.reteIva) + n(d.reteIca);
    if (!retenido) continue;
    const nit = d.proveedor?.nit || 'SIN-NIT';
    const t = mapa.get(nit) || { nit, razonSocial: d.proveedor?.razonSocial || '', totalBase: 0, reteFuente: 0, reteIva: 0, reteIca: 0, totalRetenido: 0, cantidadDocumentos: 0 };
    t.totalBase += n(d.subtotal) - n(d.descuentos);
    t.reteFuente += n(d.reteFuente);
    t.reteIva += n(d.reteIva);
    t.reteIca += n(d.reteIca);
    t.totalRetenido += retenido;
    t.cantidadDocumentos += 1;
    mapa.set(nit, t);
  }
  return [...mapa.values()].sort((a, b) => b.totalRetenido - a.totalRetenido);
}
