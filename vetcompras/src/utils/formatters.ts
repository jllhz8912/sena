/**
 * Formateadores de moneda colombiana, fechas y utilidades para VetCompras
 */

/**
 * Fecha AAAA-MM-DD en la hora local del equipo. No usar toISOString() para
 * "hoy": está en UTC y en Colombia (UTC-5) después de las 7 p. m. da el día siguiente.
 */
export function fechaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Formatea un valor numérico a pesos colombianos (COP) sin decimales
 * Ejemplo: 1234567 -> "$ 1.234.567"
 */
export function formatCOP(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return '$ 0';
  }
  const entero = Math.round(valor);
  return '$ ' + entero.toLocaleString('es-CO');
}

/**
 * Convierte un valor numérico a texto en español (pesos colombianos)
 * Ejemplo: 65000 -> "SESENTA Y CINCO MIL PESOS M/CTE"
 */
export function numeroALetras(monto: number): string {
  const entero = Math.round(Math.abs(monto));
  if (entero === 0) return 'CERO PESOS M/CTE';

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diezY = ['', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function convertirGrupo(n: number): string {
    let salida = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (n === 100) return 'CIEN';

    if (c > 0) salida += centenas[c] + ' ';

    if (d === 1 && u > 0) {
      salida += diezY[u] + ' ';
    } else if (d === 2 && u > 0) {
      salida += 'VEINTI' + unidades[u] + ' ';
    } else {
      if (d > 0) salida += decenas[d] + (u > 0 ? ' Y ' : ' ');
      if (u > 0) salida += unidades[u] + ' ';
    }

    return salida.trim();
  }

  // Montos de mil millones o más: "X MIL MILLONES ..."
  if (entero >= 1000000000) {
    const milesDeMillones = Math.floor(entero / 1000000000);
    const resto = entero % 1000000000;
    const prefijo = milesDeMillones === 1 ? 'MIL' : `${numeroALetras(milesDeMillones).replace(/( DE)? PESOS M\/CTE$/, '')} MIL`;
    if (resto === 0) return `${prefijo} MILLONES DE PESOS M/CTE`;
    const restoTexto = numeroALetras(resto).replace(/( DE)? PESOS M\/CTE$/, '');
    const de = resto % 1000000 === 0 ? ' DE' : '';
    return `${prefijo} ${resto >= 1000000 ? restoTexto : 'MILLONES ' + restoTexto}${de} PESOS M/CTE`;
  }

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const cientos = entero % 1000;

  let resultado = '';

  if (millones > 0) {
    if (millones === 1) resultado += 'UN MILLÓN ';
    else resultado += `${convertirGrupo(millones)} MILLONES `;
  }

  if (miles > 0) {
    if (miles === 1) resultado += 'MIL ';
    else resultado += `${convertirGrupo(miles)} MIL `;
  }

  if (cientos > 0 || (millones === 0 && miles === 0)) {
    resultado += convertirGrupo(cientos) + ' ';
  }

  const de = millones > 0 && miles === 0 && cientos === 0 ? ' DE' : '';
  return (resultado.trim() + de + ' PESOS M/CTE').toUpperCase();
}

/**
 * Formatea una fecha YYYY-MM-DD o ISO a formato colombiano DD/MM/AAAA
 */
export function formatFecha(fechaStr: string | null | undefined): string {
  if (!fechaStr) return '—';

  // Si viene en formato YYYY-MM-DD
  const partes = fechaStr.split('T')[0].split('-');
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }

  try {
    const d = new Date(fechaStr);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return fechaStr;
  }
}

/**
 * Calcula los días faltantes para el vencimiento de una factura
 * Retorna número positivo si faltan días, 0 si vence hoy, negativo si está vencida
 */
