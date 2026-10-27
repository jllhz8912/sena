import React, { useState } from 'react';
import { X, DollarSign, Calendar, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { CompraDocumento } from '../../types';
import { formatCOP, fechaLocal } from '../../utils/formatters';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface RegistrarAbonoModalProps {
  documento: CompraDocumento;
  /** 'total' = cancelación total de la factura (paga todo el saldo) */
  modo?: 'abono' | 'total';
  onAbonoRegistrado: () => void;
  onCerrar: () => void;
}

export const RegistrarAbonoModal: React.FC<RegistrarAbonoModalProps> = ({
  documento,
  modo = 'abono',
  onAbonoRegistrado,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();

  const saldoActual = documento.saldoPendiente || 0;
  const esTotal = modo === 'total';
  const [monto, setMonto] = useState<number>(esTotal ? saldoActual : 0);
  const [fecha, setFecha] = useState<string>(fechaLocal());
  const [medio, setMedioPago] = useState<string>('transferencia');
  const [referencia, setReferencia] = useState<string>('');
  const [nota, setNota] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);

  const saldoRestante = Math.max(0, saldoActual - monto);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (monto <= 0) {
      mostrarToast('warning', 'Monto inválido', 'El monto del abono debe ser mayor a cero.');
      return;
    }
    if (monto > saldoActual) {
      mostrarToast('warning', 'Monto mayor al saldo', `El saldo pendiente es ${formatCOP(saldoActual)}.`);
      return;
    }

    try {
      setGuardando(true);
      await dataService.registrarAbono(documento.id, {
        fecha,
        monto: Math.round(monto),
        medio,
        referencia: referencia.trim() || undefined,
        nota: nota.trim() || undefined,
      });

      mostrarToast(
        'success',
        'Pago registrado',
        `Se registró el pago de ${formatCOP(monto)} para la factura ${documento.folio}.`
      );
      onAbonoRegistrado();
      onCerrar();
    } catch (err: any) {
      mostrarToast('error', 'Error al registrar abono', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {esTotal ? 'Cancelar factura (pago total)' : 'Registrar abono parcial'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Factura <strong>{documento.folio}</strong> • {documento.proveedor?.razonSocial}
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de Saldo */}
        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-300">
              Saldo Pendiente Actual
            </span>
            <p className="text-xl font-black text-emerald-950 dark:text-emerald-100">
              {formatCOP(saldoActual)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMonto(saldoActual)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-sm"
          >
            Pagar saldo total
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {esTotal ? 'Valor a pagar (saldo completo)' : 'Valor del abono (COP) *'}
            </label>
            <input
              type="number"
              required
              min={1}
              max={saldoActual}
              value={monto || ''}
              readOnly={esTotal}
              placeholder="0"
              onChange={(e) => setMonto(Number(e.target.value))}
              className="w-full text-lg font-black px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Nuevo saldo tras este pago: <strong>{formatCOP(saldoRestante)}</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha del Pago *
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Medio de Pago
              </label>
              <select
                value={medio}
                onChange={(e) => setMedioPago(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              >
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="efectivo">Efectivo (Caja Menor)</option>
                <option value="tarjeta_debito">Tarjeta Débito</option>
                <option value="tarjeta_credito">Tarjeta Crédito</option>
                <option value="consignacion">Consignación</option>
                <option value="nequi_daviplata">Nequi / Daviplata</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Referencia / Comprobante (Opcional)
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: Aprobación Bancolombia #994821"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas u Observaciones
            </label>
            <textarea
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Detalle del pago..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{guardando ? 'Guardando...' : esTotal || monto === saldoActual ? 'Confirmar pago total' : 'Confirmar abono'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
