/**
 * Definiciones de tipos para VetCompras
 * Sistema de Control de Compras y Gastos para Veterinarias en Colombia
 */

export type TipoDocumento =
  | 'factura_electronica'
  | 'factura_papel'
  | 'documento_soporte'
  | 'cuenta_cobro'
  | 'recibo_caja'
  | 'tiquete_pos'
  | 'servicios_publicos'
  | 'nomina_honorarios'
  | 'otro';

export type OrigenDocumento = 'electronica' | 'manual';

export type EstadoPago = 'pagada' | 'pendiente' | 'parcial';

export type FormaPago = 'contado' | 'credito';

export interface ProveedorInfo {
  nit: string;
  dv?: string;
  razonSocial: string;
  nombreComercial?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
}

export interface AdquirenteInfo {
  nit: string;
  razonSocial?: string;
}

export interface LineaFactura {
  id: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  valorUnitario: number;
  descuento: number;
  porcentajeIva: number; // 0, 5, 19
  valorIva: number;
  totalLinea: number;
  categoriaSugerida?: string;
}

export interface ArchivoAdjunto {
  nombre: string;
  tipo: 'xml' | 'pdf' | 'imagen' | 'zip';
  tamano: number;
  dataUrl?: string; // Data URL en base64 para previsualizar/descargar
  contenidoXml?: string; // Texto XML original para reanálisis o descarga
}

export interface HistorialCambio {
  fecha: string;
  usuario: string;
  accion: string;
  detalle?: string;
}

export interface RegistroPago {
  id: string;
  fecha: string;
  monto: number;
  medio: string;
  referencia?: string;
  nota?: string;
}

export interface MetadatosExtraccion {
  motor: 'xml_parser' | 'gemini_flash';
  confianzaBaja?: boolean;
  camposDudosos?: string[];
  tiempoExtraccionMs?: number;
  advertencias?: string[];
}

export interface CompraDocumento {
  id: string;
  tipoDocumento: TipoDocumento;
  origen: OrigenDocumento;
  prefijo: string;
  folio: string; // Número de factura o documento
  cufe?: string; // CUFE / CUDE de la DIAN
  fechaEmision: string; // YYYY-MM-DD
  fechaVencimiento: string; // YYYY-MM-DD
  formaPago: FormaPago;
  medioPago: string; // Transferencia, Efectivo, Tarjeta, etc.
  diasCredito?: number;

  // Tercero
  proveedorId?: string;
  proveedor: ProveedorInfo;
  adquirente?: AdquirenteInfo;

  // Clasificación contable
  categoriaId: string;
  centroCostoId: string;
  esGasto: boolean; // false = compra para inventario/reventa/insumo, true = gasto operativo/administrativo

  // Moneda e importes
  moneda: string; // COP por defecto
  subtotal: number;
  descuentos: number;

  // Discriminación de bases e IVA para Formulario 300 DIAN
  baseIva0: number;
  baseIva5: number;
  baseIva19: number;
  iva5: number;
  iva19: number;
  totalIva: number;
  impoconsumo: number;

  // Retenciones practicadas para Formulario 350 DIAN
  reteFuente: number;
  porcentajeReteFuente?: number;
  reteIva: number;
  porcentajeReteIva?: number;
  reteIca: number;
  porcentajeReteIca?: number;
  totalRetenciones: number;

  // Total y cartera
  total: number;
  saldoPendiente: number;
  estadoPago: EstadoPago;
  fechaPago?: string;

  // Detalle y anexos
  lineas: LineaFactura[];
  archivoAdjunto?: ArchivoAdjunto;
  observaciones?: string;

  // Trazabilidad
  pagos: RegistroPago[];
  historialCambios: HistorialCambio[];
  metadatosExtraccion?: MetadatosExtraccion;

  creadoEn: string;
  actualizadoEn: string;
}

export interface Proveedor {
  id: string;
  nit: string;
  dv?: string;
  razonSocial: string;
  nombreComercial?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  categoriaPredeterminadaId?: string;
  centroCostoPredeterminadoId?: string;
  notas?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  color: string;
  icono: string;
  esGasto: boolean; // false = inventario / compra, true = gasto operativo
  activo: boolean;
}

