/**
 * Arranque de Sistema de Control 2.0 · Móvil (Android).
 *
 * Usa las mismas pantallas del PC. Las llamadas a /api las responde el motor
 * local (src/demo/servidorDemo.ts en modo 'movil') y todo se guarda en archivos
 * del celular: sin internet y sin servidor.
 */
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Share } from '@capacitor/share';
import { Encoding } from '@capacitor/filesystem';
import { App as AppCapacitor } from '@capacitor/app';
import { iniciarServidorLocal, instalarServidorDemo, servidorLocal, ErrorHttp } from '../demo/servidorDemo';
import { configurarGuardadoArchivos } from '../services/reciboPdf';
import { configurarDescargaRespaldo } from '../services/dataService';
import App from '../App';
import { AlertaCopiaSemanal } from '../components/respaldos/AlertaCopiaSemanal';
import '../fuentes';
import '../index.css';
import './movil.css';
import * as almacen from './almacenMovil';
import { codigoEquipo, leerClave, verificarLicencia, type EstadoLicencia } from './licenciaMovil';
import { AvisoPrueba } from './AvisoPrueba';

/** Versión de prueba: sin licencia, con datos de ejemplo y tope de 60 ventas y 60 compras. */
const PRUEBA = (import.meta as any).env?.VITE_PRUEBA === '1';
export const VERSION_MOVIL = PRUEBA ? '2.0.0-movil-prueba' : '2.0.0-movil';
(window as any).__SISTEMA_CONTROL_MOVIL__ = true;

const nativo = Capacitor.isNativePlatform();

/** Entrega un archivo al usuario: lo guarda en Documentos y abre "Compartir" (WhatsApp, Drive, correo…). */
async function entregarArchivo(nombre: string, datos: string, comoTexto: boolean): Promise<void> {
  if (!nativo) {
    // Vista previa en navegador (pruebas): descarga normal
    const blob = comoTexto ? new Blob([datos], { type: 'application/json' }) : await (await fetch(`data:application/octet-stream;base64,${datos}`)).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    return;
  }
  const { uri } = await almacen.guardarParaUsuario(nombre, datos, comoTexto ? Encoding.UTF8 : undefined);
  try {
    await Share.share({ title: nombre, files: [uri], dialogTitle: 'Guardar o enviar el archivo' });
  } catch {
    /* el usuario cerró la ventana de compartir: el archivo igual quedó en Documentos */
  }
}

