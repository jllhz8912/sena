import React, { useState } from 'react';
import { Building2, X, Save, ShieldCheck, Mail, Phone, MapPin, Hash, CheckCircle2 } from 'lucide-react';
import { EmpresaInfo } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface ModalDatosEmpresaProps {
  abierto: boolean;
  onCerrar: () => void;
  onGuardado?: (empresaActualizada: EmpresaInfo) => void;
}

export const ModalDatosEmpresa: React.FC<ModalDatosEmpresaProps> = ({
  abierto,
  onCerrar,
  onGuardado,
}) => {
  const { mostrarToast } = useToast();
  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());
  const [guardando, setGuardando] = useState(false);

  if (!abierto) return null;

  const handleChange = (campo: keyof EmpresaInfo, valor: any) => {
    setEmpresa((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.razonSocial.trim() || !empresa.nit.trim()) {
      mostrarToast('warning', 'Campos requeridos', 'Razón Social y NIT de la veterinaria son obligatorios.');
      return;
    }

    try {
      setGuardando(true);
      await dataService.guardarDatosEmpresa(empresa);
      mostrarToast(
        'success',
        'Datos de la empresa guardados',
        'La información de la clínica veterinaria ha sido actualizada exitosamente.'
      );
      if (onGuardado) onGuardado(empresa);
      onCerrar();
    } catch (error: any) {
      mostrarToast('error', 'Error al guardar', error?.message || 'No se pudieron guardar los datos.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Cabecera */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Datos de la Empresa / Veterinaria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Información tributaria y comercial que aparecerá en los reportes DIAN y exportaciones.
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {/* Banner DIAN */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3 text-emerald-900 dark:text-emerald-300">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              Estos datos corresponden a tu veterinaria como adquirente en las facturas electrónicas de compra y para la presentación de los <strong>Formularios 300 (IVA)</strong> y <strong>350 (Retenciones)</strong> ante la DIAN.
            </p>
          </div>

          {/* Razón Social y Nombre Comercial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Razón Social de la Veterinaria *
              </label>
              <input
                type="text"
                required
                value={empresa.razonSocial}
                onChange={(e) => handleChange('razonSocial', e.target.value)}
                placeholder="Ej: CLÍNICA VETERINARIA HUELLITAS S.A.S."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre Comercial (Opcional)
              </label>
              <input
                type="text"
                value={empresa.nombreComercial || ''}
                onChange={(e) => handleChange('nombreComercial', e.target.value)}
                placeholder="Ej: Huellitas Hospital Veterinario 24H"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* NIT y Dígito de Verificación */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8 sm:col-span-9">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NIT de la Veterinaria *
              </label>
              <input
                type="text"
                required
                value={empresa.nit}
                onChange={(e) => handleChange('nit', e.target.value.replace(/[^0-9-]/g, ''))}
                placeholder="Ej: 901234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="col-span-4 sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                DV (Dígito)
              </label>
              <input
                type="text"
                maxLength={2}
                value={empresa.dv || ''}
                onChange={(e) => handleChange('dv', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ej: 1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Ubicación: Dirección, Ciudad y Departamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={empresa.direccion}
                onChange={(e) => handleChange('direccion', e.target.value)}
                placeholder="Ej: Calle 123 # 45-67"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ciudad / Municipio
              </label>
              <input
                type="text"
                value={empresa.ciudad}
                onChange={(e) => handleChange('ciudad', e.target.value)}
                placeholder="Ej: Bogotá D.C."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Departamento
              </label>
              <input
                type="text"
                value={empresa.departamento}
                onChange={(e) => handleChange('departamento', e.target.value)}
                placeholder="Ej: Cundinamarca"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Contacto: Teléfono y Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={empresa.telefono}
                onChange={(e) => handleChange('telefono', e.target.value)}
                placeholder="Ej: (601) 3456789 / 3101234567"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico (Facturación)
              </label>
              <input
                type="email"
                value={empresa.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Ej: contabilidad@huellitasvet.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Régimen Tributario y Responsabilidad de IVA */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Configuración Tributaria DIAN</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Régimen Tributario
                </label>
                <select
                  value={empresa.regimenTributario || 'Responsable de IVA'}
                  onChange={(e) => handleChange('regimenTributario', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                >
                  <option value="Responsable de IVA">Responsable de IVA (Régimen Común)</option>
                  <option value="Régimen Simple de Tributación (RST)">Régimen Simple de Tributación (RST)</option>
                  <option value="No Responsable de IVA">No Responsable de IVA (Persona Natural)</option>
                  <option value="Gran Contribuyente">Gran Contribuyente</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Matrícula Mercantil (Opcional)
                </label>
                <input
                  type="text"
                  value={empresa.matriculaMercantil || ''}
                  onChange={(e) => handleChange('matriculaMercantil', e.target.value)}
                  placeholder="Ej: 03124567 de Cámara de Comercio"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={empresa.responsableIva}
                onChange={(e) => handleChange('responsableIva', e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                La empresa es Responsable del Impuesto sobre las Ventas (IVA)
              </span>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              <span>{guardando ? 'Guardando...' : 'Guardar Datos de la Veterinaria'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
