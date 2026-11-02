import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, Download, Package, Pencil, Plus, Receipt, Search, Stethoscope, Trash2, X } from 'lucide-react';
import { Categoria, CentroCosto, MovimientoInventario, Producto, UsoConcepto, Venta } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import {
  CATEGORIAS_SERVICIO,
  CATEGORIAS_VENTA,
  CATEGORIAS_VENTA_TODAS,
  SUBCATEGORIAS_POR_CATEGORIA,
  formatCOP,
} from '../../utils/formatters';
import {
  ConceptoVendido,
  TIPOS_CONCEPTO,
  TipoConcepto,
  USOS_CONCEPTO,
  conceptoDuplicado,
  controlaInventario,
  tipoDe,
  usosDe,
  usosPorDefecto,
  vendidosSinCatalogo,
} from '../../utils/conceptos';
import { normalizarNombre } from '../../utils/inventario';

interface ConceptosCatalogoProps {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  ventas: Venta[];
  onDatosActualizados: () => void;
}

const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const input = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';
const etiqueta = 'block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1';
const pesos = (v?: number) => (v ? Math.round(v).toLocaleString('es-CO') : '');
const leerPesos = (t: string) => Number(t.replace(/\D/g, '')) || 0;
const nombreCategoriaVenta = (id?: string) => (id ? CATEGORIAS_VENTA_TODAS.find((c) => c.id === id)?.label || id : '');

const ICONO_TIPO: Record<TipoConcepto, React.ComponentType<{ className?: string }>> = {
  producto: Package,
  servicio: Stethoscope,
  gasto: Receipt,
};
const COLOR_TIPO: Record<TipoConcepto, string> = {
  producto: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  servicio: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  gasto: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
};

/**
 * Catálogo único de productos, servicios y conceptos de gasto: lo que se crea
 * aquí aparece al vender (buscador), al registrar compras o gastos (sugerencias
 * de cada ítem), en Inventario (solo productos) y en Precios de Venta.
 */
