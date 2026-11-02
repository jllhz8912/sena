/**
 * Perfiles de ingreso: después de "Ingresar" se elige Ventas, Compras y Gastos o
 * Administración, y cada perfil ve solo los módulos que tiene permitidos.
 * Administración ve todo y desde "Ingreso y Bitácora" edita perfiles y permisos.
 */

/** Módulos del menú que se pueden permitir o quitar a un perfil. */
export const MODULOS_SISTEMA: { id: string; label: string; grupo: 'Ventas' | 'Compras' | 'Gestión' | 'Sistema' }[] = [
  { id: 'dashboard', label: 'Dashboard (panel central)', grupo: 'Gestión' },
  { id: 'ventas', label: 'Módulo de Ventas', grupo: 'Ventas' },
  { id: 'precios', label: 'Precios de Venta', grupo: 'Ventas' },
  { id: 'compras', label: 'Compras y Gastos', grupo: 'Compras' },
  { id: 'cuentas_pagar', label: 'Cuentas por Pagar', grupo: 'Compras' },
  { id: 'cargar_factura', label: 'Cargar Compras (XML / PDF / Excel)', grupo: 'Compras' },
  { id: 'inventario', label: 'Inventario', grupo: 'Compras' },
  { id: 'catalogos', label: 'Catálogos', grupo: 'Gestión' },
  { id: 'reportes', label: 'Reportes y DIAN', grupo: 'Gestión' },
  { id: 'configuracion', label: 'Configuración (logo y colores)', grupo: 'Sistema' },
  { id: 'copias', label: 'Copias de Seguridad y Datos', grupo: 'Sistema' },
  { id: 'seguridad', label: 'Ingreso, Perfiles y Bitácora', grupo: 'Sistema' },
];

export const ID_ADMINISTRACION = 'administracion';

export interface PerfilAcceso {
  id: string;
  nombre: string;
  descripcion: string;
  modulos: string[];
  /** Pide un PIN para entrar con este perfil */
  tienePin?: boolean;
}

export const PERFILES_DEFECTO: PerfilAcceso[] = [
  {
    id: 'ventas',
    nombre: 'Ventas',
    descripcion: 'Registrar ventas, consultar precios y el catálogo de productos y servicios.',
    modulos: ['ventas', 'precios', 'catalogos'],
  },
  {
    id: 'compras',
    nombre: 'Compras y Gastos',
    descripcion: 'Registrar compras y gastos, cuentas por pagar, cargar facturas e inventario.',
    modulos: ['compras', 'cuentas_pagar', 'cargar_factura', 'inventario', 'catalogos'],
  },
  {
    id: ID_ADMINISTRACION,
    nombre: 'Administración',
    descripcion: 'Todos los módulos, reportes, configuración, copias y permisos de los perfiles.',
    modulos: MODULOS_SISTEMA.map((m) => m.id),
  },
];

/** Administración siempre conserva todos los módulos (alguien debe poder administrar). */
export function modulosDe(perfil: Pick<PerfilAcceso, 'id' | 'modulos'> | null | undefined): Set<string> {
  if (!perfil) return new Set();
  if (perfil.id === ID_ADMINISTRACION) return new Set(MODULOS_SISTEMA.map((m) => m.id));
  return new Set(perfil.modulos.filter((m) => MODULOS_SISTEMA.some((x) => x.id === m)));
}

/** Primer módulo del perfil en el orden del menú (pantalla con que abre). */
export function moduloInicial(perfil: Pick<PerfilAcceso, 'id' | 'modulos'>): string {
  const permitidos = modulosDe(perfil);
  return MODULOS_SISTEMA.find((m) => permitidos.has(m.id))?.id || 'dashboard';
}

/** Limpia y valida la lista que llega para guardar. Lanza un error legible si no sirve. */
export function normalizarPerfiles(lista: unknown): PerfilAcceso[] {
  if (!Array.isArray(lista) || !lista.length) throw new Error('Debe quedar al menos un perfil.');
  const ids = new Set<string>();
  const perfiles = lista.map((p: any, i) => {
    const nombre = String(p?.nombre || '').trim();
    if (!nombre) throw new Error(`El perfil ${i + 1} no tiene nombre.`);
    const id =
      String(p?.id || '').trim() ||
      nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (ids.has(id)) throw new Error(`Hay dos perfiles con el mismo nombre: ${nombre}.`);
    ids.add(id);
    const modulos = (Array.isArray(p?.modulos) ? p.modulos : []).map(String).filter((m: string) => MODULOS_SISTEMA.some((x) => x.id === m));
    if (id !== ID_ADMINISTRACION && !modulos.length) throw new Error(`El perfil ${nombre} debe tener al menos un módulo.`);
    return { id, nombre: nombre.slice(0, 40), descripcion: String(p?.descripcion || '').trim().slice(0, 160), modulos: id === ID_ADMINISTRACION ? MODULOS_SISTEMA.map((m) => m.id) : [...new Set<string>(modulos)] };
  });
  if (!perfiles.some((p) => p.id === ID_ADMINISTRACION)) throw new Error('El perfil Administración no se puede eliminar.');
  return perfiles;
}