export function diasParaVencimiento(fechaVencimiento: string | null | undefined): number | null {
  if (!fechaVencimiento) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [y, m, d] = fechaVencimiento.split('T')[0].split('-').map(Number);
  const fechaVenc = new Date(y, m - 1, d);

  const diffMs = fechaVenc.getTime() - hoy.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Etiqueta amigable para tipo de documento
 */
export function getTipoDocumentoLabel(tipo: string): string {
  switch (tipo) {
    case 'factura_electronica':
      return 'Factura Electrónica';
    case 'factura_papel':
      return 'Factura de Papel';
    case 'documento_soporte':
      return 'Documento Soporte';
    case 'cuenta_cobro':
      return 'Cuenta de Cobro';
    case 'recibo_caja':
      return 'Recibo de Caja';
    case 'tiquete_pos':
      return 'Tiquete POS';
    case 'servicios_publicos':
      return 'Servicios Públicos';
    case 'nomina_honorarios':
      return 'Nómina / Honorarios';
    case 'nota_credito':
      return 'Nota Crédito';
    case 'nota_debito':
      return 'Nota Débito';
    default:
      return 'Otro Documento';
  }
}

/**
 * Etiqueta amigable para estado de pago
 */
export function getEstadoPagoLabel(estado: string): { texto: string; colorClass: string } {
  switch (estado) {
    case 'pagada':
      return { texto: 'Pagada', colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' };
    case 'parcial':
      return { texto: 'Pago Parcial', colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800' };
    case 'pendiente':
    default:
      return { texto: 'Pendiente', colorClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800' };
  }
}

/**
 * Información amigable y distinción si el medio de pago es Electrónico, Efectivo, Tarjeta o Crédito
 */
export function getMedioPagoInfo(medio: string | undefined): {
  label: string;
  tipo: 'electronico' | 'efectivo' | 'tarjeta' | 'credito' | 'otro';
  colorBadge: string;
} {
  if (!medio) {
    return {
      label: 'Electrónico (Transferencia)',
      tipo: 'electronico',
      colorBadge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    };
  }

  const m = medio.toLowerCase().trim();

  if (m.includes('efect') || m.includes('cash')) {
    return {
      label: 'Efectivo',
      tipo: 'efectivo',
      colorBadge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    };
  }

  if (m.includes('tarj') || m.includes('deb') || m.includes('card')) {
    return {
      label: 'Tarjeta (Electrónico)',
      tipo: 'tarjeta',
      colorBadge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    };
  }

  if (m.includes('cred') || m.includes('plazo')) {
    return {
      label: 'Crédito Proveedor',
      tipo: 'credito',
      colorBadge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    };
  }

  if (m.includes('transf') || m.includes('banc') || m.includes('nequi') || m.includes('daviplata') || m.includes('electr')) {
    return {
      label: 'Transferencia (Electrónico)',
      tipo: 'electronico',
      colorBadge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    };
  }

  return {
    label: medio.charAt(0).toUpperCase() + medio.slice(1),
    tipo: 'otro',
    colorBadge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };
}

export function getCategoriaVentaInfo(categoria: string) {
  switch (categoria) {
    case 'banos':
      return {
        label: 'Baños',
        badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        dotColor: 'bg-purple-500',
      };
    case 'vacunas':
      return {
        label: 'Vacunas',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
      };
    case 'consultas_clinica':
      return {
        label: 'Consultas clínica',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        dotColor: 'bg-sky-500',
      };
    case 'tratamientos_clinica':
      return {
        label: 'Tratamientos clínica',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        dotColor: 'bg-indigo-500',
      };
    case 'purinas_empaque':
      return {
        label: 'Purinas (bultos y paquetes)',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dotColor: 'bg-amber-500',
      };
    case 'purinas_granel':
      return {
        label: 'Purinas a granel',
        badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
        dotColor: 'bg-orange-500',
      };
    case 'vitrina':
      return {
        label: 'Vitrina',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dotColor: 'bg-rose-500',
      };
    case 'varios':
      return {
        label: 'Varios / Otros',
        badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-500',
      };
    // Compatibilidad con registros previos
    case 'pet_shop':
      return {
        label: 'Vitrina',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dotColor: 'bg-rose-500',
      };
    case 'clinica':
      return {
        label: 'Consultas clínica',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        dotColor: 'bg-sky-500',
      };
    case 'purinas':
      return {
        label: 'Purinas (bultos y paquetes)',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dotColor: 'bg-amber-500',
      };
    case 'medicamentos':
      return {
        label: 'Tratamientos clínica',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        dotColor: 'bg-indigo-500',
      };
    default:
      return {
        label: categoria || 'General',
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        dotColor: 'bg-slate-400',
      };
  }
}

export function getMedioPagoVentaInfo(medio: string) {
  switch (medio) {
    case 'efectivo':
      return {
        label: 'Efectivo',
        tipo: 'efectivo',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'nequi':
      return {
        label: 'Transferencia Nequi',
        tipo: 'electronico',
        badgeColor: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800',
      };
    case 'bancos':
      return {
        label: 'Transferencia Bancaria',
        tipo: 'electronico',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      };
    case 'daviplata':
      return {
        label: 'Daviplata',
        tipo: 'electronico',
        badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800',
      };
    case 'tarjeta':
      return {
        label: 'Tarjeta débito/crédito',
        tipo: 'tarjeta',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      };
    case 'mixto':
      return {
        label: 'Varios medios',
        tipo: 'mixto',
        badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      };
    case 'credito':
      return {
        label: 'A Crédito (Pendiente)',
        tipo: 'credito',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
    default:
      return {
        label: medio || 'Otro',
        tipo: 'otro',
        badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      };
  }
}

/** Categorías de venta disponibles para nuevos ítems (en el orden en que se muestran). */
export const CATEGORIAS_VENTA: { id: string; label: string }[] = [
  { id: 'consultas_clinica', label: 'Consultas clínica' },
  { id: 'tratamientos_clinica', label: 'Tratamientos clínica' },
  { id: 'vacunas', label: 'Vacunas' },
  { id: 'banos', label: 'Baños y peluquería' },
  { id: 'purinas_empaque', label: 'Purinas (bultos y paquetes)' },
  { id: 'purinas_granel', label: 'Purinas a granel' },
  { id: 'vitrina', label: 'Vitrina' },
  { id: 'varios', label: 'Varios / Otros' },
];

/** Medios con que el cliente puede pagar (lo no pagado queda a crédito). */
export const MEDIOS_PAGO_VENTA: { id: 'efectivo' | 'nequi' | 'daviplata' | 'bancos' | 'tarjeta'; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'nequi', label: 'Nequi' },
  { id: 'daviplata', label: 'Daviplata' },
  { id: 'bancos', label: 'Transferencia bancaria' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

export interface SubcategoriaItem {
  value: string;
  label: string;
  nombreCorto: string;
  badgeColor: string;
}

// 1. Subcategorías para Baños (con opción Varios)
export const SUBCATEGORIAS_BANOS: SubcategoriaItem[] = [
  { value: 'bano_estetico', label: '1. Baño estético', nombreCorto: 'Baño Estético', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
  { value: 'bano_medicado', label: '2. Baño medicado', nombreCorto: 'Baño Medicado', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
  { value: 'bano_antipulgas', label: '3. Baño antipulgas', nombreCorto: 'Baño Antipulgas', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
  { value: 'peluqueria_corte', label: '4. Peluquería / Corte', nombreCorto: 'Peluquería', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
  { value: 'varios', label: '5. Varios (corte uñas, limpieza oídos, otros)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 2. Subcategorías para Vacunas (con opción Varios)
export const SUBCATEGORIAS_VACUNAS: SubcategoriaItem[] = [
  { value: 'antirrabica', label: '1. Antirrábica', nombreCorto: 'Antirrábica', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'sextuple', label: '2. Séxtuple / Múltiple', nombreCorto: 'Séxtuple', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'triple_felina', label: '3. Triple Felina', nombreCorto: 'Triple Felina', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'parvovirus', label: '4. Parvovirus / Corona', nombreCorto: 'Parvo/Corona', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'tos_perreras', label: '5. Tos de Perreras (KC)', nombreCorto: 'Tos Perreras', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'varios', label: '6. Varios (otras vacunas o refuerzos)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 3. Subcategorías para Consultas Clínica (con opción Varios)
export const SUBCATEGORIAS_CONSULTAS: SubcategoriaItem[] = [
  { value: 'consulta_general', label: '1. Consulta general', nombreCorto: 'Consulta General', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
  { value: 'consulta_urgencias', label: '2. Consulta de urgencias', nombreCorto: 'Consulta Urgencias', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
  { value: 'control_medico', label: '3. Control médico / Revisión', nombreCorto: 'Control Médico', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
  { value: 'certificado_viaje', label: '4. Certificado salud / viaje', nombreCorto: 'Certificado Viaje', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
  { value: 'varios', label: '5. Varios (otras consultas o valoraciones)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 4. Subcategorías oficiales para Tratamientos Clínica (con opción Varios)
export const SUBCATEGORIAS_TRATAMIENTOS: SubcategoriaItem[] = [
  { value: 'parvovirus', label: '1. Parvovirus', nombreCorto: 'Parvovirus', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' },
  { value: 'triaditis', label: '2. Triaditis felina o canina', nombreCorto: 'Triaditis', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
  { value: 'sintomatologia', label: '3. Sintomatología', nombreCorto: 'Sintomatología', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'moquillo', label: '4. Moquillo', nombreCorto: 'Moquillo', badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800' },
  { value: 'gastroenteritis', label: '5. Gastroenteritis', nombreCorto: 'Gastroenteritis', badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800' },
  { value: 'cirugias', label: '6. Cirugías', nombreCorto: 'Cirugías', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'varios', label: '7. Varios (otros tratamientos)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 5. Subcategorías para Purinas (bultos y paquetes) (con opción Varios)
export const SUBCATEGORIAS_PURINAS_EMPAQUE: SubcategoriaItem[] = [
  { value: 'bulto_perro', label: '1. Bulto perro adulto (15-30 kg)', nombreCorto: 'Bulto Perro', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'bulto_cachorro', label: '2. Bulto perro cachorro (15-30 kg)', nombreCorto: 'Bulto Cachorro', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'paquete_pequeno', label: '3. Paquete bolsa (1-8 kg)', nombreCorto: 'Paquete Bolsa', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'bulto_gato', label: '4. Bulto / Paquete gato', nombreCorto: 'Purina Gato', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'alimento_prescrito', label: '5. Alimento medicado / prescrito', nombreCorto: 'Alimento Prescrito', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'varios', label: '6. Varios (otras marcas o empaques)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 6. Subcategorías para Purinas a granel (con opción Varios)
export const SUBCATEGORIAS_PURINAS_GRANEL: SubcategoriaItem[] = [
  { value: 'granel_adulto', label: '1. Purina perro adulto (Kg/Lb)', nombreCorto: 'Granel Adulto', badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800' },
  { value: 'granel_cachorro', label: '2. Purina cachorro (Kg/Lb)', nombreCorto: 'Granel Cachorro', badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800' },
  { value: 'granel_gato', label: '3. Purina felina (Kg/Lb)', nombreCorto: 'Granel Gato', badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800' },
  { value: 'varios', label: '4. Varios (otra purina a granel)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 7. Subcategorías oficiales para Vitrina (con opción Varios)
export const SUBCATEGORIAS_VITRINA: SubcategoriaItem[] = [
  { value: 'desparasitantes', label: '1. Desparasitantes', nombreCorto: 'Desparasitantes', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'nexgard', label: '2. Nexgard', nombreCorto: 'Nexgard', badgeColor: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800' },
  { value: 'gotas_pulgas', label: '3. Gotas pulgas', nombreCorto: 'Gotas pulgas', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800' },
  { value: 'shampoo_lociones', label: '4. Shampoo, lociones', nombreCorto: 'Shampoo / Lociones', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
  { value: 'medicamentos', label: '5. Medicamentos', nombreCorto: 'Medicamentos', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' },
  { value: 'dulces', label: '6. Dulces (comida húmedas, galletas y demás)', nombreCorto: 'Dulces / Snacks', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { value: 'cream_helado', label: '7. Cream helado (paletas, helados)', nombreCorto: 'Cream Helado', badgeColor: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800' },
  { value: 'varios', label: '8. Varios (accesorios, collares, juguetes, otros)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// 8. Subcategorías para Varios / Otros Conceptos
export const SUBCATEGORIAS_VARIOS: SubcategoriaItem[] = [
  { value: 'guarderia', label: '1. Guardería / Hospedaje', nombreCorto: 'Guardería', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  { value: 'transporte', label: '2. Transporte / Domicilio', nombreCorto: 'Transporte', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  { value: 'laboratorio_externo', label: '3. Exámenes / Laboratorio externo', nombreCorto: 'Laboratorio', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  { value: 'varios', label: '4. Varios (concepto nuevo libre)', nombreCorto: 'Varios', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
];

// Diccionario unificado para acceder a las subcategorías de CUALQUIER categoría de ventas
export const SUBCATEGORIAS_POR_CATEGORIA: Record<string, SubcategoriaItem[]> = {
  banos: SUBCATEGORIAS_BANOS,
  vacunas: SUBCATEGORIAS_VACUNAS,
  consultas_clinica: SUBCATEGORIAS_CONSULTAS,
  clinica: SUBCATEGORIAS_CONSULTAS,
  tratamientos_clinica: SUBCATEGORIAS_TRATAMIENTOS,
  medicamentos: SUBCATEGORIAS_TRATAMIENTOS,
  purinas_empaque: SUBCATEGORIAS_PURINAS_EMPAQUE,
  purinas: SUBCATEGORIAS_PURINAS_EMPAQUE,
  purinas_granel: SUBCATEGORIAS_PURINAS_GRANEL,
  vitrina: SUBCATEGORIAS_VITRINA,
  pet_shop: SUBCATEGORIAS_VITRINA,
  varios: SUBCATEGORIAS_VARIOS,
};

export function getSubcategoriaVentaInfo(categoria: string, subcategoria?: string): SubcategoriaItem | null {
  if (!subcategoria) return null;

  const lista = SUBCATEGORIAS_POR_CATEGORIA[categoria];
  if (lista) {
    const found = lista.find((s) => s.value === subcategoria);
    if (found) return found;
  }

  // Búsqueda general si la categoría no coincidió exactamente
  for (const list of Object.values(SUBCATEGORIAS_POR_CATEGORIA)) {
    const found = list.find((s) => s.value === subcategoria);
    if (found) return found;
  }

  return {
    value: subcategoria,
    label: subcategoria === 'varios' ? 'Varios' : subcategoria,
    nombreCorto: subcategoria === 'varios' ? 'Varios' : subcategoria,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };
}

