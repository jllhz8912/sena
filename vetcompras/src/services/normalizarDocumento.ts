import { Categoria, CentroCosto, CompraDocumento, Proveedor } from '../types';

interface Catalogos {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores?: Proveedor[];
}

const soloDigitos = (v?: string) => (v || '').replace(/\D/g, '');

/**
 * Devuelve un id de categoría que exista en el catálogo, en este orden:
 * la sugerida (si existe), la predeterminada del proveedor, "Compra de mercancía"
 * y por último la primera categoría activa.
 */
export function resolverCategoriaId(sugerida: string | undefined, nitProveedor: string | undefined, c: Catalogos): string {
  const activas = c.categorias.filter((x) => x.activo !== false);
  if (sugerida && c.categorias.some((x) => x.id === sugerida)) return sugerida;
  const prov = c.proveedores?.find((p) => soloDigitos(p.nit) === soloDigitos(nitProveedor) && soloDigitos(nitProveedor));
  if (prov?.categoriaPredeterminadaId && c.categorias.some((x) => x.id === prov.categoriaPredeterminadaId)) {
    return prov.categoriaPredeterminadaId;
  }
  return (activas.find((x) => x.id === 'cat-mercancia') || activas.find((x) => !x.esGasto) || activas[0])?.id || '';
}

export function resolverCentroCostoId(sugerido: string | undefined, nitProveedor: string | undefined, c: Catalogos): string {
  if (sugerido && c.centrosCosto.some((x) => x.id === sugerido)) return sugerido;
  const prov = c.proveedores?.find((p) => soloDigitos(p.nit) === soloDigitos(nitProveedor) && soloDigitos(nitProveedor));
  if (prov?.centroCostoPredeterminadoId && c.centrosCosto.some((x) => x.id === prov.centroCostoPredeterminadoId)) {
    return prov.centroCostoPredeterminadoId;
  }
  const activos = c.centrosCosto.filter((x) => x.activo !== false);
  return (activos.find((x) => x.id === 'cc-clinica') || activos[0])?.id || '';
}

/**
 * Completa un documento extraído (XML, PDF o ZIP) con todos los campos que
 * exige CompraDocumento, para que el guardado en lote quede igual de
 * completo que el guardado desde la pantalla de revisión.
 */
export function completarDocumento(parcial: Partial<CompraDocumento>, c: Catalogos): CompraDocumento {
  const ahora = new Date().toISOString();
  const nit = parcial.proveedor?.nit;
  const categoriaId = resolverCategoriaId(parcial.categoriaId, nit, c);
  const categoria = c.categorias.find((x) => x.id === categoriaId);
  const total = Number(parcial.total || 0);
  const esNotaCredito = parcial.tipoDocumento === 'nota_credito';
  const sinSaldo = parcial.formaPago !== 'credito' || esNotaCredito || total <= 0;
  const fechaEmision = parcial.fechaEmision || ahora.split('T')[0];

  return {
    tipoDocumento: 'factura_electronica',
    origen: 'electronica',
    prefijo: '',
    folio: '',
    fechaVencimiento: fechaEmision,
    formaPago: 'contado',
    medioPago: 'transferencia',
    moneda: 'COP',
    subtotal: 0,
    descuentos: 0,
    baseIva0: 0,
    baseIva5: 0,
    baseIva19: 0,
    iva5: 0,
    iva19: 0,
    totalIva: 0,
    impoconsumo: 0,
    reteFuente: 0,
    reteIva: 0,
    reteIca: 0,
    totalRetenciones: 0,
    lineas: [],
    ...parcial,
    id: parcial.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fechaEmision,
    proveedor: {
      nit: nit || '',
      razonSocial: parcial.proveedor?.razonSocial || 'Proveedor no identificado',
      ...parcial.proveedor,
    },
    categoriaId,
    centroCostoId: resolverCentroCostoId(parcial.centroCostoId, nit, c),
    esGasto: categoria ? categoria.esGasto : !!parcial.esGasto,
    total,
    saldoPendiente: sinSaldo ? 0 : Math.max(0, total - Math.abs(Number(parcial.totalRetenciones) || 0)),
    estadoPago: sinSaldo ? 'pagada' : 'pendiente',
    fechaPago: sinSaldo ? fechaEmision : undefined,
    pagos: parcial.pagos || [],
    historialCambios: parcial.historialCambios || [
      {
        fecha: ahora,
        usuario: 'Sistema',
        accion: 'Extracción de documento',
        detalle:
          parcial.metadatosExtraccion?.motor === 'gemini_flash' ? 'Extracción con Gemini AI' : 'Extracción XML UBL 2.1',
      },
    ],
    creadoEn: parcial.creadoEn || ahora,
    actualizadoEn: ahora,
  };
}
