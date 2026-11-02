/**
 * Formas de pago de una compra o gasto (contado, crédito, crédito-contado con
 * varios medios) y control del estado de cada factura (pagada, con saldo, por
 * pagar, vencida).
 */
import { CompraDocumento, EstadoPago, FormaPago, RegistroPago } from '../types';
import { diasHasta } from './cartera';

export const FORMAS_PAGO: { id: FormaPago; label: string; ayuda: string }[] = [
  { id: 'contado', label: 'Contado', ayuda: 'Se paga todo hoy (uno o varios medios).' },
  { id: 'credito', label: 'Crédito', ayuda: 'Queda debiendo todo hasta la fecha de vencimiento.' },
  { id: 'credito_contado', label: 'Crédito-contado', ayuda: 'Abona una parte hoy y el saldo queda a crédito.' },
];

export const MEDIOS_PAGO_COMPRA = [
  'Transferencia (Electrónico)',
  'Efectivo',
  'Tarjeta Débito (Electrónico)',
  'Tarjeta Crédito (Electrónico)',
  'Nequi / Daviplata (Electrónico)',
  'Cheque / Otro',
];

/**
 * Pagos que se escriben en el propio registro de la compra (contado o abono inicial).
 * Al cambiar la forma de pago se reemplazan; los abonos hechos después en Cuentas por
 * pagar se conservan.
 */
const NOTAS_PAGO_DEL_REGISTRO = ['Pago de contado', 'Abono inicial', 'Pago inicial registrado al crear documento', 'Pago registrado al editar el documento'];
export const esPagoDelRegistro = (p: Pick<RegistroPago, 'nota'>) => NOTAS_PAGO_DEL_REGISTRO.includes(p.nota || '');

export const etiquetaFormaPago = (f: string | undefined) => FORMAS_PAGO.find((x) => x.id === f)?.label || (f ? f : 'Contado');

export interface ResultadoPagos {
  pagos: RegistroPago[];
  pagado: number;
  saldo: number;
  estado: EstadoPago;
  /** Medio que resume la compra en listados y reportes */
  medio: string;
  /** Problema que impide guardar (vacío si todo cuadra) */
  error: string;
}

const suma = (p: { monto: number }[]) => p.reduce((s, x) => s + (Number(x.monto) || 0), 0);

/**
 * Pagos finales de la compra según la forma de pago. `pagos` son los que la persona
 * escribió (en contado y crédito-contado). Contado sin pagos escritos = un pago por el
 * neto con el medio indicado. Las notas crédito no generan pagos ni saldo.
 */
export function calcularPagosCompra(opciones: {
  neto: number;
  formaPago: FormaPago;
  pagos: RegistroPago[];
  medioPorDefecto: string;
  fecha: string;
  esNotaCredito?: boolean;
}): ResultadoPagos {
  const neto = Math.max(0, Math.round(opciones.neto));
  const validos = opciones.pagos.filter((p) => (Number(p.monto) || 0) > 0).map((p) => ({ ...p, monto: Math.round(Number(p.monto)) }));
  if (opciones.esNotaCredito) return { pagos: [], pagado: 0, saldo: 0, estado: 'pagada', medio: 'Nota crédito', error: '' };

  let pagos: RegistroPago[] = validos;
  let error = '';
  if (opciones.formaPago === 'credito') {
    // Nada se paga al registrar: solo quedan los abonos hechos después en Cuentas por pagar
    // (si la compra era de contado y se cambia a crédito, el pago de contado se quita)
    pagos = validos.filter((p) => !esPagoDelRegistro(p));
  } else if (opciones.formaPago === 'contado') {
    if (!validos.length && neto > 0) pagos = [{ id: `pago-${Date.now()}`, fecha: opciones.fecha, monto: neto, medio: opciones.medioPorDefecto, nota: 'Pago de contado' }];
    else if (Math.abs(suma(validos) - neto) >= 1) error = `En contado los pagos deben sumar ${neto.toLocaleString('es-CO')}; suman ${suma(validos).toLocaleString('es-CO')}.`;
  } else {
    if (!validos.length) error = 'En crédito-contado registre el abono que se paga hoy.';
    else if (suma(validos) >= neto) error = 'El abono cubre todo el valor: elija Contado.';
  }
  const pagado = suma(pagos);
  if (!error && pagado > neto + 0.5) error = 'Los pagos superan el valor a pagar.';
  const saldo = Math.max(0, neto - pagado);
  const estado: EstadoPago = saldo === 0 ? 'pagada' : pagado > 0 ? 'parcial' : 'pendiente';
  const medios = [...new Set(pagos.map((p) => p.medio))];
  const medio = opciones.formaPago === 'credito' && !pagado ? 'Crédito Proveedor' : medios.length > 1 ? 'Varios medios' : medios[0] || opciones.medioPorDefecto;
  return { pagos, pagado, saldo, estado, medio, error };
}

export type EstadoFactura = 'pagada' | 'con_saldo' | 'por_pagar' | 'vencida';

export const ESTADOS_FACTURA: { id: EstadoFactura; label: string; ayuda: string }[] = [
  { id: 'por_pagar', label: 'Por pagar', ayuda: 'Sin ningún abono' },
  { id: 'con_saldo', label: 'Con saldo', ayuda: 'Abonadas, falta una parte' },
  { id: 'vencida', label: 'Vencidas', ayuda: 'Con saldo y fecha de pago pasada' },
  { id: 'pagada', label: 'Pagadas', ayuda: 'Sin saldo' },
];

/** Estado de control de la factura: vencida tiene prioridad sobre por pagar y con saldo. */
export function estadoFactura(doc: CompraDocumento, hoy?: Date): EstadoFactura {
  if (!(doc.saldoPendiente > 0)) return 'pagada';
  const dias = diasHasta(doc.fechaVencimiento, hoy);
  if (dias !== null && dias < 0) return 'vencida';
  return (doc.pagos || []).some((p) => (Number(p.monto) || 0) > 0) ? 'con_saldo' : 'por_pagar';
}

export interface ResumenEstadoFactura {
  cantidad: number;
  total: number;
  saldo: number;
}

/** Cantidad, valor y saldo por estado (vencidas se cuentan aparte de por pagar / con saldo). */
export function resumenFacturas(documentos: CompraDocumento[], hoy?: Date): Record<EstadoFactura | 'todas', ResumenEstadoFactura> {
  const r = Object.fromEntries(['todas', 'pagada', 'con_saldo', 'por_pagar', 'vencida'].map((k) => [k, { cantidad: 0, total: 0, saldo: 0 }])) as Record<
    EstadoFactura | 'todas',
    ResumenEstadoFactura
  >;
  for (const d of documentos) {
    if (d.tipoDocumento === 'nota_credito') continue;
    const e = estadoFactura(d, hoy);
    for (const k of ['todas', e] as const) {
      r[k].cantidad += 1;
      r[k].total += Math.abs(Number(d.total) || 0);
      r[k].saldo += Math.max(0, Number(d.saldoPendiente) || 0);
    }
  }
  return r;
}
