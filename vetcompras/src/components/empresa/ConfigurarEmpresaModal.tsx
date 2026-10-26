import React, { useState } from 'react';
import { Building2, Save, X, CheckCircle2, ShieldCheck, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { EmpresaInfo } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface ConfigurarEmpresaModalProps {
  onCerrar: () => void;
  onEmpresaActualizada: () => void;
}

export const ConfigurarEmpresaModal: React.FC<ConfigurarEmpresaModalProps> = ({
  onCerrar,
  onEmpresaActualizada,
}) => {
  const { mostrarToast } = useToast();
  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.razonSocial.trim()) {
      mostrarToast('error', 'Campo requerido', 'Ingresa la razón social o nombre de la veterinaria.');
      return;
    }
    if (!empresa.nit.trim()) {
      mostrarToast('error', 'Campo requerido', 'Ingresa el NIT o cédula de la veterinaria.');
      return;
    }

    try {
      setGuardando(true);
      await dataService.guardarDatosEmpresa(empresa);
      mostrarToast('success', 'Datos guardados', 'Los datos de la empresa veterinaria se han actualizado.');
      onEmpresaActualizada();
      onCerrar();
    } catch (err: any) {
      console.error('Error al guardar datos de empresa:', err);
      mostrarToast('error', 'Error al guardar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Datos de la Empresa / Veterinaria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Información del adquirente para facturas electrónicas, reportes y certificados DIAN.
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Razón Social Oficial *
              </label>
              <input
                type="text"
                required
                value={empresa.razonSocial}
                onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })}
                placeholder="Ej: CLÍNICA VETERINARIA SAN ROQUE S.A.S."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre Comercial / Marca
              </label>
              <input
                type="text"
                value={empresa.nombreComercial || ''}
                onChange={(e) => setEmpresa({ ...empresa, nombreComercial: e.target.value })}
                placeholder="Ej: VetSanRoque Hospital 24H"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NIT o Cédula *
              </label>
              <input
                type="text"
                required
                value={empresa.nit}
                onChange={(e) => setEmpresa({ ...empresa, nit: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="Ej: 901458789"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                DV (Dígito)
              </label>
              <input
                type="text"
                maxLength={1}
                value={empresa.dv || ''}
                onChange={(e) => setEmpresa({ ...empresa, dv: e.target.value })}
                placeholder="3"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ciudad Sede Principal
              </label>
              <input
                type="text"
                value={empresa.ciudad}
                onChange={(e) => setEmpresa({ ...empresa, ciudad: e.target.value })}
                placeholder="Bogotá D.C."
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
                onChange={(e) => setEmpresa({ ...empresa, departamento: e.target.value })}
                placeholder="Cundinamarca"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dirección de la Sede Clínica
            </label>
            <input
              type="text"
              value={empresa.direccion}
              onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })}
              placeholder="Ej: Calle 140 # 15-22 Cedritos"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono / WhatsApp de Contacto
              </label>
              <input
                type="text"
                value={empresa.telefono}
                onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })}
                placeholder="Ej: (601) 7452300 - 310 5551234"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico (Facturación DIAN)
              </label>
              <input
                type="email"
                value={empresa.email}
                onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                placeholder="facturacion@vetsanroque.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Matrícula Mercantil (Cámara de Comercio)
              </label>
              <input
                type="text"
                value={empresa.matriculaMercantil || ''}
                onChange={(e) => setEmpresa({ ...empresa, matriculaMercantil: e.target.value })}
                placeholder="Ej: 03154896"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Régimen Tributario
              </label>
              <select
                value={empresa.regimenTributario || 'Responsable de IVA - Régimen Ordinario'}
                onChange={(e) =>
                  setEmpresa({
                    ...empresa,
                    regimenTributario: e.target.value,
                    responsableIva: e.target.value.includes('Responsable de IVA'),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="Responsable de IVA - Régimen Ordinario">Responsable de IVA - Régimen Ordinario</option>
                <option value="Régimen Simple de Tributación (RST)">Régimen Simple de Tributación (RST)</option>
                <option value="No Responsable de IVA (Persona Natural)">No Responsable de IVA (Persona Natural)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-900 dark:text-emerald-200">
              Estos datos se usarán como adquirente en los reportes DIAN, validación de facturas electrónicas de proveedores y encabezados de exportación a Excel.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Datos de la Veterinaria</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
