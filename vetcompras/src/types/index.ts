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
  | 'nota_credito' // Valores negativos: disminuyen compras e IVA descontable
  | 'nota_debito'
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
  /** Línea que resume toda la factura (lectura de PDF sin detalle): no mueve inventario */
  resumen?: boolean;
  /** Producto del inventario asociado a la línea */
  productoId?: string;
}

export interface ArchivoAdjunto {
  nombre: string;
  tipo: 'xml' | 'pdf' | 'imagen' | 'zip';
  tamano: number;
  dataUrl?: string; // Data URL en base64 para previsualizar/descargar
  contenidoXml?: string; // Texto XML original para reanálisis o descarga
  tieneContenido?: boolean; // El servidor guarda el PDF/XML aparte; se descarga al abrir el documento
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
  motor: 'xml_parser' | 'gemini_flash' | 'pdf_local';
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
  documentoReferencia?: string; // Factura afectada por una nota crédito/débito

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
  | 'daviplata'
  | 'bancos'
  | 'tarjeta'
  | 'credito';

/** 'parcial' = abonó una parte y el resto quedó a crédito */
export type EstadoVenta = 'pagada' | 'pendiente' | 'parcial';

export interface VentaItem {
  id: string;
  categoria: CategoriaVenta;
  subcategoria?: SubcategoriaVenta;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number; // Valor en pesos descontado a la línea
  subtotal: number; // cantidad × precio − descuento
  /** Producto del inventario (si el ítem es un producto y no un servicio) */
  productoId?: string;
}

/** Una de las formas de pago con que se pagó la venta (puede haber varias). */
export interface PagoVenta {
  id: string;
  medio: Exclude<MedioPagoVenta, 'credito'>;
  monto: number;
  referencia?: string; // N.º de comprobante Nequi, voucher, etc.
  recibido?: number; // Solo efectivo: lo que entregó el cliente (para calcular el cambio)
}

export interface Venta {
  id: string;
  consecutivo: string; // ej: VNT-001
  fecha: string; // YYYY-MM-DD
  clienteNombre?: string;
  clienteDocumento?: string; // CC o NIT
  clienteTelefono?: string;
  clienteEmail?: string;
  mascotaNombre?: string;
  items?: VentaItem[]; // Conceptos vendidos (ventas antiguas pueden no tenerlos: ver utils/ventas.ts)
  categoria: CategoriaVenta; // Categoría del ítem de mayor valor (compatibilidad con reportes anteriores)
  subcategoria?: SubcategoriaVenta;
  concepto: string; // Resumen legible de los ítems
  monto: number; // Total de la venta (suma de los ítems)
  pagos?: PagoVenta[]; // Formas de pago; lo no cubierto queda a crédito
  saldoPendiente?: number; // Valor a crédito por cobrar
  medioPago: MedioPagoVenta | 'mixto'; // Medio principal ('mixto' si se pagó con varios)
  estado: EstadoVenta;
  observaciones?: string;
  creadoEn: string;
  actualizadoEn: string;
}

// ============================================================ INVENTARIO
// Control informativo (no restrictivo): el saldo puede quedar negativo y nunca
// impide vender. Las compras suman, las ventas restan; las bajas y ajustes se
// registran a mano. Todo movimiento se puede editar.

export interface Producto {
  id: string;
  codigo?: string;
  nombre: string;
  /** Agrupación libre: Medicamentos, Alimentos, Accesorios, Vacunas… */
  grupo?: string;
  unidad: string;
  precioVenta?: number;
  /** Último costo unitario de compra (sin IVA) */
  costoUltimo?: number;
  stockMinimo?: number;
  /** Otros nombres con que llega en facturas de proveedores o se vende */
  alias?: string[];
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export type TipoMovimiento = 'entrada' | 'salida' | 'baja' | 'ajuste';
export type OrigenMovimiento = 'compra' | 'venta' | 'manual' | 'importacion' | 'inicial';

export interface MovimientoInventario {
  id: string;
  fecha: string; // AAAA-MM-DD
  productoId: string;
  tipo: TipoMovimiento;
  /** Unidades: positivas en entradas, salidas y bajas; con signo en los ajustes */
  cantidad: number;
  costoUnitario?: number;
  origen: OrigenMovimiento;
  /** Compra o venta que lo generó */
  origenId?: string;
  origenLineaId?: string;
  referencia?: string;
  /** Bajas: daño, pérdida, vencimiento, consumo interno… */
  motivo?: string;
  observaciones?: string;
  /** Lo modificó una persona: al editar la compra o venta de origen no se recalcula */
  editado?: boolean;
  creadoEn: string;
  actualizadoEn: string;
}
