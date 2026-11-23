/**
 * Archivos de la app en el celular.
 *
 *  - Datos (privados de la app):  sistemacontrol/estado.json
 *    Escritura segura: se escribe estado.nuevo, el anterior pasa a estado.anterior
 *    y el nuevo toma el nombre definitivo. Si el celular se apaga a mitad de una
 *    escritura, al abrir se usa la última versión completa.
 *  - Licencia (privada):          sistemacontrol/licencia.lic (aparte de los datos)
 *  - Respaldos (privados):        sistemacontrol/respaldos/*.json
 *  - Copia visible:               Documentos/SistemaControl/  (sobrevive si se
 *    desinstala la app; se ve en el administrador de archivos del celular)
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem as FilesystemNativo } from '@capacitor/filesystem';

/**
 * Fuera del celular (vista previa web de la prueba) los archivos se simulan en el
 * almacenamiento del navegador, o en memoria si el navegador no lo permite.
 */
const memoria = new Map<string, string>();
const clave = (o: { path: string; directory?: string }) => `sc-archivo:${o.directory || ''}:${o.path}`;
const web = {
  get(k: string) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    } catch {
      /* sin almacenamiento */
    }
    return memoria.get(k) ?? null;
  },
  set(k: string, v: string) {
    memoria.set(k, v);
    try {
      localStorage.setItem(k, v);
    } catch {
      /* queda en memoria */
    }
  },
  del(k: string) {
    memoria.delete(k);
    try {
      localStorage.removeItem(k);
    } catch {
      /* nada */
    }
  },
  keys(): string[] {
    const ks = new Set(memoria.keys());
    try {
      for (let i = 0; i < localStorage.length; i++) ks.add(localStorage.key(i)!);
    } catch {
      /* nada */
    }
    return [...ks];
  },
};
const FilesystemWeb = {
  async readFile(o: any) {
    const v = web.get(clave(o));
    if (v === null) throw new Error('No existe');
    return { data: v };
  },
  async writeFile(o: any) {
    web.set(clave(o), String(o.data));
    return { uri: 'web://' + o.path };
  },
  async deleteFile(o: any) {
    web.del(clave(o));
  },
  async rename(o: any) {
    const v = web.get(clave({ path: o.from, directory: o.directory }));
    if (v === null) throw new Error('No existe');
    web.set(clave({ path: o.to, directory: o.toDirectory ?? o.directory }), v);
    web.del(clave({ path: o.from, directory: o.directory }));
  },
  async readdir(o: any) {
    const pref = clave({ path: o.path + '/', directory: o.directory });
    return {
      files: web
        .keys()
        .filter((k) => k.startsWith(pref) && !k.slice(pref.length).includes('/'))
        .map((k) => ({ name: k.slice(pref.length), size: (web.get(k) || '').length, mtime: Date.now() })),
    };
  },
};
const Filesystem: typeof FilesystemNativo = (Capacitor.isNativePlatform() ? FilesystemNativo : FilesystemWeb) as any;

const CARPETA = 'sistemacontrol';
const RESPALDOS = `${CARPETA}/respaldos`;
/** La versión de prueba usa su propia carpeta para no mezclar copias con la app definitiva. */
export const CARPETA_VISIBLE = (import.meta as any).env?.VITE_PRUEBA === '1' ? 'SistemaControl-Prueba' : 'SistemaControl';
const MAX_RESPALDOS = 40;

const privado = { directory: Directory.Data };

async function leerTexto(path: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path, ...privado, encoding: Encoding.UTF8 });
    return typeof r.data === 'string' ? r.data : await (r.data as Blob).text();
  } catch {
    return null;
  }
}

async function borrar(path: string) {
  try {
    await Filesystem.deleteFile({ path, ...privado });
  } catch {
    /* no existía */
  }
}

async function escribirTexto(path: string, data: string) {
  await Filesystem.writeFile({ path, data, ...privado, encoding: Encoding.UTF8, recursive: true });
}

