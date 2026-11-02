import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  UploadCloud,
  FilePenLine,
  Moon,
  Sun,
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  ChevronDown,
  ShieldCheck,
  Building,
  Building2,
  HardDrive,
  UserCircle2,
  KeyRound,
  LogOut,
  Menu,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { dataService, EstadoCopias } from '../../services/dataService';
import { ModalDatosEmpresa } from '../catalogos/ModalDatosEmpresa';
import { ModalBorradoSeguro } from '../respaldos/ModalBorradoSeguro';
import { descargarBlob } from '../../services/reciboPdf';
import { ModalCambiarClave } from '../seguridad/ModalCambiarClave';
import { CompraDocumento, EmpresaInfo } from '../../types';
import { AlertasVencimiento } from '../cartera/AlertasVencimiento';
import { fechaLocal } from '../../utils/formatters';
import { logoDe } from '../../data/marca';

interface NavbarProps {
  onAbrirCargaFactura: () => void;
  onAbrirCargaExcel: () => void;
  onAbrirRegistroManual: () => void;
  onDatosActualizados: () => void;
  tituloModulo: string;
  onAbrirMenuMovil?: () => void;
  onSalir: () => void;
  documentos: CompraDocumento[];
  onVerCartera: () => void;
  estadoCopias: EstadoCopias | null;
  onVerCopias: () => void;
  /** Módulos que puede usar el perfil de ingreso */
  puede?: (modulo: string) => boolean;
  perfil?: { nombre: string } | null;
  onCambiarPerfil?: () => void;
  onNuevaVenta?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onAbrirCargaFactura,
  onAbrirCargaExcel,
  onAbrirRegistroManual,
  onDatosActualizados,
  tituloModulo,
  onAbrirMenuMovil,
  onSalir,
  documentos,
  onVerCartera,
  estadoCopias,
  onVerCopias,
  puede = () => true,
  perfil,
  onCambiarPerfil,
  onNuevaVenta,
}) => {
  const usuario = dataService.usuarioActual();
  const esAdmin = dataService.esAdministrador();
  const accesoLibre = dataService.modoAcceso() === 'libre';
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [modalClaveAbierto, setModalClaveAbierto] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { mostrarToast } = useToast();

  const [menuNuevoAbierto, setMenuNuevoAbierto] = useState(false);
  const [menuDatosAbierto, setMenuDatosAbierto] = useState(false);
  const [modalEmpresaAbierto, setModalEmpresaAbierto] = useState(false);
  const [borrado, setBorrado] = useState<null | 'compras' | 'todo' | 'demo'>(null);
  const [empresa, setEmpresa] = useState<EmpresaInfo>(() => dataService.obtenerDatosEmpresa());
  const [carpetaDatos, setCarpetaDatos] = useState('');

  useEffect(() => {
    dataService
      .obtenerEstado()
      .then((e) => setCarpetaDatos(e.carpetaDatos))
      .catch(() => setCarpetaDatos(''));
  }, []);

  const menuNuevoRef = useRef<HTMLDivElement>(null);
  const menuDatosRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cerrar menús al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuNuevoRef.current && !menuNuevoRef.current.contains(e.target as Node)) {
        setMenuNuevoAbierto(false);
      }
      if (menuDatosRef.current && !menuDatosRef.current.contains(e.target as Node)) {
        setMenuDatosAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Suscribirse a cambios en los datos de empresa (logo, nombre comercial, etc.)
  useEffect(() => {
    const unsub = dataService.suscribirCambiosEnVivo(() => {
      setEmpresa(dataService.obtenerDatosEmpresa());
    });
    return () => unsub();
  }, []);

  const abrirBorrado = (tipo: 'compras' | 'todo' | 'demo') => {
    setMenuDatosAbierto(false);
    setBorrado(tipo);
  };

  // Las tres operaciones reemplazan o borran información: pasan por la pregunta de la copia
  const BORRADOS: Record<'compras' | 'todo' | 'demo', { titulo: string; borra: string[]; conserva: string[]; textoBoton: string; palabra?: string; ejecutar: () => Promise<void> }> = {
    compras: {
      titulo: 'Borrar las compras registradas',
      borra: ['Facturas de compra y gastos', 'Abonos y PDF/XML anexos'],
      conserva: ['Ventas', 'Proveedores y catálogos', 'Datos de la veterinaria'],
      textoBoton: 'Sí, borrar compras',
      ejecutar: async () => {
        await dataService.limpiarTodosLosDatos();
        mostrarToast('info', 'Compras borradas', 'Se borraron las compras y facturas.');
      },
    },
    todo: {
      titulo: 'Borrar toda la información',
      borra: ['Compras, gastos y anexos', 'Ventas y recibos', 'Inventario (productos y movimientos)', 'Fichas de precios', 'Proveedores', 'Catálogos (vuelven a los de fábrica)', 'Observaciones de prueba'],
      conserva: ['Datos y logo de la veterinaria', 'Forma de ingreso', 'Bitácora', 'Copias de seguridad'],
      textoBoton: 'Borrar todo',
      palabra: 'BORRAR',
      ejecutar: async () => {
        await dataService.borrarTodo();
        mostrarToast('info', 'Información borrada', 'El sistema quedó en cero. Las copias de seguridad siguen disponibles.');
      },
    },
    demo: {
      titulo: 'Cargar datos de demostración',
      borra: ['Las compras actuales (se reemplazan por facturas de ejemplo)'],
      conserva: ['Ventas', 'Proveedores y catálogos', 'Datos de la veterinaria'],
      textoBoton: 'Reemplazar por demostración',
      ejecutar: async () => {
        await dataService.cargarDatosDemostracion();
        mostrarToast('success', 'Datos cargados', 'Se cargaron las compras y facturas de demostración de veterinaria.');
      },
    },
  };
  const borradoActual = borrado ? BORRADOS[borrado] : null;

  const handleExportarRespaldo = async () => {
    try {
      const json = await dataService.exportarRespaldoJSON();
      await descargarBlob(new Blob([json], { type: 'application/json' }), `VetCompras_Respaldo_${fechaLocal()}.json`);
      mostrarToast('success', 'Copia de seguridad descargada', 'Archivo JSON generado exitosamente.');
      setMenuDatosAbierto(false);
    } catch (err: any) {
      mostrarToast('error', 'Error al exportar', err?.message);
    }
  };

  const handleRespaldoEnDisco = async () => {
    try {
      const ruta = await dataService.crearRespaldoEnDisco();
      mostrarToast('success', 'Respaldo creado en este PC', ruta);
      setMenuDatosAbierto(false);
    } catch (err: any) {
      mostrarToast('error', 'No se pudo crear el respaldo', err?.message);
    }
  };

  const handleImportarRespaldo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await dataService.importarRespaldoJSON(text);
        mostrarToast(
          'success',
          'Copia de seguridad restaurada',
          `Se importaron ${res.documentos} documentos, ${res.ventas} ventas y ${res.proveedores} proveedores.`
        );
        onDatosActualizados();
      } catch (err: any) {
        mostrarToast('error', 'Error al restaurar respaldo', err?.message || 'El archivo JSON no tiene un formato válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setMenuDatosAbierto(false);
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Page Title & Context */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onAbrirMenuMovil && (
          <button
            onClick={onAbrirMenuMovil}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">
          {tituloModulo}
        </h1>
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Normativa DIAN Colombia</span>
        </div>
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 text-xs font-medium" title="Toda la información se guarda en la base de datos de este PC">
          <HardDrive className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Datos guardados en este PC</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Botón Datos de la Empresa Veterinaria */}
        <button
          onClick={() => esAdmin && setModalEmpresaAbierto(true)}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
          title="Ver o editar datos tributarios y marca de la veterinaria"
        >
          {logoDe(empresa) ? (
            <img
              src={logoDe(empresa)}
              alt="Logo"
              className="w-6 h-6 rounded-full object-contain bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="truncate max-w-[140px]">{empresa.nombreComercial || empresa.razonSocial || 'Veterinaria'}</span>
        </button>

        {/* Gestor de Datos / Demo (solo perfiles con Copias de Seguridad) */}
        {puede('copias') && (
        <div className="relative" ref={menuDatosRef}>
          <button
            onClick={() => setMenuDatosAbierto(!menuDatosAbierto)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
            title="Opciones de datos y demostración"
          >
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Datos y Respaldo</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {menuDatosAbierto && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
              {esAdmin && (
<>
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Empresa y Demostración
              </div>
              <button
                onClick={() => {
                  setMenuDatosAbierto(false);
                  setModalEmpresaAbierto(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-left transition-colors"
              >
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-medium text-xs">Datos de la Veterinaria</p>
                  <p className="text-[11px] text-slate-400">NIT, Razón social, dirección, etc.</p>
                </div>
              </button>

              <button
                onClick={() => abrirBorrado('demo')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-left transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-medium text-xs">Cargar datos de demostración</p>
                  <p className="text-[11px] text-slate-400">Facturas Zoetis, Royal Canin, etc.</p>
                </div>
              </button>

              <button
                onClick={() => abrirBorrado('compras')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium text-xs">Limpiar compras registradas</p>
                  <p className="text-[11px] text-slate-400">Borra facturas pero conserva catálogos</p>
                </div>
              </button>

              <button
                onClick={() => abrirBorrado('todo')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-bold text-xs">Borrar todo</p>
                  <p className="text-[11px] text-slate-400">Empezar de cero (pregunta antes por la copia)</p>
                </div>
              </button>

              </>
)}

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Copias de Seguridad
              </div>

              <button
                onClick={handleRespaldoEnDisco}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <HardDrive className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="font-medium text-xs">Crear respaldo en este PC</p>
                  <p className="text-[11px] text-slate-400 break-all">
                    {carpetaDatos ? `Carpeta: ${carpetaDatos}` : 'Copia completa de la base de datos'}
                  </p>
                </div>
              </button>

              {esAdmin && (
<>
              <button
                onClick={handleExportarRespaldo}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <Download className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="font-medium text-xs">Exportar respaldo completo</p>
                  <p className="text-[11px] text-slate-400">Archivo JSON para llevar a otro PC o memoria USB</p>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
              >
                <Upload className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="font-medium text-xs">Importar respaldo JSON</p>
                  <p className="text-[11px] text-slate-400">Restaura datos desde un archivo</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportarRespaldo}
              />
</>
)}
            </div>
          )}
        </div>

        )}

        {/* Alertas de vencimiento de facturas y de copias, según el perfil */}
        {(puede('cuentas_pagar') || puede('copias')) && (
          <AlertasVencimiento
            documentos={puede('cuentas_pagar') ? documentos : []}
            onVerCartera={onVerCartera}
            estadoCopias={puede('copias') ? estadoCopias : null}
            onVerCopias={onVerCopias}
          />
        )}

        {/* Usuario y sesión */}
        <div className="relative">
          <button
            onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
            title="Mi usuario"
          >
            <UserCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline max-w-[140px] truncate">{perfil ? perfil.nombre : usuario?.nombre}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
          {menuUsuarioAbierto && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
              <div className="px-4 py-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{usuario?.nombre}</p>
                <p className="text-[11px] text-slate-500">
                  {accesoLibre ? 'Ingreso sin contraseña' : `${usuario?.usuario} · ${usuario?.rol === 'administrador' ? 'Administrador' : 'Auxiliar'}`}
                </p>
                {perfil && (
                  <p className="text-[11px] mt-1 font-semibold text-emerald-700 dark:text-emerald-400">Perfil: {perfil.nombre}</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  VetCompras {dataService.version()}
                  {dataService.etapa() === 'prueba' ? ' (prueba)' : ''}
                </p>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              {!accesoLibre && (
                <button
                  onClick={() => {
                    setMenuUsuarioAbierto(false);
                    setModalClaveAbierto(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                >
                  <KeyRound className="w-4 h-4 text-emerald-600" /> Cambiar mi contraseña
                </button>
              )}
              {onCambiarPerfil && (
                <button
                  id="cambiar-perfil"
                  onClick={() => {
                    setMenuUsuarioAbierto(false);
                    onCambiarPerfil();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                >
                  <UserCircle2 className="w-4 h-4 text-emerald-600" /> Cambiar de perfil
                </button>
              )}
              <button
                onClick={onSalir}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left"
              >
                <LogOut className="w-4 h-4" /> {accesoLibre ? 'Volver a la pantalla de inicio' : 'Cerrar sesión'}
              </button>
            </div>
          )}
        </div>
        {modalClaveAbierto && <ModalCambiarClave onCerrar={() => setModalClaveAbierto(false)} />}

        {/* Dark / Light Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Action Button: + Nuevo Registro (opciones según el perfil) */}
        {(puede('ventas') || puede('compras') || puede('cargar_factura')) && (
        <div className="relative" ref={menuNuevoRef}>
          <button
            onClick={() => setMenuNuevoAbierto(!menuNuevoAbierto)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/25 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo registro</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {menuNuevoAbierto && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
              {puede('ventas') && onNuevaVenta && (
                <>
                  <button
                    id="nuevo-venta"
                    onClick={() => {
                      setMenuNuevoAbierto(false);
                      onNuevaVenta();
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-100 transition-colors group"
                  >
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">Nueva venta</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Productos y servicios, varios medios de pago y recibo</p>
                    </div>
                  </button>
                  {(puede('cargar_factura') || puede('compras')) && <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />}
                </>
              )}
              {puede('cargar_factura') && (
              <>
              <button
                onClick={() => {
                  setMenuNuevoAbierto(false);
                  onAbrirCargaFactura();
                }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-100 transition-colors group"
              >
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                    Subir factura electrónica
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Arrastra XML UBL 2.1, PDF o archivos ZIP de la DIAN
                  </p>
                </div>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              <button
                onClick={() => {
                  setMenuNuevoAbierto(false);
                  onAbrirCargaExcel();
                }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-100 transition-colors group"
              >
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 shrink-0">
                  <Download className="w-5 h-5 rotate-180" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                    Cargar archivo Excel
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Importa planillas masivas (.xlsx, .xls, .csv)
                  </p>
                </div>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              </>
              )}

              {puede('compras') && (
              <button
                onClick={() => {
                  setMenuNuevoAbierto(false);
                  onAbrirRegistroManual();
                }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-800 dark:text-slate-100 transition-colors group"
              >
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 group-hover:bg-teal-200 shrink-0">
                  <FilePenLine className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-950 dark:text-teal-200">
                    Registrar compra o gasto
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Sencilla o detallada: factura, cuenta de cobro, recibo o tiquete POS
                  </p>
                </div>
              </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Modal de Datos de la Empresa / Veterinaria */}
      <ModalDatosEmpresa
        abierto={modalEmpresaAbierto}
        onCerrar={() => setModalEmpresaAbierto(false)}
        onGuardado={(nueva) => {
          setEmpresa(nueva);
          onDatosActualizados();
        }}
      />

      {/* Modal de Confirmación para Limpiar Datos */}
      {borradoActual && (
        <ModalBorradoSeguro
          abierto
          titulo={borradoActual.titulo}
          borra={borradoActual.borra}
          conserva={borradoActual.conserva}
          textoBoton={borradoActual.textoBoton}
          palabraConfirmacion={borradoActual.palabra}
          onEjecutar={async () => {
            await borradoActual.ejecutar();
            onDatosActualizados();
          }}
          onCerrar={() => setBorrado(null)}
        />
      )}
    </header>
  );
};
