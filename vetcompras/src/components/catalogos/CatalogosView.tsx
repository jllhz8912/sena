import React, { useState } from 'react';
import {
  Building,
  Building2,
  Tag,
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { Proveedor, Categoria, CentroCosto, EmpresaInfo } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface CatalogosViewProps {
  proveedores: Proveedor[];
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  onDatosActualizados: () => void;
}

export const CatalogosView: React.FC<CatalogosViewProps> = ({
  proveedores,
  categorias,
  centrosCosto,
  onDatosActualizados,
}) => {
  const { mostrarToast } = useToast();
  const [pestanaActiva, setPestanaActiva] = useState<'proveedores' | 'categorias' | 'centros' | 'empresa'>('proveedores');
  const [busqueda, setBusqueda] = useState('');
  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);

  // Modales
  const [modalProveedor, setModalProveedor] = useState<{ abierto: boolean; data?: Proveedor }>({ abierto: false });
  const [modalCategoria, setModalCategoria] = useState<{ abierto: boolean; data?: Categoria }>({ abierto: false });
  const [modalCentro, setModalCentro] = useState<{ abierto: boolean; data?: CentroCosto }>({ abierto: false });

  const handleGuardarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.razonSocial.trim() || !empresa.nit.trim()) {
      mostrarToast('warning', 'Campos obligatorios', 'La Razón Social y el NIT de la veterinaria son requeridos.');
      return;
    }

    try {
      setGuardandoEmpresa(true);
      await dataService.guardarDatosEmpresa(empresa);
      mostrarToast('success', 'Datos guardados', 'La información de la clínica veterinaria se actualizó con éxito.');
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'Error al guardar', err?.message);
    } finally {
      setGuardandoEmpresa(false);
    }
  };

  // Eliminar elementos
  const handleEliminarProveedor = async (id: string, nombre: string) => {
    if (window.confirm(`¿Eliminar proveedor ${nombre}?`)) {
      try {
        await dataService.eliminarProveedor(id);
        mostrarToast('info', 'Proveedor eliminado', `Se eliminó ${nombre}.`);
        onDatosActualizados();
      } catch (err: any) {
        mostrarToast('error', 'Error al eliminar', err?.message);
      }
    }
  };

  const handleEliminarCategoria = async (id: string, nombre: string) => {
    if (window.confirm(`¿Eliminar categoría ${nombre}?`)) {
      try {
        await dataService.eliminarCategoria(id);
        mostrarToast('info', 'Categoría eliminada', `Se eliminó ${nombre}.`);
        onDatosActualizados();
      } catch (err: any) {
        mostrarToast('error', 'Error al eliminar', err?.message);
      }
    }
  };

  const handleEliminarCentro = async (id: string, nombre: string) => {
    if (window.confirm(`¿Eliminar centro de costo ${nombre}?`)) {
      try {
        await dataService.eliminarCentroCosto(id);
        mostrarToast('info', 'Centro eliminado', `Se eliminó ${nombre}.`);
        onDatosActualizados();
      } catch (err: any) {
        mostrarToast('error', 'Error al eliminar', err?.message);
      }
    }
  };

  // Filtrado de proveedores
  const proveedoresFiltrados = proveedores.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    return (
      p.razonSocial.toLowerCase().includes(q) ||
      p.nit.includes(q) ||
      (p.nombreComercial || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Selector de Pestañas */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => {
            setPestanaActiva('proveedores');
            setBusqueda('');
          }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-xs tracking-tight transition-all ${
            pestanaActiva === 'proveedores'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Proveedores ({proveedores.length})</span>
        </button>

        <button
          onClick={() => setPestanaActiva('categorias')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-xs tracking-tight transition-all ${
            pestanaActiva === 'categorias'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Categorías ({categorias.length})</span>
        </button>

        <button
          onClick={() => setPestanaActiva('centros')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-xs tracking-tight transition-all ${
            pestanaActiva === 'centros'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Centros de Costo ({centrosCosto.length})</span>
        </button>

        <button
          onClick={() => setPestanaActiva('empresa')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-xs tracking-tight transition-all ${
            pestanaActiva === 'empresa'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Datos de la Veterinaria</span>
        </button>
      </div>

      {/* PESTAÑA PROVEEDORES */}
      {pestanaActiva === 'proveedores' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por NIT o Razón Social..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              />
            </div>

            <button
              onClick={() => setModalProveedor({ abierto: true })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proveedoresFiltrados.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                        {p.razonSocial}
                      </h4>
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        NIT: {p.nit} {p.dv ? `-${p.dv}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModalProveedor({ abierto: true, data: p })}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Editar proveedor"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEliminarProveedor(p.id, p.razonSocial)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {p.telefono && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        <span>{p.telefono}</span>
                      </p>
                    )}
                    {p.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        <span>{p.email}</span>
                      </p>
                    )}
                    {p.ciudad && (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        <span>{p.ciudad}</span>
                      </p>
                    )}
                  </div>
                </div>

                {p.notas && (
                  <p className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 italic">
                    {p.notas}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA CATEGORÍAS */}
      {pestanaActiva === 'categorias' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Clasificaciones precargadas para compras de medicamentos, concentrados y gastos veterinarios.
            </p>
            <button
              onClick={() => setModalCategoria({ abierto: true })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Categoría</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categorias.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || '#10b981' }}
                  />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      {c.nombre}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {c.esGasto ? 'Gasto Operativo' : 'Insumo / Inventario'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModalCategoria({ abierto: true, data: c })}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleEliminarCategoria(c.id, c.nombre)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA CENTROS DE COSTO */}
      {pestanaActiva === 'centros' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Distribución de costos por áreas operativas de la clínica (Clínica, Tienda, Peluquería, Administración).
            </p>
            <button
              onClick={() => setModalCentro({ abierto: true })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Centro de Costo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {centrosCosto.map((cc) => (
              <div
                key={cc.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {cc.codigo}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModalCentro({ abierto: true, data: cc })}
                      className="p-1 rounded text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEliminarCentro(cc.id, cc.nombre)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {cc.nombre}
                </h4>
                {cc.descripcion && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {cc.descripcion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA DATOS DE LA EMPRESA / VETERINARIA */}
      {pestanaActiva === 'empresa' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{empresa.razonSocial}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    NIT {empresa.nit}{empresa.dv ? `-${empresa.dv}` : ''}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {empresa.direccion} • {empresa.ciudad}, {empresa.departamento} • {empresa.telefono}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                empresa.responsableIva
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}>
                {empresa.responsableIva ? '✓ Responsable de IVA' : 'No Responsable de IVA'}
              </span>
            </div>
          </div>

          {/* Formulario de Configuración de la Empresa */}
          <form onSubmit={handleGuardarEmpresa} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Identificación Tributaria y Comercial
                </h4>
                <p className="text-[11px] text-slate-500">
                  Configura los datos fiscales que figuran en el encabezado de tus compras y declaraciones DIAN.
                </p>
              </div>

              <button
                type="submit"
                disabled={guardandoEmpresa}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>{guardandoEmpresa ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razón Social de la Veterinaria *
                </label>
                <input
                  type="text"
                  required
                  value={empresa.razonSocial}
                  onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })}
                  placeholder="Ej: CLÍNICA VETERINARIA HUELLITAS S.A.S."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Comercial (Marca o Establecimiento)
                </label>
                <input
                  type="text"
                  value={empresa.nombreComercial || ''}
                  onChange={(e) => setEmpresa({ ...empresa, nombreComercial: e.target.value })}
                  placeholder="Ej: Huellitas Hospital Veterinario 24H"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8 sm:col-span-9">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  NIT (Número de Identificación Tributaria) *
                </label>
                <input
                  type="text"
                  required
                  value={empresa.nit}
                  onChange={(e) => setEmpresa({ ...empresa, nit: e.target.value.replace(/[^0-9-]/g, '') })}
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
                  onChange={(e) => setEmpresa({ ...empresa, dv: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={empresa.direccion}
                  onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })}
                  placeholder="Calle 123 # 45-67"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ciudad / Municipio
                </label>
                <input
                  type="text"
                  value={empresa.ciudad}
                  onChange={(e) => setEmpresa({ ...empresa, ciudad: e.target.value })}
                  placeholder="Bogotá D.C."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={empresa.telefono}
                  onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })}
                  placeholder="(601) 3456789 / 3101234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico (Facturación)
                </label>
                <input
                  type="email"
                  value={empresa.email}
                  onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                  placeholder="facturacion@veterinaria.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Régimen y Parámetros DIAN</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Régimen Tributario
                  </label>
                  <select
                    value={empresa.regimenTributario || 'Responsable de IVA'}
                    onChange={(e) => setEmpresa({ ...empresa, regimenTributario: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="Responsable de IVA">Responsable de IVA (Régimen Común)</option>
                    <option value="Régimen Simple de Tributación (RST)">Régimen Simple de Tributación (RST)</option>
                    <option value="No Responsable de IVA">No Responsable de IVA (Persona Natural)</option>
                    <option value="Gran Contribuyente">Gran Contribuyente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Matrícula Mercantil
                  </label>
                  <input
                    type="text"
                    value={empresa.matriculaMercantil || ''}
                    onChange={(e) => setEmpresa({ ...empresa, matriculaMercantil: e.target.value })}
                    placeholder="03124567 de Cámara de Comercio"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={empresa.responsableIva}
                  onChange={(e) => setEmpresa({ ...empresa, responsableIva: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  La empresa es Responsable del Impuesto sobre las Ventas (IVA) — Habilita IVA descontable en Formulario 300 DIAN
                </span>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={guardandoEmpresa}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>{guardandoEmpresa ? 'Guardando...' : 'Guardar Datos de la Veterinaria'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Proveedor */}
      {modalProveedor.abierto && (
        <ModalFormProveedor
          proveedor={modalProveedor.data}
          onGuardado={() => {
            setModalProveedor({ abierto: false });
            onDatosActualizados();
          }}
          onCerrar={() => setModalProveedor({ abierto: false })}
        />
      )}

      {/* Modal Categoría */}
      {modalCategoria.abierto && (
        <ModalFormCategoria
          categoria={modalCategoria.data}
          onGuardado={() => {
            setModalCategoria({ abierto: false });
            onDatosActualizados();
          }}
          onCerrar={() => setModalCategoria({ abierto: false })}
        />
      )}

      {/* Modal Centro de Costo */}
      {modalCentro.abierto && (
        <ModalFormCentro
          centro={modalCentro.data}
          onGuardado={() => {
            setModalCentro({ abierto: false });
            onDatosActualizados();
          }}
          onCerrar={() => setModalCentro({ abierto: false })}
        />
      )}
    </div>
  );
};

/**
 * Modal Formulario Proveedor
 */
const ModalFormProveedor: React.FC<{
  proveedor?: Proveedor;
  onGuardado: () => void;
  onCerrar: () => void;
}> = ({ proveedor, onGuardado, onCerrar }) => {
  const { mostrarToast } = useToast();
  const [nit, setNit] = useState(proveedor?.nit || '');
  const [dv, setDv] = useState(proveedor?.dv || '');
  const [razonSocial, setRazonSocial] = useState(proveedor?.razonSocial || '');
  const [nombreComercial, setNombreComercial] = useState(proveedor?.nombreComercial || '');
  const [telefono, setTelefono] = useState(proveedor?.telefono || '');
  const [email, setEmail] = useState(proveedor?.email || '');
  const [direccion, setDireccion] = useState(proveedor?.direccion || '');
  const [ciudad, setCiudad] = useState(proveedor?.ciudad || 'Bogotá D.C.');
  const [notas, setNotas] = useState(proveedor?.notas || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nit.trim() || !razonSocial.trim()) {
      mostrarToast('warning', 'Campos obligatorios', 'NIT y Razón Social son requeridos.');
      return;
    }

    const item: Proveedor = {
      id: proveedor?.id || 'prov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      nit: nit.trim(),
      dv: dv.trim() || undefined,
      razonSocial: razonSocial.trim(),
      nombreComercial: nombreComercial.trim() || razonSocial.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      direccion: direccion.trim(),
      ciudad: ciudad.trim(),
      notas: notas.trim(),
      creadoEn: proveedor?.creadoEn || new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    await dataService.guardarProveedor(item);
    mostrarToast('success', 'Proveedor guardado', `${item.razonSocial} guardado con éxito.`);
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            {proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor Veterinario'}
          </h3>
          <button onClick={onCerrar} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <label className="block text-[11px] font-semibold mb-1">NIT / Identificación *</label>
              <input
                type="text"
                required
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                placeholder="Sin DV"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              />
            </div>
            <div className="col-span-4">
              <label className="block text-[11px] font-semibold mb-1">D.V.</label>
              <input
                type="text"
                maxLength={2}
                value={dv}
                onChange={(e) => setDv(e.target.value)}
                placeholder="Ej: 3"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Razón Social Completa *</label>
            <input
              type="text"
              required
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Ej: DISTRIBUIDORA ZOETIS COLOMBIA S.A.S."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Teléfono</label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold mb-1">Dirección</label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Ciudad</label>
              <input
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Notas / Observaciones</label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Distribuidor de medicamentos, plazos de crédito, contacto comercial..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Guardar Proveedor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Modal Formulario Categoría
 */
const ModalFormCategoria: React.FC<{
  categoria?: Categoria;
  onGuardado: () => void;
  onCerrar: () => void;
}> = ({ categoria, onGuardado, onCerrar }) => {
  const { mostrarToast } = useToast();
  const [nombre, setNombre] = useState(categoria?.nombre || '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion || '');
  const [esGasto, setEsGasto] = useState(categoria?.esGasto || false);
  const [color, setColor] = useState(categoria?.color || '#0d9488');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const item: Categoria = {
      id: categoria?.id || 'cat-' + Date.now(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      color,
      icono: 'Tag',
      esGasto,
      activo: true,
    };

    await dataService.guardarCategoria(item);
    mostrarToast('success', 'Categoría guardada', `${item.nombre} guardada.`);
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white">
          {categoria ? 'Editar Categoría' : 'Nueva Categoría'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold mb-1">Nombre *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1">Naturaleza</label>
              <select
                value={esGasto ? 'gasto' : 'compra'}
                onChange={(e) => setEsGasto(e.target.value === 'gasto')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              >
                <option value="compra">Compra de Insumo / Inventario</option>
                <option value="gasto">Gasto Operativo / Administrativo</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-9 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Guardar Categoría
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Modal Formulario Centro de Costo
 */
const ModalFormCentro: React.FC<{
  centro?: CentroCosto;
  onGuardado: () => void;
  onCerrar: () => void;
}> = ({ centro, onGuardado, onCerrar }) => {
  const { mostrarToast } = useToast();
  const [nombre, setNombre] = useState(centro?.nombre || '');
  const [codigo, setCodigo] = useState(centro?.codigo || '');
  const [descripcion, setDescripcion] = useState(centro?.descripcion || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !codigo.trim()) return;

    const item: CentroCosto = {
      id: centro?.id || 'cc-' + Date.now(),
      nombre: nombre.trim(),
      codigo: codigo.trim().toUpperCase(),
      descripcion: descripcion.trim(),
      color: '#0d9488',
      activo: true,
    };

    await dataService.guardarCentroCosto(item);
    mostrarToast('success', 'Centro guardado', `${item.nombre} guardado.`);
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white">
          {centro ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold mb-1">Código *</label>
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="CC-05"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Laboratorio Clínico"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">Descripción</label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Actividades veterinarias asignadas a este centro..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Guardar Centro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
