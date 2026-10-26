import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavItem } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { VentasView } from './components/ventas/VentasView';
import { ListadoDocumentos } from './components/listado/ListadoDocumentos';
import { ReportesView } from './components/reportes/ReportesView';
import { CatalogosView } from './components/catalogos/CatalogosView';
import { ConfiguracionView } from './components/configuracion/ConfiguracionView';
import { CargaFacturaModal } from './components/facturas/CargaFacturaModal';
import { CargaExcelModal } from './components/facturas/CargaExcelModal';
import { RegistroManualModal } from './components/registro/RegistroManualModal';
import { ModalRegistroVenta } from './components/ventas/ModalRegistroVenta';
import { BotonFlotanteNuevo } from './components/common/BotonFlotanteNuevo';
import { CompraDocumento, Categoria, CentroCosto, Proveedor, Venta } from './types';
import { dataService, EVENTO_SESION, UsuarioActual } from './services/dataService';
import { PantallaAcceso } from './components/seguridad/PantallaAcceso';
import { SeguridadView } from './components/seguridad/SeguridadView';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2 } from 'lucide-react';

function VetComprasApp({ onSalir }: { onSalir: () => void }) {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuAbierto, setMobileMenuAbierto] = useState(false);

  // Datos en estado local (provenientes del servidor local SQLite)
  const [documentos, setDocumentos] = useState<CompraDocumento[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Modales
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [modalExcelAbierto, setModalExcelAbierto] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false);
  const [documentoParaEditar, setDocumentoParaEditar] = useState<CompraDocumento | undefined>(undefined);

  // Cargar datos desde el servidor local
  const recargarDatos = useCallback(async () => {
    try {
      const [docs, provs, cats, ccs, vts] = await Promise.all([
        dataService.obtenerDocumentos(),
        dataService.obtenerProveedores(),
        dataService.obtenerCategorias(),
        dataService.obtenerCentrosCosto(),
        dataService.obtenerVentas(),
      ]);
      setDocumentos(docs);
      setProveedores(provs);
      setCategorias(cats);
      setCentrosCosto(ccs);
      setVentas(vts);
      setErrorCarga(null);
    } catch (error: any) {
      console.error('Error cargando datos de VetCompras:', error);
      setErrorCarga(error?.message || 'No fue posible leer la base de datos local.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargarDatos();
    const unsub = dataService.suscribirCambiosEnVivo(() => {
      recargarDatos();
    });
    return () => unsub();
  }, [recargarDatos]);

  // Si el usuario hace click en el menú lateral para subir factura, importar excel o registro manual:
  const handleCambioPestana = (tab: NavItem) => {
    if (tab === 'cargar_factura') {
      setModalCargaAbierto(true);
    } else if (tab === 'cargar_excel') {
      setModalExcelAbierto(true);
    } else if (tab === 'registro_manual') {
      setDocumentoParaEditar(undefined);
      setModalManualAbierto(true);
    } else {
      setCurrentTab(tab);
    }
  };

  const handleEditarDocumento = (doc: CompraDocumento) => {
    setDocumentoParaEditar(doc);
    setModalManualAbierto(true);
  };

  const totalPendientes = documentos.filter((d) => d.saldoPendiente > 0).length;

  const titulos: Record<NavItem, string> = {
    dashboard: 'Panel Central • Año en Curso',
    ventas: 'Módulo de Ventas de la Veterinaria',
    compras: 'Registro de Compras y Gastos',
    cargar_factura: 'Cargar Factura Electrónica (DIAN)',
    cargar_excel: 'Importar Facturas desde Excel',
    registro_manual: 'Registro Manual de Documento',
    reportes: 'Reportería e Informes Tributarios (DIAN)',
    catalogos: 'Catálogos de Proveedores y Centros de Costo',
    configuracion: 'Configuración de la Veterinaria y Marca',
    seguridad: 'Seguridad, Usuarios y Respaldos',
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Barra Lateral (Sidebar) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={handleCambioPestana}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        totalPendientes={totalPendientes}
        mobileOpen={mobileMenuAbierto}
        setMobileOpen={setMobileMenuAbierto}
      />

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Barra Superior (Navbar) */}
        <Navbar
          tituloModulo={titulos[currentTab]}
          onAbrirCargaFactura={() => setModalCargaAbierto(true)}
          onAbrirCargaExcel={() => setModalExcelAbierto(true)}
          onAbrirRegistroManual={() => {
            setDocumentoParaEditar(undefined);
            setModalManualAbierto(true);
          }}
          onDatosActualizados={recargarDatos}
          onAbrirMenuMovil={() => setMobileMenuAbierto(true)}
          onSalir={onSalir}
        />

        {/* Área de Contenido con Scroll */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
          {cargando ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Cargando base de datos local...</p>
            </div>
          ) : errorCarga ? (
            <div className="max-w-xl mx-auto mt-16 p-6 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-3">
              <p className="font-bold">No se pudo cargar la información</p>
              <p className="text-sm">{errorCarga}</p>
              <p className="text-xs">
                Abra VetCompras con el acceso directo "Iniciar VetCompras" y deje esa ventana abierta mientras usa el sistema.
              </p>
              <button
                onClick={() => {
                  setCargando(true);
                  recargarDatos();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {currentTab === 'dashboard' && (
                <DashboardView
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  ventas={ventas}
                  onIrACompras={() => setCurrentTab('compras')}
                  onIrAVentas={() => setCurrentTab('ventas')}
                  onIrACargarFactura={() => setModalCargaAbierto(true)}
                  onIrACargarExcel={() => setModalExcelAbierto(true)}
                  onIrAReportes={() => setCurrentTab('reportes')}
                />
              )}

              {currentTab === 'ventas' && (
                <VentasView
                  ventas={ventas}
                  onDatosActualizados={recargarDatos}
                />
              )}

              {currentTab === 'compras' && (
                <ListadoDocumentos
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  proveedores={proveedores}
                  onDatosActualizados={recargarDatos}
                  onEditarDocumento={handleEditarDocumento}
                  onAbrirCargaFactura={() => setModalCargaAbierto(true)}
                  onAbrirCargaExcel={() => setModalExcelAbierto(true)}
                  onAbrirRegistroManual={() => {
                    setDocumentoParaEditar(undefined);
                    setModalManualAbierto(true);
                  }}
                />
              )}

              {currentTab === 'reportes' && (
                <ReportesView
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  proveedores={proveedores}
                  ventas={ventas}
                />
              )}

              {currentTab === 'catalogos' && (
                <CatalogosView
                  proveedores={proveedores}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  onDatosActualizados={recargarDatos}
                />
              )}

              {currentTab === 'seguridad' && dataService.esAdministrador() && <SeguridadView onSesionTerminada={onSalir} />}

              {currentTab === 'configuracion' && (
                <ConfiguracionView
                  onDatosActualizados={recargarDatos}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Botón Flotante de Acceso Rápido "+ Nuevo Registro" */}
      <BotonFlotanteNuevo
        onNuevaVenta={() => setModalVentaAbierto(true)}
        onSubirFactura={() => setModalCargaAbierto(true)}
        onCargarExcel={() => setModalExcelAbierto(true)}
        onRegistroManual={() => {
          setDocumentoParaEditar(undefined);
          setModalManualAbierto(true);
        }}
      />

      {/* Modal Carga Factura Electrónica (XML / PDF / ZIP) */}
      {modalCargaAbierto && (
        <CargaFacturaModal
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          onFacturaGuardada={() => {
            recargarDatos();
            setCurrentTab('compras');
          }}
          onAbrirCargaExcel={() => setModalExcelAbierto(true)}
          onCerrar={() => setModalCargaAbierto(false)}
        />
      )}

      {/* Modal Importar Facturas desde Excel */}
      {modalExcelAbierto && (
        <CargaExcelModal
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          onFacturasImportadas={() => {
            recargarDatos();
            setCurrentTab('compras');
          }}
          onCerrar={() => setModalExcelAbierto(false)}
        />
      )}

      {/* Modal Registro Manual (o edición de compras/gastos) */}
      {modalManualAbierto && (
        <RegistroManualModal
          categorias={categorias}
          centrosCosto={centrosCosto}
          proveedores={proveedores}
          documentoParaEditar={documentoParaEditar}
          onGuardado={() => {
            setModalManualAbierto(false);
            setDocumentoParaEditar(undefined);
            recargarDatos();
            setCurrentTab('compras');
          }}
          onCerrar={() => {
            setModalManualAbierto(false);
            setDocumentoParaEditar(undefined);
          }}
          onProveedorCreado={recargarDatos}
        />
      )}

      {/* Modal Registro Rápido de Venta */}
      {modalVentaAbierto && (
        <ModalRegistroVenta
          onGuardado={() => {
            setModalVentaAbierto(false);
            recargarDatos();
            setCurrentTab('ventas');
          }}
          onCerrar={() => setModalVentaAbierto(false)}
        />
      )}
    </div>
  );
}

type EstadoAcceso =
  | { tipo: 'cargando' }
  | { tipo: 'sin_servidor'; error: string }
  | { tipo: 'configuracion' }
  | { tipo: 'ingreso'; mensaje?: string }
  | { tipo: 'cambio_clave'; usuario: UsuarioActual }
  | { tipo: 'listo'; usuario: UsuarioActual };

/** Controla el acceso: primer uso, ingreso, cambio obligatorio de contraseña y sesión vencida. */
function PuertaDeAcceso() {
  const [estado, setEstado] = useState<EstadoAcceso>({ tipo: 'cargando' });

  const consultar = useCallback(async () => {
    try {
      const sesion = await dataService.obtenerSesion();
      if (sesion.requiereConfiguracion) setEstado({ tipo: 'configuracion' });
      else if (!sesion.usuario) setEstado({ tipo: 'ingreso' });
      else if (sesion.usuario.debeCambiarClave) setEstado({ tipo: 'cambio_clave', usuario: sesion.usuario });
      else {
        await dataService.init();
        setEstado({ tipo: 'listo', usuario: sesion.usuario });
      }
    } catch (err: any) {
      setEstado({ tipo: 'sin_servidor', error: err?.message || 'No hay conexión con el servidor local.' });
    }
  }, []);

  useEffect(() => {
    consultar();
    const alCambiarSesion = (e: Event) => {
      const detalle = (e as CustomEvent).detail || {};
      if (detalle.sesionVencida) {
        setEstado({ tipo: 'ingreso', mensaje: 'Su sesión se cerró por inactividad o desde otro equipo. Ingrese de nuevo.' });
      } else if (detalle.debeCambiarClave) {
        consultar();
      }
    };
    window.addEventListener(EVENTO_SESION, alCambiarSesion);
    return () => window.removeEventListener(EVENTO_SESION, alCambiarSesion);
  }, [consultar]);

  const alIngresar = async (usuario: UsuarioActual) => {
    if (usuario.debeCambiarClave) return setEstado({ tipo: 'cambio_clave', usuario });
    // Cargar los datos de la veterinaria antes de mostrar el menú (nombre, logo)
    await dataService.init().catch(() => undefined);
    setEstado({ tipo: 'listo', usuario });
  };

  switch (estado.tipo) {
    case 'cargando':
      return (
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      );
    case 'sin_servidor':
      return (
        <div className="h-screen flex items-center justify-center p-4">
          <div className="max-w-md p-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 space-y-3">
            <p className="font-bold">VetCompras no está abierto en este PC</p>
            <p className="text-sm">{estado.error}</p>
            <p className="text-xs">Abra el icono “VetCompras” del escritorio y vuelva a intentar.</p>
            <button onClick={consultar} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold">
              Reintentar
            </button>
          </div>
        </div>
      );
    case 'configuracion':
      return <PantallaAcceso key="configuracion" modo="configuracion" onListo={alIngresar} />;
    case 'ingreso':
      return <PantallaAcceso key="ingreso" modo="ingreso" mensaje={estado.mensaje} onListo={alIngresar} />;
    case 'cambio_clave':
      return <PantallaAcceso key="cambio_clave" modo="cambio_clave" usuario={estado.usuario} onListo={alIngresar} />;
    case 'listo':
      return (
        <VetComprasApp
          key={estado.usuario.id}
          onSalir={async () => {
            await dataService.salir();
            consultar();
          }}
        />
      );
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PuertaDeAcceso />
      </ToastProvider>
    </ThemeProvider>
  );
}
