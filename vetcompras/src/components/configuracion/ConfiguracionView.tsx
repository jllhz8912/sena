import React, { useState, useRef } from 'react';
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Save,
  Upload,
  Trash2,
  FileText,
  Phone,
  Mail,
  MapPin,
  Check,
  Sparkles,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Globe,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { EmpresaInfo } from '../../types';
import { dataService } from '../../services/dataService';
import { EMPRESA_DEFECTO } from '../../data/defaults';
import { useToast } from '../../context/ToastContext';

interface ConfiguracionViewProps {
  onDatosActualizados?: () => void;
}

const PRESET_COLORES = [
  { nombre: 'Esmeralda Clínico', hex: '#059669', desc: 'Verde fresco y médico' },
  { nombre: 'Azul Veterinario', hex: '#2563eb', desc: 'Profesional y confiable' },
  { nombre: 'Turquesa Salud', hex: '#0d9488', desc: 'Cuidado animal e higiene' },
  { nombre: 'Índigo Quirúrgico', hex: '#4f46e5', desc: 'Especialidades clínicas' },
  { nombre: 'Violeta PetShop', hex: '#7c3aed', desc: 'Moderno y estilizado' },
  { nombre: 'Rosa / Magenta', hex: '#e11d48', desc: 'Cariño y estética de mascotas' },
  { nombre: 'Naranja Cálido', hex: '#ea580c', desc: 'Cercano y amigable' },
  { nombre: 'Grafito Neutro', hex: '#334155', desc: 'Elegante y minimalista' },
];

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  onDatosActualizados,
}) => {
  const { mostrarToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());
  const [guardando, setGuardando] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState<'datos' | 'marca' | 'recibos'>('datos');

  const handleChange = (campo: keyof EmpresaInfo, valor: any) => {
    setEmpresa((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  // Carga de archivo de imagen del logo (PNG, JPG, SVG)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      mostrarToast('error', 'Formato no válido', 'Por favor seleccione una imagen en formato PNG, JPG o SVG.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      mostrarToast('warning', 'Imagen pesada', 'El logo debe ser menor a 2 MB para un rendimiento óptimo.');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setEmpresa((prev) => ({
        ...prev,
        logoUrl: base64,
      }));
      mostrarToast('success', 'Logo cargado', 'Previsualización actualizada. Recuerde hacer clic en Guardar Cambios.');
    };
    reader.readAsDataURL(file);
  };

  const handleEliminarLogo = () => {
    setEmpresa((prev) => ({
      ...prev,
      logoUrl: undefined,
    }));
    mostrarToast('info', 'Logo removido', 'Se ha eliminado el logo corporativo.');
  };

  const handleRestaurarDefecto = () => {
    if (window.confirm('¿Desea restaurar la configuración a los valores predeterminados?')) {
      setEmpresa(EMPRESA_DEFECTO);
      mostrarToast('info', 'Restaurado', 'Valores de demostración restablecidos.');
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresa.razonSocial.trim() || !empresa.nit.trim()) {
      mostrarToast('warning', 'Campos obligatorios', 'La Razón Social y el NIT de la veterinaria son indispensables.');
      return;
    }

    try {
      setGuardando(true);
      dataService.guardarDatosEmpresa(empresa);
      mostrarToast(
        'success',
        'Configuración guardada',
        'Los datos de la clínica, logo y colores se guardaron y sincronizaron en línea.'
      );
      if (onDatosActualizados) {
        onDatosActualizados();
      }
    } catch (err: any) {
      mostrarToast('error', 'Error al guardar', err?.message || 'No se pudo guardar la configuración.');
    } finally {
      setGuardando(false);
    }
  };

  const colorActivo = empresa.colorPrimario || '#059669';

  return (
    <div className="space-y-6 animate-in fade-in pb-16">
      {/* Encabezado Principal */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md transition-all shrink-0"
            style={{ backgroundColor: colorActivo }}
          >
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white">
              Configuración de la Veterinaria y Marca
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalice el logo, colores corporativos, datos comerciales y formato de comprobantes de venta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestaurarDefecto}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Restaurar a los valores originales de demostración"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar</span>
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all hover:opacity-95"
            style={{ backgroundColor: colorActivo }}
          >
            <Save className="w-4 h-4" />
            <span>{guardando ? 'Guardando...' : 'Guardar Todos los Cambios'}</span>
          </button>
        </div>
      </div>

      {/* Tabs de Secciones de Configuración */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSeccionActiva('datos')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            seccionActiva === 'datos'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Datos de la Veterinaria</span>
        </button>

        <button
          type="button"
          onClick={() => setSeccionActiva('marca')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            seccionActiva === 'marca'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>2. Logo y Colores Corporativos</span>
        </button>

        <button
          type="button"
          onClick={() => setSeccionActiva('recibos')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            seccionActiva === 'recibos'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>3. Documentos de Venta y Recibos</span>
        </button>
      </div>

      <form onSubmit={handleGuardar} className="space-y-6">
        {/* ============================================================ */}
        {/* SECCIÓN 1: DATOS DE LA VETERINARIA                           */}
        {/* ============================================================ */}
        {seccionActiva === 'datos' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Información Legal y Comercial de la Veterinaria</span>
              </h3>
              <p className="text-xs text-slate-500">
                Estos datos aparecen en el encabezado de sus reportes de utilidad y en los comprobantes de venta para clientes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razón Social Registrada *
                </label>
                <input
                  type="text"
                  required
                  value={empresa.razonSocial}
                  onChange={(e) => handleChange('razonSocial', e.target.value)}
                  placeholder="Ej: CLÍNICA VETERINARIA SAN ROQUE S.A.S."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Comercial / Marca
                </label>
                <input
                  type="text"
                  value={empresa.nombreComercial || ''}
                  onChange={(e) => handleChange('nombreComercial', e.target.value)}
                  placeholder="Ej: VetSanRoque Hospital 24H"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  NIT o Cédula *
                </label>
                <input
                  type="text"
                  required
                  value={empresa.nit}
                  onChange={(e) => handleChange('nit', e.target.value)}
                  placeholder="Ej: 901458789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dígito de Verificación (DV)
                </label>
                <input
                  type="text"
                  maxLength={1}
                  value={empresa.dv || ''}
                  onChange={(e) => handleChange('dv', e.target.value)}
                  placeholder="Ej: 3"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Régimen Tributario
                </label>
                <input
                  type="text"
                  value={empresa.regimenTributario || 'No Responsable de IVA'}
                  onChange={(e) => handleChange('regimenTributario', e.target.value)}
                  placeholder="No Responsable de IVA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dirección de la Sede</span>
                </label>
                <input
                  type="text"
                  value={empresa.direccion}
                  onChange={(e) => handleChange('direccion', e.target.value)}
                  placeholder="Ej: Calle 140 # 15-22 Cedritos"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ciudad y Departamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={empresa.ciudad}
                    onChange={(e) => handleChange('ciudad', e.target.value)}
                    placeholder="Bogotá D.C."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={empresa.departamento}
                    onChange={(e) => handleChange('departamento', e.target.value)}
                    placeholder="Cundinamarca"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Teléfono Fijo / PBX</span>
                </label>
                <input
                  type="text"
                  value={empresa.telefono}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  placeholder="Ej: (601) 7452300"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp de la Veterinaria (Para envío de recibos)</span>
                </label>
                <input
                  type="text"
                  value={empresa.whatsapp || ''}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                  placeholder="Ej: 3105551234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Correo Electrónico</span>
                </label>
                <input
                  type="email"
                  value={empresa.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contacto@veterinaria.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECCIÓN 2: LOGO Y COLORES CORPORATIVOS                       */}
        {/* ============================================================ */}
        {seccionActiva === 'marca' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-600" />
                <span>Identidad Visual: Logo y Colores Corporativos</span>
              </h3>
              <p className="text-xs text-slate-500">
                Cargue el logo de su veterinaria y elija el color que identificará sus recibos, botones y barra de navegación.
              </p>
            </div>

            {/* Subida de Logo */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                Logo de la Veterinaria
              </span>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Previsualizador */}
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center p-2 overflow-hidden shadow-inner shrink-0">
                  {empresa.logoUrl ? (
                    <img
                      src={empresa.logoUrl}
                      alt="Logo de la clínica"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-400 font-semibold block">Sin Logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-sm hover:opacity-90 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{empresa.logoUrl ? 'Cambiar Logo' : 'Cargar Logo desde el Computador'}</span>
                    </button>

                    {empresa.logoUrl && (
                      <button
                        type="button"
                        onClick={handleEliminarLogo}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar Logo</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Formatos recomendados: PNG o JPG con fondo transparente o blanco. Se almacena y sincroniza automáticamente para imprimir comprobantes y recibos.
                  </p>
                </div>
              </div>
            </div>

            {/* Selector de Color Corporativo */}
            <div className="space-y-3">
              <label className="block font-bold text-xs text-slate-800 dark:text-slate-200">
                Color Primario de la Clínica
              </label>

              {/* Presets Rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_COLORES.map((c) => {
                  const activo = empresa.colorPrimario?.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => handleChange('colorPrimario', c.hex)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        activo
                          ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-xl shadow-xs shrink-0 flex items-center justify-center text-white"
                        style={{ backgroundColor: c.hex }}
                      >
                        {activo && <Check className="w-4 h-4" />}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {c.nombre}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.hex}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selector Libre de Color */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <input
                  type="color"
                  value={empresa.colorPrimario || '#059669'}
                  onChange={(e) => handleChange('colorPrimario', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-600 bg-transparent"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    O elija un tono personalizado:
                  </span>
                  <span className="font-mono text-slate-500 font-semibold">{empresa.colorPrimario || '#059669'}</span>
                </div>
              </div>
            </div>

            {/* Eslogan y Web */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Eslogan o Lema de la Clínica
                </label>
                <input
                  type="text"
                  value={empresa.slogan || ''}
                  onChange={(e) => handleChange('slogan', e.target.value)}
                  placeholder="Ej: Pasión y cuidado por tus mascotas"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Página Web / Redes Sociales</span>
                </label>
                <input
                  type="text"
                  value={empresa.sitioWeb || ''}
                  onChange={(e) => handleChange('sitioWeb', e.target.value)}
                  placeholder="www.vetsanroque.com.co"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECCIÓN 3: DOCUMENTOS DE VENTA Y RECIBOS                     */}
        {/* ============================================================ */}
        {seccionActiva === 'recibos' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Configuración de Documentos de Venta y Comprobantes para Clientes</span>
              </h3>
              <p className="text-xs text-slate-500">
                Personalice los títulos, textos legales y notas de pie de página que se imprimen y se envían por WhatsApp a los propietarios de mascotas.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título del Documento de Venta
                </label>
                <input
                  type="text"
                  value={empresa.tituloDocumentoVenta || 'COMPROBANTE DE VENTA Y SERVICIOS'}
                  onChange={(e) => handleChange('tituloDocumentoVenta', e.target.value)}
                  placeholder="Ej: COMPROBANTE DE VENTA Y SERVICIOS VETERINARIOS"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Aparece destacado en la parte superior del recibo en formato carta y tirilla.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mensaje de Pie de Página / Agradecimiento y Garantías
                </label>
                <textarea
                  rows={3}
                  value={empresa.textoPieRecibo || ''}
                  onChange={(e) => handleChange('textoPieRecibo', e.target.value)}
                  placeholder="Ej: ¡Gracias por confiar en el bienestar de su mascota! Medicamentos y alimentos abiertos no tienen cambio."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Leyenda Legal Tributaria (Para régimen No Responsable de IVA)
                </label>
                <input
                  type="text"
                  value={empresa.resolucionLegal || ''}
                  onChange={(e) => handleChange('resolucionLegal', e.target.value)}
                  placeholder="Documento soporte equivalente. Régimen No Responsable de IVA según Art. 437 del Estatuto Tributario."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Botón Flotante/Final de Guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-lg transition-all hover:opacity-95"
            style={{ backgroundColor: colorActivo }}
          >
            <Save className="w-5 h-5" />
            <span>{guardando ? 'Guardando en la nube...' : 'Guardar y Aplicar Cambios'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