export const ConceptosCatalogo: React.FC<ConceptosCatalogoProps> = ({ categorias, centrosCosto, ventas, onDatosActualizados }) => {
  const { mostrarToast } = useToast();
  const [conceptos, setConceptos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<'' | TipoConcepto>('');
  const [uso, setUso] = useState<'' | UsoConcepto>('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [editando, setEditando] = useState<Producto | null | undefined>(undefined);
  const [aEliminar, setAEliminar] = useState<Producto | null>(null);
  const [traer, setTraer] = useState(false);

  const cargar = async () => {
    try {
      const [p, m] = await Promise.all([dataService.obtenerProductos(), dataService.obtenerMovimientos()]);
      setConceptos(p);
      setMovimientos(m);
    } catch (err: any) {
      mostrarToast('error', 'No se pudo cargar el catálogo', err?.message);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const despuesDeGuardar = async () => {
    await cargar();
    onDatosActualizados();
  };

  const vendidos = useMemo(() => vendidosSinCatalogo(ventas, conceptos, (c) => CATEGORIAS_SERVICIO.has(c)), [ventas, conceptos]);
  const movsPorConcepto = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of movimientos) m.set(x.productoId, (m.get(x.productoId) || 0) + 1);
    return m;
  }, [movimientos]);

  const filtrados = useMemo(() => {
    const palabras = normalizarNombre(texto).split(' ').filter(Boolean);
    return conceptos.filter((c) => {
      if (!verInactivos && c.activo === false) return false;
      if (tipo && tipoDe(c) !== tipo) return false;
      if (uso && !usosDe(c).includes(uso)) return false;
      if (!palabras.length) return true;
      const pajar = normalizarNombre(
        [c.nombre, c.codigo, c.grupo, ...(c.alias || []), nombreCategoriaVenta(c.categoriaVenta), categorias.find((x) => x.id === c.categoriaCompraId)?.nombre].filter(Boolean).join(' ')
      );
      return palabras.every((p) => pajar.includes(p));
    });
  }, [conceptos, texto, tipo, uso, verInactivos, categorias]);

  const cuenta = (t: TipoConcepto) => conceptos.filter((c) => c.activo !== false && tipoDe(c) === t).length;

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await dataService.eliminarProducto(aEliminar.id);
      mostrarToast('info', 'Concepto eliminado', `${aEliminar.nombre} ya no aparece en ventas, compras ni gastos.`);
      await despuesDeGuardar();
    } catch (err: any) {
      mostrarToast('error', 'No se pudo eliminar', err?.message);
    } finally {
      setAEliminar(null);
    }
  };

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
      activo ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <p className="text-xs text-slate-500 max-w-2xl">
          Un solo catálogo para todo: lo que cree aquí aparece al <strong>vender</strong> (buscador de la venta), al registrar <strong>compras</strong> y{' '}
          <strong>gastos</strong> (sugerencias de cada ítem), en <strong>Inventario</strong> (solo productos) y en <strong>Precios de Venta</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          {vendidos.length > 0 && (
            <button
              id="btn-traer-ventas"
              onClick={() => setTraer(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 font-semibold text-xs"
              title="Crear en el catálogo lo que se ha vendido escribiéndolo a mano"
            >
              <Download className="w-4 h-4" /> Traer de las ventas ({vendidos.length})
            </button>
          )}
          <button
            id="btn-nuevo-concepto"
            onClick={() => setEditando(null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" /> Nuevo producto, servicio o gasto
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="buscar-concepto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, código, grupo o categoría…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setTipo('')} className={chip(!tipo)}>
            Todos ({conceptos.filter((c) => c.activo !== false).length})
          </button>
          {TIPOS_CONCEPTO.map((t) => (
            <button key={t.id} onClick={() => setTipo(tipo === t.id ? '' : t.id)} className={chip(tipo === t.id)}>
              {t.id === 'gasto' ? 'Gastos' : t.label + 's'} ({cuenta(t.id)})
            </button>
          ))}
        </div>
        <select value={uso} onChange={(e) => setUso(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold">
          <option value="">Sirve para: todo</option>
          {USOS_CONCEPTO.map((u) => (
            <option key={u.id} value={u.id}>
              Sirve para {u.label.toLowerCase()}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver inactivos
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left p-3">Concepto</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Sirve para</th>
              <th className="text-left p-3">Categoría venta</th>
              <th className="text-left p-3">Categoría compra / gasto</th>
              <th className="text-right p-3">Precio venta</th>
              <th className="text-right p-3">Último costo</th>
              <th className="text-right p-3">IVA</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtrados.map((c) => {
              const t = tipoDe(c);
              const Icono = ICONO_TIPO[t];
              return (
                <tr key={c.id} className={c.activo === false ? 'opacity-50' : ''}>
                  <td className="p-3 min-w-[200px]">
                    <p className="font-bold text-slate-900 dark:text-white">{c.nombre}</p>
                    <p className="text-[10px] text-slate-500">
                      {[c.codigo, c.grupo, c.unidad, c.activo === false ? 'Inactivo' : ''].filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${COLOR_TIPO[t]}`}>
                      <Icono className="w-3 h-3" /> {TIPOS_CONCEPTO.find((x) => x.id === t)?.label}
                    </span>
                    {controlaInventario(c) && <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Boxes className="w-3 h-3" /> Inventario</p>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {usosDe(c).map((u) => (
                        <span key={u} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {USOS_CONCEPTO.find((x) => x.id === u)?.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{usosDe(c).includes('venta') ? nombreCategoriaVenta(c.categoriaVenta) || '—' : '—'}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{categorias.find((x) => x.id === c.categoriaCompraId)?.nombre || '—'}</td>
                  <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{c.precioVenta ? formatCOP(c.precioVenta) : '—'}</td>
                  <td className="p-3 text-right text-slate-600 dark:text-slate-300">{c.costoUltimo ? formatCOP(c.costoUltimo) : '—'}</td>
                  <td className="p-3 text-right text-slate-600 dark:text-slate-300">{c.ivaPct !== undefined && c.ivaPct !== null ? `${c.ivaPct} %` : '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditando(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Editar" aria-label={`Editar ${c.nombre}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setAEliminar(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600" title="Eliminar" aria-label={`Eliminar ${c.nombre}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!cargando && !filtrados.length && (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <p>{conceptos.length ? 'Ningún concepto coincide con la búsqueda o el filtro.' : 'El catálogo está vacío.'}</p>
            {!conceptos.length && (
              <p>
                Cree sus productos, servicios y conceptos de gasto con <strong>Nuevo</strong>
                {vendidos.length ? ', o traiga lo que ya ha vendido con “Traer de las ventas”' : ''}. Las compras con detalle de productos también los crean solos.
              </p>
            )}
          </div>
        )}
      </div>

      {editando !== undefined && (
        <ModalConcepto
          concepto={editando}
          todos={conceptos}
          categorias={categorias}
          centrosCosto={centrosCosto}
          onCerrar={() => setEditando(undefined)}
          onGuardado={async () => {
            setEditando(undefined);
            await despuesDeGuardar();
          }}
        />
      )}

      {traer && (
        <ModalTraerVentas
          vendidos={vendidos}
          onCerrar={() => setTraer(false)}
          onGuardado={async (n) => {
            setTraer(false);
            mostrarToast('success', 'Catálogo actualizado', `Se crearon ${n} concepto(s) a partir de las ventas.`);
            await despuesDeGuardar();
          }}
        />
      )}

      <ModalConfirmacion
        abierto={!!aEliminar}
        titulo="¿Eliminar del catálogo?"
        mensaje={
          aEliminar
            ? `Se eliminará "${aEliminar.nombre}". Las ventas, compras y gastos ya registrados conservan su información.` +
              (movsPorConcepto.get(aEliminar.id)
                ? ` También se borran sus ${movsPorConcepto.get(aEliminar.id)} movimiento(s) de inventario. Si solo quiere dejar de usarlo, edítelo y desmarque “Activo”.`
                : '')
            : ''
        }
        enConfirmar={confirmarEliminar}
        enCancelar={() => setAEliminar(null)}
      />
    </div>
  );
};

// ------------------------------------------------------------------ crear / editar

const ModalConcepto: React.FC<{
  concepto: Producto | null;
  todos: Producto[];
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  onCerrar: () => void;
  onGuardado: () => void;
}> = ({ concepto, todos, categorias, centrosCosto, onCerrar, onGuardado }) => {
  const { mostrarToast } = useToast();
  const ahora = new Date().toISOString();
  const [c, setC] = useState<Producto>(() =>
    concepto
      ? { ...concepto, tipo: tipoDe(concepto), usos: usosDe(concepto), controlaInventario: controlaInventario(concepto) }
      : { id: nuevoId('prod'), nombre: '', unidad: 'UND', tipo: 'producto', usos: ['venta', 'compra'], controlaInventario: true, categoriaVenta: 'vitrina', ivaPct: 19, activo: true, creadoEn: ahora, actualizadoEn: ahora }
  );
  const [alias, setAlias] = useState((concepto?.alias || []).join(', '));
  const [guardando, setGuardando] = useState(false);
  const t = tipoDe(c);
  const usos = usosDe(c);
  const subcategorias = c.categoriaVenta ? SUBCATEGORIAS_POR_CATEGORIA[c.categoriaVenta] || [] : [];
  const categoriasCompra = categorias.filter((x) => x.activo !== false);

  const cambiarTipo = (nuevo: TipoConcepto) => {
    const sugerida = categoriasCompra.find((x) => (nuevo === 'gasto' ? x.esGasto : !x.esGasto));
    setC({
      ...c,
      tipo: nuevo,
      usos: usosPorDefecto(nuevo),
      controlaInventario: nuevo === 'producto',
      categoriaVenta: nuevo === 'gasto' ? undefined : c.categoriaVenta && (nuevo === 'servicio') === CATEGORIAS_SERVICIO.has(c.categoriaVenta) ? c.categoriaVenta : nuevo === 'servicio' ? 'consultas_clinica' : 'vitrina',
      subcategoriaVenta: undefined,
      categoriaCompraId: nuevo === 'gasto' || nuevo === 'producto' ? c.categoriaCompraId || sugerida?.id : c.categoriaCompraId,
      unidad: nuevo === 'servicio' && c.unidad === 'UND' ? 'SERVICIO' : nuevo !== 'servicio' && c.unidad === 'SERVICIO' ? 'UND' : c.unidad,
    });
  };
  const alternarUso = (u: UsoConcepto) => setC({ ...c, usos: usos.includes(u) ? usos.filter((x) => x !== u) : [...usos, u] });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = c.nombre.trim();
    if (!nombre) return mostrarToast('warning', 'Falta el nombre', 'Escriba el nombre del producto, servicio o gasto.');
    if (!usos.length) return mostrarToast('warning', 'Falta el uso', 'Marque si sirve para ventas, compras o gastos.');
    const dup = conceptoDuplicado(todos, { id: c.id, nombre, codigo: c.codigo });
    if (dup) return mostrarToast('warning', 'Ya existe', `"${dup.nombre}" ya está en el catálogo con ese nombre o código.`);
    setGuardando(true);
    try {
      await dataService.guardarProducto({
        ...c,
        nombre,
        codigo: c.codigo?.trim() || undefined,
        grupo: c.grupo?.trim() || undefined,
        unidad: c.unidad?.trim() || 'UND',
        alias: alias.split(',').map((a) => a.trim()).filter(Boolean),
        categoriaVenta: usos.includes('venta') ? c.categoriaVenta : undefined,
        subcategoriaVenta: usos.includes('venta') ? c.subcategoriaVenta : undefined,
        controlaInventario: t === 'producto' ? c.controlaInventario !== false : false,
      });
      mostrarToast('success', concepto ? 'Concepto actualizado' : 'Concepto creado', `${nombre} quedó en el catálogo.`);
      onGuardado();
    } catch (err: any) {
      mostrarToast('error', 'No se pudo guardar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <form onSubmit={guardar} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{concepto ? `Editar: ${concepto.nombre}` : 'Nuevo producto, servicio o gasto'}</h3>
          <button type="button" onClick={onCerrar} className="p-1 rounded-lg text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TIPOS_CONCEPTO.map((x) => {
              const Icono = ICONO_TIPO[x.id];
              const activo = t === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => cambiarTipo(x.id)}
                  className={`text-left p-3 rounded-2xl border-2 ${activo ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}
                >
                  <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <Icono className="w-4 h-4 text-emerald-600" /> {x.label}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-1">{x.ayuda}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={etiqueta} htmlFor="concepto-nombre">Nombre *</label>
              <input id="concepto-nombre" autoFocus value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} className={input + ' font-bold'} placeholder={t === 'gasto' ? 'Ej.: Arriendo local' : t === 'servicio' ? 'Ej.: Consulta general' : 'Ej.: Nexgard 10-25 kg'} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="concepto-codigo">Código</label>
              <input id="concepto-codigo" value={c.codigo || ''} onChange={(e) => setC({ ...c, codigo: e.target.value })} className={input + ' font-mono'} placeholder="Opcional" />
            </div>
          </div>

          <div>
            <span className={etiqueta}>Sirve para *</span>
            <div className="flex flex-wrap gap-3">
              {USOS_CONCEPTO.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input type="checkbox" id={`concepto-uso-${u.id}`} checked={usos.includes(u.id)} onChange={() => alternarUso(u.id)} />
                  <span className="font-semibold">{u.label}</span>
                </label>
              ))}
            </div>
          </div>

          {usos.includes('venta') && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={etiqueta} htmlFor="concepto-cat-venta">Categoría de venta</label>
                <select id="concepto-cat-venta" value={c.categoriaVenta || ''} onChange={(e) => setC({ ...c, categoriaVenta: e.target.value || undefined, subcategoriaVenta: undefined })} className={input}>
                  <option value="">Sin categoría (Varios)</option>
                  {CATEGORIAS_VENTA.map((x) => (
                    <option key={x.id} value={x.id}>{x.label}</option>
                  ))}
                  {c.categoriaVenta && !CATEGORIAS_VENTA.some((x) => x.id === c.categoriaVenta) && <option value={c.categoriaVenta}>{nombreCategoriaVenta(c.categoriaVenta)} (eliminada)</option>}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="concepto-subcat">Subcategoría</label>
                <select id="concepto-subcat" value={c.subcategoriaVenta || ''} onChange={(e) => setC({ ...c, subcategoriaVenta: e.target.value || undefined })} className={input} disabled={!subcategorias.length}>
                  <option value="">{subcategorias.length ? 'Ninguna' : 'Esta categoría no tiene'}</option>
                  {subcategorias.map((s) => (
                    <option key={s.value} value={s.value}>{s.nombreCorto}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="concepto-precio">Precio de venta (con IVA)</label>
                <input id="concepto-precio" inputMode="numeric" value={pesos(c.precioVenta)} onChange={(e) => setC({ ...c, precioVenta: leerPesos(e.target.value) || undefined })} className={input + ' font-bold'} placeholder="$ 0" />
              </div>
            </div>
          )}

          {(usos.includes('compra') || usos.includes('gasto')) && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={etiqueta} htmlFor="concepto-cat-compra">Categoría de compra / gasto</label>
                <select id="concepto-cat-compra" value={c.categoriaCompraId || ''} onChange={(e) => setC({ ...c, categoriaCompraId: e.target.value || undefined })} className={input}>
                  <option value="">La que elija al registrar</option>
                  {categoriasCompra.map((x) => (
                    <option key={x.id} value={x.id}>{x.nombre} {x.esGasto ? '(gasto)' : '(compra)'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="concepto-centro">Centro de costo</label>
                <select id="concepto-centro" value={c.centroCostoId || ''} onChange={(e) => setC({ ...c, centroCostoId: e.target.value || undefined })} className={input}>
                  <option value="">El que elija al registrar</option>
                  {centrosCosto.filter((x) => x.activo !== false).map((x) => (
                    <option key={x.id} value={x.id}>{x.codigo} - {x.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="concepto-costo">Último costo (sin IVA)</label>
                <input id="concepto-costo" inputMode="numeric" value={pesos(c.costoUltimo)} onChange={(e) => setC({ ...c, costoUltimo: leerPesos(e.target.value) || undefined })} className={input} placeholder="$ 0" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={etiqueta} htmlFor="concepto-iva">Tarifa IVA</label>
              <select id="concepto-iva" value={c.ivaPct ?? ''} onChange={(e) => setC({ ...c, ivaPct: e.target.value === '' ? undefined : Number(e.target.value) })} className={input}>
                <option value="">Sin definir</option>
                <option value={0}>0 % (excluido / exento)</option>
                <option value={5}>5 %</option>
                <option value={19}>19 %</option>
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="concepto-unidad">Unidad</label>
              <input id="concepto-unidad" value={c.unidad} onChange={(e) => setC({ ...c, unidad: e.target.value })} className={input} placeholder="UND, KG, SERVICIO…" />
            </div>
            <div>
              <label className={etiqueta} htmlFor="concepto-grupo">Grupo</label>
              <input id="concepto-grupo" value={c.grupo || ''} onChange={(e) => setC({ ...c, grupo: e.target.value })} className={input} placeholder="Medicamentos, Alimentos…" />
            </div>
            {t === 'producto' && (
              <div>
                <label className={etiqueta} htmlFor="concepto-minimo">Stock mínimo</label>
                <input id="concepto-minimo" type="number" min="0" value={c.stockMinimo ?? ''} onChange={(e) => setC({ ...c, stockMinimo: e.target.value === '' ? undefined : Number(e.target.value) })} className={input} />
              </div>
            )}
          </div>

          <div>
            <label className={etiqueta} htmlFor="concepto-alias">Otros nombres (separados por coma)</label>
            <input id="concepto-alias" value={alias} onChange={(e) => setAlias(e.target.value)} className={input} placeholder="Como llega en las facturas del proveedor o como lo piden los clientes" />
          </div>

          <div className="flex flex-wrap gap-4">
            {t === 'producto' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={c.controlaInventario !== false} onChange={(e) => setC({ ...c, controlaInventario: e.target.checked })} />
                <span className="font-semibold">Llevar existencias en Inventario</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="concepto-activo" checked={c.activo !== false} onChange={(e) => setC({ ...c, activo: e.target.checked })} />
              <span className="font-semibold">Activo (se ofrece al vender, comprar y registrar gastos)</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
            Cancelar
          </button>
          <button id="guardar-concepto" type="submit" disabled={guardando} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar en el catálogo'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------------ traer de las ventas

const ModalTraerVentas: React.FC<{ vendidos: ConceptoVendido[]; onCerrar: () => void; onGuardado: (n: number) => void }> = ({ vendidos, onCerrar, onGuardado }) => {
  const { mostrarToast } = useToast();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(vendidos.map((v) => v.nombre)));
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    const lista = vendidos.filter((v) => marcados.has(v.nombre));
    if (!lista.length) return;
    setGuardando(true);
    try {
      const ahora = new Date().toISOString();
      for (const v of lista) {
        await dataService.guardarProducto({
          id: nuevoId('prod'),
          nombre: v.nombre,
          tipo: v.tipo,
          usos: usosPorDefecto(v.tipo),
          categoriaVenta: v.categoria,
          subcategoriaVenta: v.subcategoria,
          precioVenta: v.precio || undefined,
          unidad: v.tipo === 'servicio' ? 'SERVICIO' : 'UND',
          activo: true,
          creadoEn: ahora,
          actualizadoEn: ahora,
        });
      }
      onGuardado(lista.length);
    } catch (err: any) {
      mostrarToast('error', 'No se pudo crear', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Traer al catálogo lo vendido</h3>
            <p className="text-[11px] text-slate-500">Conceptos escritos a mano en ventas que aún no están en el catálogo. Se crean con su categoría y último precio; después puede editarlos.</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1 rounded-lg text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Marcar todos"
                    checked={marcados.size === vendidos.length}
                    onChange={(e) => setMarcados(e.target.checked ? new Set(vendidos.map((v) => v.nombre)) : new Set())}
                  />
                </th>
                <th className="p-3 text-left">Concepto</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">Categoría</th>
                <th className="p-3 text-right">Último precio</th>
                <th className="p-3 text-right">Veces</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vendidos.map((v) => (
                <tr key={v.nombre}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={marcados.has(v.nombre)}
                      onChange={(e) => {
                        const s = new Set(marcados);
                        if (e.target.checked) s.add(v.nombre);
                        else s.delete(v.nombre);
                        setMarcados(s);
                      }}
                    />
                  </td>
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">{v.nombre}</td>
                  <td className="p-3">{v.tipo === 'servicio' ? 'Servicio' : 'Producto'}</td>
                  <td className="p-3">{nombreCategoriaVenta(v.categoria)}</td>
                  <td className="p-3 text-right">{v.precio ? formatCOP(v.precio) : '—'}</td>
                  <td className="p-3 text-right">{v.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
            Cancelar
          </button>
          <button id="crear-desde-ventas" type="button" onClick={crear} disabled={guardando || !marcados.size} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-60">
            {guardando ? 'Creando…' : `Crear ${marcados.size} en el catálogo`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
