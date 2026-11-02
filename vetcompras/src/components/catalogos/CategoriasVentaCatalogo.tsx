import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Package, Pencil, Plus, RotateCcw, Stethoscope, Trash2, X } from 'lucide-react';
import { CategoriaVentaConfig, Venta } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { categoriasVentaConfiguradas, idDesdeNombre } from '../../utils/formatters';
import { categoriaNormalizada, itemsDeVenta } from '../../utils/ventas';

interface Props {
  ventas: Venta[];
  onDatosActualizados: () => void;
}

const input = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';

/**
 * Categorías con que se clasifican las ventas (filtros del buscador, reportes y
 * recibos). Se pueden crear, renombrar, ordenar y eliminar; las ventas ya
 * registradas conservan su categoría y su nombre.
 */
export const CategoriasVentaCatalogo: React.FC<Props> = ({ ventas, onDatosActualizados }) => {
  const { mostrarToast } = useToast();
  const [config, setConfig] = useState<CategoriaVentaConfig[]>(() => categoriasVentaConfiguradas());
  const [editando, setEditando] = useState<CategoriaVentaConfig | null | undefined>(undefined);
  const [aEliminar, setAEliminar] = useState<CategoriaVentaConfig | null>(null);
  const [restaurar, setRestaurar] = useState(false);

  const usos = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of ventas) for (const i of itemsDeVenta(v)) m.set(categoriaNormalizada(i.categoria), (m.get(categoriaNormalizada(i.categoria)) || 0) + 1);
    return m;
  }, [ventas]);

  const activas = config.filter((c) => c.activo !== false);
  const eliminadas = config.filter((c) => c.activo === false);

  const guardar = async (nueva: CategoriaVentaConfig[] | null, mensaje: string) => {
    try {
      await dataService.guardarCategoriasVenta(nueva);
      setConfig(categoriasVentaConfiguradas());
      mostrarToast('success', 'Categorías de venta', mensaje);
      onDatosActualizados();
    } catch (err: any) {
      mostrarToast('error', 'No se pudo guardar', err?.message);
    }
  };

  const mover = (id: string, paso: -1 | 1) => {
    const lista = [...activas];
    const i = lista.findIndex((c) => c.id === id);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    guardar([...lista, ...eliminadas], 'Orden actualizado.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500 max-w-2xl">
          Clasifican las ventas en el buscador, los reportes y los recibos. Al eliminar una categoría deja de ofrecerse al vender, pero las ventas que ya la usan
          conservan su nombre.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setRestaurar(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
            <RotateCcw className="w-4 h-4" /> Restaurar las de fábrica
          </button>
          <button
            id="btn-nueva-categoria-venta"
            onClick={() => setEditando(null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" /> Nueva categoría de venta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activas.map((c, i) => (
          <div key={c.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  {c.tipo === 'servicio' ? <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" /> : <Package className="w-4 h-4 text-emerald-600 shrink-0" />}
                  <span className="truncate">{c.label}</span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  {c.tipo === 'servicio' ? 'Servicios' : 'Productos'} · {(usos.get(c.id) || 0).toLocaleString('es-CO')} ítem(s) vendidos
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => mover(c.id, -1)} disabled={i === 0} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Subir" aria-label={`Subir ${c.label}`}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => mover(c.id, 1)} disabled={i === activas.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Bajar" aria-label={`Bajar ${c.label}`}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditando(c)} className="p-1 rounded text-slate-400 hover:text-slate-700" title="Editar" aria-label={`Editar ${c.label}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setAEliminar(c)} className="p-1 rounded text-slate-400 hover:text-rose-600" title="Eliminar" aria-label={`Eliminar ${c.label}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {!!c.subcategorias?.length && (
              <div className="flex flex-wrap gap-1">
                {c.subcategorias.map((s) => (
                  <span key={s.value} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {eliminadas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Eliminadas (solo se ven en ventas antiguas)</p>
          <div className="flex flex-wrap gap-2">
            {eliminadas.map((c) => (
              <button
                key={c.id}
                onClick={() => guardar(config.map((x) => (x.id === c.id ? { ...x, activo: true } : x)), `${c.label} vuelve a estar disponible.`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 hover:text-emerald-700"
                title="Volver a usar esta categoría"
              >
                <RotateCcw className="w-3 h-3" /> {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {editando !== undefined && (
        <ModalCategoriaVenta
          categoria={editando}
          existentes={config}
          onCerrar={() => setEditando(undefined)}
          onGuardar={(cat) => {
            const existe = config.some((x) => x.id === cat.id);
            setEditando(undefined);
            guardar(existe ? config.map((x) => (x.id === cat.id ? cat : x)) : [...activas, cat, ...eliminadas], `${cat.label} guardada.`);
          }}
        />
      )}

      <ModalConfirmacion
        abierto={!!aEliminar}
        titulo="¿Eliminar la categoría de venta?"
        mensaje={
          aEliminar
            ? `"${aEliminar.label}" dejará de ofrecerse al vender.` +
              (usos.get(aEliminar.id) ? ` Las ${usos.get(aEliminar.id)} venta(s) que ya la usan conservan su categoría y su nombre.` : '') +
              ' Puede volver a activarla cuando quiera.'
            : ''
        }
        enConfirmar={() => {
          const c = aEliminar!;
          setAEliminar(null);
          guardar(config.map((x) => (x.id === c.id ? { ...x, activo: false } : x)), `${c.label} eliminada.`);
        }}
        enCancelar={() => setAEliminar(null)}
      />
      <ModalConfirmacion
        abierto={restaurar}
        tipo="advertencia"
        titulo="¿Restaurar las categorías de fábrica?"
        mensaje="Se pierden los nombres, subcategorías y categorías nuevas que haya creado aquí. Las ventas ya registradas no cambian."
        textoConfirmar="Restaurar"
        enConfirmar={() => {
          setRestaurar(false);
          guardar(null, 'Se restauraron las categorías de fábrica.');
        }}
        enCancelar={() => setRestaurar(false)}
      />
    </div>
  );
};

const ModalCategoriaVenta: React.FC<{
  categoria: CategoriaVentaConfig | null;
  existentes: CategoriaVentaConfig[];
  onCerrar: () => void;
  onGuardar: (c: CategoriaVentaConfig) => void;
}> = ({ categoria, existentes, onCerrar, onGuardar }) => {
  const { mostrarToast } = useToast();
  const [label, setLabel] = useState(categoria?.label || '');
  const [tipo, setTipo] = useState<'producto' | 'servicio'>(categoria?.tipo || 'servicio');
  const [subs, setSubs] = useState<{ value: string; label: string }[]>(categoria?.subcategorias?.length ? categoria.subcategorias : []);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = label.trim();
    if (!nombre) return mostrarToast('warning', 'Falta el nombre', 'Escriba el nombre de la categoría.');
    if (existentes.some((x) => x.id !== categoria?.id && x.activo !== false && x.label.trim().toLowerCase() === nombre.toLowerCase())) {
      return mostrarToast('warning', 'Ya existe', `Ya hay una categoría llamada "${nombre}".`);
    }
    const id = categoria?.id || idDesdeNombre(nombre, existentes.map((x) => x.id));
    const usados: string[] = [];
    const subcategorias = subs
      .filter((s) => s.label.trim())
      .map((s) => {
        const value = s.value || idDesdeNombre(s.label, [...subs.map((x) => x.value).filter(Boolean), ...usados]);
        usados.push(value);
        return { value, label: s.label.trim() };
      });
    onGuardar({ id, label: nombre, tipo, activo: true, subcategorias });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <form onSubmit={enviar} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{categoria ? 'Editar categoría de venta' : 'Nueva categoría de venta'}</h3>
          <button type="button" onClick={onCerrar} className="p-1 rounded-lg text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          <div>
            <label className="block text-[11px] font-semibold mb-1" htmlFor="catventa-nombre">Nombre *</label>
            <input id="catventa-nombre" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={input + ' font-bold'} placeholder="Ej.: Hospitalización" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold mb-1">Qué se vende en ella</span>
            <div className="flex gap-2">
              {(['servicio', 'producto'] as const).map((t) => (
                <label key={t} className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer ${tipo === t ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="radio" name="tipo-catventa" checked={tipo === t} onChange={() => setTipo(t)} />
                  <span className="font-semibold">{t === 'servicio' ? 'Servicios' : 'Productos'}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold">Subcategorías (opcional)</span>
              <button type="button" onClick={() => setSubs([...subs, { value: '', label: '' }])} className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            {!subs.length && <p className="text-slate-500">Sin subcategorías. Sirven para detallar los reportes (por ejemplo, tipos de consulta o de vacuna).</p>}
            {subs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={s.label}
                  onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className={input}
                  placeholder={`Subcategoría ${i + 1}`}
                  aria-label={`Subcategoría ${i + 1}`}
                />
                <button type="button" onClick={() => setSubs(subs.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600" aria-label={`Quitar subcategoría ${i + 1}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
            Cancelar
          </button>
          <button id="guardar-categoria-venta" type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
            Guardar categoría
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