async function iniciar() {
  let id = 'web';
  try {
    id = (await Device.getId()).identifier;
  } catch {
    /* vista previa web sin almacenamiento: código fijo */
  }
  const equipo = await codigoEquipo('android:' + id);
  let claveGuardada = await almacen.leerLicencia();
  let licencia: EstadoLicencia = PRUEBA
    ? { activa: true, equipo, cliente: 'Versión de prueba (sin licencia)' }
    : await verificarLicencia(claveGuardada, equipo);
  let diaVerificado = new Date().toISOString().slice(0, 10);

  const estadoLicencia = async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    if (!PRUEBA && hoy !== diaVerificado) {
      licencia = await verificarLicencia(claveGuardada, equipo);
      diaVerificado = hoy;
    }
    return licencia;
  };

  const administrador = () => {
    const u = servidorLocal.usuario();
    if (!u) throw new ErrorHttp(401, 'Su sesión terminó. Ingrese nuevamente.', { sesionVencida: true });
    if (u.rol !== 'administrador') throw new ErrorHttp(403, 'Su usuario no tiene permiso para esta acción. Solicítela a un administrador.');
    return u;
  };

  const nueva = iniciarServidorLocal(
    {
      modo: 'movil',
      version: VERSION_MOVIL,
      ...(PRUEBA ? { limite: 60, datosEjemplo: true } : {}),
      persistir: almacen.guardarEstado,
      guardarRespaldo: almacen.guardarRespaldo,
      async antes(metodo, ruta, cuerpo) {
        // ---- licencia del celular
        if (ruta === '/licencia' && metodo === 'GET') return { respuesta: { ...(await estadoLicencia()), exigida: !PRUEBA, demo: PRUEBA } };
        if (PRUEBA && ruta === '/licencia') throw new ErrorHttp(400, 'La versión de prueba no usa licencia. Instale la app definitiva para activarla.');
        if (ruta === '/licencia' && metodo === 'POST') {
          const clave = String(cuerpo?.clave || '').replace(/\s+/g, '');
          if (!clave) throw new ErrorHttp(400, 'Pegue la clave de licencia o cargue el archivo .lic.');
          try {
            leerClave(clave);
          } catch (e: any) {
            throw new ErrorHttp(400, e.message);
          }
          const estado = await verificarLicencia(clave, equipo);
          if (!estado.activa) throw new ErrorHttp(400, estado.motivo || 'Clave no válida.');
          await almacen.guardarLicencia(clave);
          claveGuardada = clave;
          licencia = estado;
          servidorLocal.auditar('(activación)', 'LICENCIA_ACTIVADA', `${estado.cliente || ''} · celular ${equipo}`);
          return { respuesta: { ...estado, exigida: true } };
        }
        const lic = await estadoLicencia();
        if (!lic.activa) throw new ErrorHttp(402, lic.motivo || 'Licencia no activada.', { codigo: 'LICENCIA', equipo });

        // ---- copias de seguridad en archivos del celular
        if (ruta === '/respaldos' && metodo === 'GET') {
          administrador();
          return {
            respuesta: {
              carpeta: `Memoria del celular · cada copia también queda en Documentos/${almacen.CARPETA_VISIBLE}`,
              carpetaExterna: '',
              ultimoRespaldoExterno: null,
              respaldos: await almacen.listarRespaldos(),
            },
          };
        }
        if (ruta === '/respaldos' && metodo === 'POST') {
          const u = servidorLocal.usuario();
          if (!u) throw new ErrorHttp(401, 'Su sesión terminó. Ingrese nuevamente.', { sesionVencida: true });
          const nombre = servidorLocal.crearRespaldo('manual');
          servidorLocal.ultimaCopia('copia manual');
          servidorLocal.auditar(u.usuario, 'Respaldo manual creado', nombre);
          return { respuesta: { ok: true, ruta: `Documentos/${almacen.CARPETA_VISIBLE}/${nombre}`, externo: null } };
        }
        const m = ruta.match(/^\/respaldos\/([^/]+)\/restaurar$/);
        if (m && metodo === 'POST') {
          const u = administrador();
          const nombre = decodeURIComponent(m[1]);
          const texto = await almacen.leerRespaldo(nombre);
          if (!texto) throw new ErrorHttp(404, 'El respaldo no existe.');
          let contenido: any;
          try {
            contenido = JSON.parse(texto);
          } catch {
            throw new ErrorHttp(400, 'El archivo de respaldo está dañado.');
          }
          const previo = servidorLocal.crearRespaldo('antes-de-restaurar');
          servidorLocal.aplicarRespaldo(contenido);
          servidorLocal.auditar(u.usuario, 'Base de datos restaurada desde respaldo', `${nombre} (estado anterior guardado en ${previo})`);
          return { respuesta: { ok: true, respaldoPrevio: previo } };
        }
        if (ruta === '/respaldos/cargar') {
          throw new ErrorHttp(400, 'En el celular se cargan copias .json. Si la copia viene del PC, allá use "Datos y Respaldo → Exportar respaldo completo" y cargue ese archivo .json aquí.');
        }
        if (ruta === '/respaldos/abrir-carpeta') {
          return { respuesta: { abierta: false, carpeta: `Las copias quedan en Documentos › ${almacen.CARPETA_VISIBLE}. Ábrala con la app "Archivos" o "Mis archivos" del celular.` } };
        }
        if (ruta === '/respaldos/externo') {
          throw new ErrorHttp(400, 'En el celular use "Compartir copia" para enviarla a Drive, WhatsApp o correo.');
        }
        if (ruta === '/sistema/apagar' && metodo === 'POST') {
          await servidorLocal.esperarEscrituras();
          if (nativo) setTimeout(() => AppCapacitor.exitApp(), 300);
          return { respuesta: { ok: true } };
        }
        return null;
      },
    },
    await almacen.leerEstado()
  );

  instalarServidorDemo();
  // Instalación nueva: el estado inicial queda escrito de una vez
  if (nueva) servidorLocal.guardar();

  // Copia automática diaria (al abrir la app y al volver a ella)
  const copiaDiaria = async () => {
    if (!licencia.activa || (await almacen.hayRespaldoDiarioDeHoy())) return;
    servidorLocal.crearRespaldo('diario');
    await servidorLocal.esperarEscrituras();
  };
  await copiaDiaria().catch(() => undefined);
  AppCapacitor.addListener('resume', () => void copiaDiaria().catch(() => undefined)).catch(() => undefined);

  // PDF, Excel y copias: se guardan en Documentos y se ofrecen para compartir
  configurarGuardadoArchivos(async (blob, nombre) => {
    await entregarArchivo(nombre, await almacen.blobABase64(blob), false);
  });
  configurarDescargaRespaldo(async (nombre) => {
    const texto = await almacen.leerRespaldo(nombre);
    if (!texto) throw new Error('No se encontró la copia.');
    servidorLocal.ultimaCopia('copia compartida desde el celular');
    servidorLocal.guardar();
    await servidorLocal.esperarEscrituras();
    await entregarArchivo(nombre, texto, true);
  });

  // WhatsApp, correo y enlaces externos se abren con la app del celular
  const abrirOriginal = window.open.bind(window);
  window.open = ((url?: string | URL, ...resto: any[]) => {
    const texto = String(url || '');
    if (nativo && /^(https?:|mailto:|tel:|whatsapp:)/i.test(texto)) {
      window.location.href = texto;
      return null;
    }
    return abrirOriginal(url as any, ...resto);
  }) as typeof window.open;

  createRoot(document.getElementById('root')!).render(
    <>
      <App />
      <AlertaCopiaSemanal />
      {PRUEBA && <AvisoPrueba />}
    </>
  );
}

iniciar().catch((e) => {
  document.getElementById('root')!.innerHTML = `<div style="font-family:sans-serif;padding:24px"><h2>No se pudo abrir Sistema de Control</h2><p>${String(e?.message || e)}</p></div>`;
});