export interface CentroCosto {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  color: string;
  activo: boolean;
}

export interface FiltrosBusqueda {
  texto: string;
  fechaInicio: string;
  fechaFin: string;
  proveedorId: string;
  categoriaId: string;
  centroCostoId: string;
  tipoDocumento: string;
  estadoPago: string;
  origen: string;
}

export type TipoPeriodoReporte =
  | 'dia_especifico'
  | 'mes_actual'
  | 'mes_anterior'
  | 'mes_especifico'
  | 'bimestre_dian'
  | 'cuatrimestre_dian'
  | 'anio_actual'
  | 'personalizado';

export interface EmpresaInfo {
  razonSocial: string;
  nombreComercial?: string;
  nit: string;
  dv?: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  telefono: string;
  email: string;
  matriculaMercantil?: string;
  regimenTributario?: string;
  responsableIva: boolean;
  // Personalización de Marca y Documentos de Venta
  logoUrl?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  slogan?: string;
  sitioWeb?: string;
  whatsapp?: string;
  tituloDocumentoVenta?: string; // ej: 'COMPROBANTE DE VENTA' o 'RECIBO DE CAJA'
  textoPieRecibo?: string; // Términos, agradecimiento o garantías
  resolucionLegal?: string; // Régimen o documento equivalente
}

// ================= VENTAS VETERINARIA =================
export type CategoriaVenta =
  | 'banos' // Baños
  | 'vacunas' // Vacunas
  | 'consultas_clinica' // Consultas clinica
  | 'tratamientos_clinica' // Tratamientos clinica
  | 'purinas_empaque' // Purinas (bultos y paquetes)
  | 'purinas_granel' // Purinas a granel
  | 'vitrina' // Vitrina (accesorios, snacks, juguetes)
  | 'varios' // Varios / Otros conceptos
  | 'pet_shop'
  | 'clinica'
  | 'purinas'
  | 'medicamentos';

export type SubcategoriaTratamiento =
  | 'parvovirus' // 1. Parvovirus
  | 'triaditis' // 2. Triaditis felina o canina
  | 'sintomatologia' // 3. Sintomatología
  | 'moquillo' // 4. Moquillo
  | 'gastroenteritis' // 5. Gastroenteritis
  | 'cirugias' // 6. Cirugías
  | 'varios'; // 7. Varios

export type SubcategoriaVitrina =
  | 'desparasitantes' // 1. Desparasitantes
  | 'nexgard' // 2. Nexgard
  | 'gotas_pulgas' // 3. Gotas pulgas
  | 'shampoo_lociones' // 4. Shampoo, lociones
  | 'medicamentos' // 5. Medicamentos
  | 'dulces' // 6. Dulces (comida húmedas, galletas y demás)
  | 'cream_helado' // 7. Cream helado (paletas, helados)
  | 'varios'; // 8. Varios (accesorios, collares, juguetes, otros)

export type SubcategoriaVenta = SubcategoriaTratamiento | SubcategoriaVitrina | string;

export type MedioPagoVenta =
  | 'efectivo'
  | 'nequi'
  | 'bancos'
  | 'credito';

export type EstadoVenta = 'pagada' | 'pendiente';

export interface VentaItem {
  id: string;
  categoria: CategoriaVenta;
  subcategoria?: SubcategoriaVenta;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Venta {
  id: string;
  consecutivo: string; // ej: VNT-001
  fecha: string; // YYYY-MM-DD
  clienteNombre?: string;
  clienteTelefono?: string;
  mascotaNombre?: string;
  items?: VentaItem[]; // Lista de conceptos / ítems en una misma venta o recibo
  categoria: CategoriaVenta; // Categoría principal (o 'varios' si tiene múltiples)
  subcategoria?: SubcategoriaVenta; // Subdivisión de la categoría principal
  concepto: string; // Qué se vendió (resumen de ítems)
  monto: number; // Valor total de la venta (suma de todos los ítems)
  medioPago: MedioPagoVenta;
  estado: EstadoVenta; // 'pagada' o 'pendiente' (si fue a crédito)
  observaciones?: string;
  creadoEn: string;
  actualizadoEn: string;
}