// ------------------------------------------------------------------ datos
export async function leerEstado(): Promise<string | null> {
  for (const nombre of ['estado.json', 'estado.nuevo', 'estado.anterior']) {
    const texto = await leerTexto(`${CARPETA}/${nombre}`);
    if (!texto) continue;
    try {
      JSON.parse(texto);
      return texto;
    } catch {
      /* archivo incompleto: se prueba el siguiente */
    }
  }
  return null;
}

export async function guardarEstado(json: string): Promise<void> {
  await escribirTexto(`${CARPETA}/estado.nuevo`, json);
  await borrar(`${CARPETA}/estado.anterior`);
  try {
    await Filesystem.rename({ from: `${CARPETA}/estado.json`, to: `${CARPETA}/estado.anterior`, ...privado, toDirectory: Directory.Data });
  } catch {
    /* primera vez: no hay estado.json */
  }
  await Filesystem.rename({ from: `${CARPETA}/estado.nuevo`, to: `${CARPETA}/estado.json`, ...privado, toDirectory: Directory.Data });
}

// --------------------------------------------------------------- licencia
export const leerLicencia = () => leerTexto(`${CARPETA}/licencia.lic`).then((t) => t?.trim() || null);
export const guardarLicencia = (clave: string) => escribirTexto(`${CARPETA}/licencia.lic`, clave + '\n');

// -------------------------------------------------------------- respaldos
export interface InfoRespaldo {
  nombre: string;
  tamano: number;
  fecha: string;
}

/** Fecha del nombre sistemacontrol-2026-11-23T10-15-00-manual.json */
function fechaDeNombre(nombre: string, mtime?: number): string {
  const m = nombre.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (m) return new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`).toISOString();
  return new Date(mtime || Date.now()).toISOString();
}

export async function listarRespaldos(): Promise<InfoRespaldo[]> {
  try {
    const { files } = await Filesystem.readdir({ path: RESPALDOS, ...privado });
    return files
      .filter((f) => f.name.endsWith('.json'))
      .map((f) => ({ nombre: f.name, tamano: f.size || 0, fecha: fechaDeNombre(f.name, f.mtime) }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch {
    return [];
  }
}

export async function guardarRespaldo(nombre: string, contenido: string): Promise<void> {
  await escribirTexto(`${RESPALDOS}/${nombre}`, contenido);
  // Copia visible en Documentos: queda aunque se desinstale la app
  await copiaVisible(nombre, contenido, Encoding.UTF8).catch(() => undefined);
  const todos = await listarRespaldos();
  for (const viejo of todos.slice(MAX_RESPALDOS)) await borrar(`${RESPALDOS}/${viejo.nombre}`);
}

export const leerRespaldo = (nombre: string) => leerTexto(`${RESPALDOS}/${nombre.replace(/[\\/]/g, '')}`);

export async function hayRespaldoDiarioDeHoy(): Promise<boolean> {
  const hoy = new Date().toISOString().slice(0, 10);
  return (await listarRespaldos()).some((r) => r.nombre.includes(hoy) && r.nombre.includes('diario'));
}

// ------------------------------------------------- archivos para el usuario
/** Escribe en Documentos/SistemaControl. Devuelve la uri del archivo. */
async function copiaVisible(nombre: string, data: string, encoding?: Encoding): Promise<string> {
  const r = await Filesystem.writeFile({ path: `${CARPETA_VISIBLE}/${nombre}`, data, directory: Directory.Documents, recursive: true, ...(encoding ? { encoding } : {}) });
  return r.uri;
}

/**
 * Guarda un archivo para el usuario (PDF, Excel, copia de seguridad): en
 * Documentos/SistemaControl si el celular lo permite y, si no, en la memoria
 * temporal de la app. Devuelve la uri para compartirlo y dónde quedó.
 */
export async function guardarParaUsuario(nombre: string, datos: string, encoding?: Encoding): Promise<{ uri: string; visible: boolean }> {
  try {
    return { uri: await copiaVisible(nombre, datos, encoding), visible: true };
  } catch {
    const r = await Filesystem.writeFile({ path: `compartir/${nombre}`, data: datos, directory: Directory.Cache, recursive: true, ...(encoding ? { encoding } : {}) });
    return { uri: r.uri, visible: false };
  }
}

export async function blobABase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < buffer.length; i += 0x8000) binario += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binario);
}
