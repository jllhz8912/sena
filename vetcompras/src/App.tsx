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
import { CompraDocumento, Categoria, CentroCosto, Proveedor, Venta, VentaItem } from './types';
import { dataService, EVENTO_SESION, EstadoSesion, UsuarioActual } from './services/dataService';
import { PantallaAcceso } from './components/seguridad/PantallaAcceso';
import { PantallaInicio } from './components/seguridad/PantallaInicio';
import { EVENTO_IR_A_COPIAS, pedidoIrACopias } from './components/respaldos/AlertaCopiaSemanal';
import { MARCA } from './data/marca';
import { SeguridadView } from './components/seguridad/SeguridadView';
import { InventarioView } from './components/inventario/InventarioView';
import { PreciosView } from './components/precios/PreciosView';
import { BotonObservacion } from './components/prueba/ObservacionPrueba';
import { CuentasPorPagarView } from './components/cartera/CuentasPorPagarView';
import { CopiasSeguridadView, estadoRecordatorio } from './components/respaldos/CopiasSeguridadView';
import type { EstadoCopias } from './services/dataService';
import { resumenAlertas, sumaSaldos } from './utils/cartera';
import { formatCOP } from './utils/formatters';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { Loader2 } from 'lucide-react';
import { PantallaPerfiles } from './components/seguridad/PantallaPerfiles';
import { PanelVentas } from './components/dashboard/PanelVentas';
import { PanelCompras } from './components/dashboard/PanelCompras';
import { ReportesVentasPerfil } from './components/reportes/ReportesVentasPerfil';
import { ReportesComprasPerfil } from './components/reportes/ReportesComprasPerfil';
import { PerfilAcceso, modulosDe, moduloInicial } from './utils/perfiles';

/** Perfiles a los que ya se les mostraron los avisos de copias y vencimientos en esta sesión */
const avisosMostrados = new Set<string>();

/** Después de ingresar: elegir el perfil (Ventas, Compras y Gastos, Administración) y abrir el sistema con sus módulos. */
function ConPerfil({ onSalir }: { onSalir: () => void }) {
  const [perfiles, setPerfiles] = useState<PerfilAcceso[] | null>(null);
  const [perfil, setPerfil] = useState<PerfilAcceso | null>(dataService.perfilActivo());
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const lista = await dataService.obtenerPerfiles();
      setPerfiles(lista);
      // Al recargar la página se conserva el perfil elegido (si no pide PIN)
      const recordado = lista.find((p) => p.id === dataService.perfilRecordado());
      if (!dataService.perfilActivo() && recordado && !recordado.tienePin) setPerfil(await dataService.entrarConPerfil(recordado.id));
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los perfiles.');
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (perfil) {
    return (
      <VetComprasApp
        key={perfil.id}
        perfil={perfil}
        onSalir={onSalir}
        onCambiarPerfil={() => {
          dataService.salirDelPerfil();
          setPerfil(null);
          cargar();
        }}
      />
    );
  }
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="max-w-md p-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 space-y-3">
          <p className="font-bold">No se pudieron cargar los perfiles</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => (setError(''), cargar())} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold">
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!perfiles) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  return <PantallaPerfiles perfiles={perfiles} onElegido={setPerfil} onSalir={onSalir} />;
}

function VetComprasApp({ onSalir, perfil, onCambiarPerfil }: { onSalir: () => void; perfil: PerfilAcceso; onCambiarPerfil: () => void }) {
  // Módulos que el perfil puede ver; cualquier intento de abrir otro lleva a su pantalla inicial
  const permitidos = modulosDe(perfil);
  const puede = (m: string) => permitidos.has(m);
  const inicio = moduloInicial(perfil) as NavItem;
  const [currentTab, setCurrentTabLibre] = useState<NavItem>(inicio);
  const setCurrentTab = (t: NavItem) => setCurrentTabLibre(puede(t) ? t : inicio);
  // "Aceptar e ir a Copias de Seguridad" en la alerta semanal
  useEffect(() => {
    const irACopias = () => setCurrentTabLibre((t) => (modulosDe(perfil).has('copias') ? 'copias' : t));
    if (pedidoIrACopias()) irACopias();
    window.addEventListener(EVENTO_IR_A_COPIAS, irACopias);
    return () => window.removeEventListener(EVENTO_IR_A_COPIAS, irACopias);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuAbierto, setMobileMenuAbierto] = useState(false);

  // Datos en estado local (provenientes del servidor local SQLite)
  const [documentos, setDocumentos] = useState<CompraDocumento[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [estadoCopias, setEstadoCopias] = useState<EstadoCopias | null>(null);
  const [copiasConsultadas, setCopiasConsultadas] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Modales
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [modalExcelAbierto, setModalExcelAbierto] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);
  // Compra manual abierta desde Inventario: por ítems y al guardar vuelve al inventario
  const [manualDetallado, setManualDetallado] = useState(false);
  const [modalVentaAbierto, setModalVentaAbierto] = useState(false);
  // Ítems que llegan desde "Precios de Venta" para facturarlos
  const [itemsVentaIniciales, setItemsVentaIniciales] = useState<VentaItem[] | undefined>(undefined);
  // Venta que se corrige desde "Reportes de Ventas"
  const [ventaParaEditar, setVentaParaEditar] = useState<Venta | undefined>(undefined);
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
      dataService
        .obtenerEstadoCopias()
        .then(setEstadoCopias)
        .catch(() => undefined)
        .finally(() => setCopiasConsultadas(true));
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
    if (!puede(tab)) return;
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

  const { mostrarToast } = useToast();
  // Avisos al abrir: una sola vez por perfil en la sesión, y solo a quien le corresponden
  useEffect(() => {
    if (cargando || !copiasConsultadas || avisosMostrados.has(perfil.id)) return;
    avisosMostrados.add(perfil.id);
    const copia = estadoRecordatorio(estadoCopias);
    if (copia.vencido && puede('copias')) {
      mostrarToast('warning', 'Copia de seguridad pendiente', `${copia.texto} Vaya a "Copias de Seguridad".`, 12000);
    }
    const r = resumenAlertas(documentos);
    if (r.urgentes === 0 || !puede('cuentas_pagar')) return;
    const partes = [
      r.vencidas.length && `${r.vencidas.length} vencida(s) por ${formatCOP(sumaSaldos(r.vencidas))}`,
      r.hoy.length && `${r.hoy.length} vence(n) hoy por ${formatCOP(sumaSaldos(r.hoy))}`,
      r.manana.length && `${r.manana.length} vence(n) mañana por ${formatCOP(sumaSaldos(r.manana))}`,
    ].filter(Boolean);
    const texto = `Facturas de proveedores: ${partes.join('; ')}.`;
    mostrarToast('warning', 'Pagos próximos a vencer', texto, 12000);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('VetCompras: pagos por vencer', { body: texto });
      }
    } catch {
      // Avisos de Windows no disponibles
    }
  }, [cargando, copiasConsultadas, documentos, estadoCopias, mostrarToast]);

  const totalPendientes = documentos.filter((d) => d.saldoPendiente > 0).length;
  const alertasPago = resumenAlertas(documentos);

  const titulos: Record<NavItem, string> = {
    dashboard: 'Panel Central • Año en Curso',
    panel_ventas: 'Panel de Ventas',
    panel_compras: 'Panel de Compras y Gastos',
    reportes_ventas: 'Reportes de Ventas',
    reportes_compras: 'Reportes de Compras y Gastos',
    ventas: 'Módulo de Ventas de la Veterinaria',
    compras: 'Registro de Compras y Gastos',
    cuentas_pagar: 'Cuentas por Pagar a Proveedores',
    inventario: 'Inventario de Productos',
    precios: 'Cálculo de Precios de Venta',
    cargar_factura: 'Cargar Compras',
    cargar_excel: 'Importar Facturas desde Excel',
    registro_manual: 'Registro Manual de Documento',
    reportes: 'Reportería e Informes Tributarios (DIAN)',
    catalogos: 'Catálogos: productos, servicios, gastos, categorías y proveedores',
    configuracion: 'Configuración de la Veterinaria y Marca',
    seguridad: dataService.modoAcceso() === 'libre' ? 'Perfiles, Ingreso y Bitácora' : 'Perfiles, Usuarios y Bitácora',
    copias: 'Copias de Seguridad',
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
        alertasPago={alertasPago.urgentes}
        copiaPendiente={estadoRecordatorio(estadoCopias).vencido}
        mobileOpen={mobileMenuAbierto}
        setMobileOpen={setMobileMenuAbierto}
        modulos={permitidos}
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
          documentos={documentos}
          onVerCartera={() => setCurrentTab('cuentas_pagar')}
          estadoCopias={estadoCopias}
          onVerCopias={() => setCurrentTab('copias')}
          puede={puede}
          perfil={perfil}
          onCambiarPerfil={onCambiarPerfil}
          onNuevaVenta={() => setModalVentaAbierto(true)}
        />

        {dataService.etapa() === 'prueba' && (
          <div className="shrink-0 px-4 py-1.5 bg-amber-400 text-amber-950 text-xs font-semibold flex items-center justify-between gap-3">
            <span>
              VERSIÓN DE PRUEBA {dataService.version()} · Use datos de ensayo. Si algo falla o tiene una idea, presione "Observación".
            </span>
            <BotonObservacion modulo={titulos[currentTab]} />
          </div>
        )}

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
              {currentTab === 'reportes_ventas' && (
                <ReportesVentasPerfil
                  ventas={ventas}
                  onEditarVenta={
                    puede('ventas') || puede('reportes_ventas')
                      ? (v) => {
                          setVentaParaEditar(v);
                          setModalVentaAbierto(true);
                        }
                      : undefined
                  }
                />
              )}

              {currentTab === 'reportes_compras' && (
                <ReportesComprasPerfil documentos={documentos} categorias={categorias} onEditarDocumento={handleEditarDocumento} />
              )}

              {currentTab === 'panel_ventas' && (
                <PanelVentas
                  ventas={ventas}
                  onNuevaVenta={puede('ventas') ? () => setModalVentaAbierto(true) : undefined}
                  onIrAVentas={puede('ventas') ? () => setCurrentTab('ventas') : undefined}
                />
              )}

              {currentTab === 'panel_compras' && (
                <PanelCompras
                  documentos={documentos}
                  categorias={categorias}
                  onNuevaCompra={
                    puede('compras')
                      ? () => {
                          setDocumentoParaEditar(undefined);
                          setModalManualAbierto(true);
                        }
                      : undefined
                  }
                  onIrACompras={puede('compras') ? () => setCurrentTab('compras') : undefined}
                  onIrACuentasPorPagar={puede('cuentas_pagar') ? () => setCurrentTab('cuentas_pagar') : undefined}
                />
              )}

              {currentTab === 'dashboard' && (
                <DashboardView
                  documentos={documentos}
                  categorias={categorias}
                  centrosCosto={centrosCosto}
                  ventas={ventas}
                  onIrACompras={() => setCurrentTab('compras')}
                  onIrACuentasPorPagar={() => setCurrentTab('cuentas_pagar')}
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

              {currentTab === 'copias' && (
                <CopiasSeguridadView onSesionTerminada={onSalir} onDatosActualizados={recargarDatos} />
              )}

              {currentTab === 'precios' && (
                <PreciosView
                  onFacturar={(items) => {
                    setItemsVentaIniciales(items);
                    setModalVentaAbierto(true);
                  }}
                />
              )}

              {currentTab === 'inventario' && (
                <InventarioView onIrACompras={() => setCurrentTab('compras')} />
              )}

              {currentTab === 'cuentas_pagar' && (
                <CuentasPorPagarView documentos={documentos} onDatosActualizados={recargarDatos} />
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
                  ventas={ventas}
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
      {(puede('ventas') || puede('compras') || puede('cargar_factura')) && (
        <BotonFlotanteNuevo
          onNuevaVenta={puede('ventas') ? () => setModalVentaAbierto(true) : undefined}
          onSubirFactura={puede('cargar_factura') ? () => setModalCargaAbierto(true) : undefined}
          onCargarExcel={puede('cargar_factura') ? () => setModalExcelAbierto(true) : undefined}
          onRegistroManual={
            puede('compras')
              ? () => {
                  setDocumentoParaEditar(undefined);
                  setModalManualAbierto(true);
                }
              : undefined
          }
        />
      )}

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
          detallado={manualDetallado}
          onGuardado={() => {
            // Al corregir desde un reporte o un panel se queda en esa pantalla
            if (!documentoParaEditar) setCurrentTab(manualDetallado ? 'inventario' : 'compras');
            setManualDetallado(false);
            setModalManualAbierto(false);
            setDocumentoParaEditar(undefined);
            recargarDatos();
          }}
          onCerrar={() => {
            setManualDetallado(false);
            setModalManualAbierto(false);
            setDocumentoParaEditar(undefined);
          }}
          onProveedorCreado={recargarDatos}
        />
      )}

      {/* Modal Registro Rápido de Venta */}
      {modalVentaAbierto && (
        <ModalRegistroVenta
          itemsIniciales={itemsVentaIniciales}
          ventaParaEditar={ventaParaEditar}
          onGuardado={() => {
            const editando = !!ventaParaEditar;
            setItemsVentaIniciales(undefined);
            setVentaParaEditar(undefined);
            setModalVentaAbierto(false);
            recargarDatos();
            // Al corregir desde un reporte se queda en el reporte
            if (!editando) setCurrentTab('ventas');
          }}
          onCerrar={() => {
            setItemsVentaIniciales(undefined);
            setVentaParaEditar(undefined);
            setModalVentaAbierto(false);
          }}
        />
      )}
    </div>
  );
}

type EstadoAcceso =
  | { tipo: 'cargando' }
  | { tipo: 'sin_servidor'; error: string }
  | { tipo: 'configuracion' }
  | { tipo: 'inicio'; marca: NonNullable<EstadoSesion['marca']>; mensaje?: string }
  | { tipo: 'ingreso'; mensaje?: string }
  | { tipo: 'cambio_clave'; usuario: UsuarioActual }
  | { tipo: 'listo'; usuario: UsuarioActual };

/** Controla el acceso: primer uso, ingreso, cambio obligatorio de contraseña y sesión vencida. */
const MARCA_DEFECTO: NonNullable<EstadoSesion['marca']> = { nombre: MARCA.nombre, slogan: MARCA.slogan, logoUrl: '', colorPrimario: MARCA.colorPrimario };

function PuertaDeAcceso() {
  const [estado, setEstado] = useState<EstadoAcceso>({ tipo: 'cargando' });

  const consultar = useCallback(async (mensaje?: string) => {
    try {
      const sesion = await dataService.obtenerSesion();
      if (sesion.requiereConfiguracion) setEstado({ tipo: 'configuracion' });
      else if (!sesion.usuario && sesion.modoAcceso === 'libre') {
        setEstado({ tipo: 'inicio', marca: sesion.marca || MARCA_DEFECTO, mensaje });
      } else if (!sesion.usuario) setEstado({ tipo: 'ingreso', mensaje });
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
        consultar(
          dataService.modoAcceso() === 'libre'
            ? 'Se volvió a la pantalla de inicio por inactividad.'
            : 'Su sesión se cerró por inactividad o desde otro equipo. Ingrese de nuevo.'
        );
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
            <button onClick={() => consultar()} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold">
              Reintentar
            </button>
          </div>
        </div>
      );
    case 'configuracion':
      return <PantallaAcceso key="configuracion" modo="configuracion" onListo={alIngresar} />;
    case 'inicio':
      return <PantallaInicio key="inicio" marca={estado.marca} mensaje={estado.mensaje} onListo={alIngresar} />;
    case 'ingreso':
      return <PantallaAcceso key="ingreso" modo="ingreso" mensaje={estado.mensaje} onListo={alIngresar} />;
    case 'cambio_clave':
      return <PantallaAcceso key="cambio_clave" modo="cambio_clave" usuario={estado.usuario} onListo={alIngresar} />;
    case 'listo':
      return (
        <ConPerfil
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
