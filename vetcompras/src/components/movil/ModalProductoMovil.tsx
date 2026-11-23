import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { Producto } from '../../types';
import { dataService } from '../../services/dataService';
import { CATEGORIAS_SERVICIO, CATEGORIAS_VENTA, categoriaVentaPorDefecto } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { colorDe, comprimirFoto, iniciales } from './fotos';

const nuevoId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface SemillaProducto {
  nombre?: string;
  precio?: number;
  categoria?: string;
}

/**
 * Crear o editar un producto o servicio de venta desde el celular, con su foto
 * (cámara o galería), precio y categoría. Se guarda en el mismo catálogo del PC.
 */
export const ModalProductoMovil: React.FC<{
  producto?: Producto;
  semilla?: SemillaProducto;
  onGuardado: (p: Producto) => void;
  onCerrar: () => void;
}> = ({ producto, semilla, onGuardado, onCerrar }) => {
  const { mostrarToast } = useToast();
  const [foto, setFoto] = useState(producto?.foto || '');
  const [nombre, setNombre] = useState(producto?.nombre || semilla?.nombre || '');
  const [precio, setPrecio] = useState(String(producto?.precioVenta || semilla?.precio || ''));
  const [categoria, setCategoria] = useState(producto?.categoriaVenta || semilla?.categoria || categoriaVentaPorDefecto('producto'));
  const [codigo, setCodigo] = useState(producto?.codigo || '');
  const [procesando, setProcesando] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const esServicio = CATEGORIAS_SERVICIO.has(categoria);

  const alElegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setProcesando(true);
    try {
      setFoto(await comprimirFoto(archivo));
    } catch (err: any) {
      mostrarToast('error', 'Foto', err?.message);
    } finally {
      setProcesando(false);
    }
  };

  const guardar = async (activo = true) => {
    const limpio = nombre.trim();
    if (!limpio) return mostrarToast('warning', 'Falta el nombre', 'Escriba el nombre del producto o servicio.');
    const valor = Math.round(Number(String(precio).replace(/[^\d]/g, '')) || 0);
    const ahora = new Date().toISOString();
    const tipo = esServicio ? 'servicio' : 'producto';
    const p: Producto = {
      ...(producto || {
        id: nuevoId('prod'),
        tipo,
        usos: tipo === 'servicio' ? ['venta'] : ['venta', 'compra'],
        unidad: tipo === 'servicio' ? 'SERVICIO' : 'UND',
        creadoEn: ahora,
      }),
      nombre: limpio,
      codigo: codigo.trim() || undefined,
      categoriaVenta: categoria,
      precioVenta: valor || undefined,
      foto: foto || undefined,
      activo,
      actualizadoEn: ahora,
    } as Producto;
    setProcesando(true);
    try {
      await dataService.guardarProducto(p);
      mostrarToast('success', activo ? 'Producto guardado' : 'Producto retirado de la caja', limpio);
      onGuardado(p);
    } catch (err: any) {
      mostrarToast('error', 'No se guardó', err?.message);
    } finally {
      setProcesando(false);
    }
  };

  const claseCampo =
    'w-full px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-md max-h-[92%] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4" style={{ paddingBottom: 'calc(1.25rem + var(--sa-bottom, 0px))' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{producto ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button onClick={onCerrar} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Foto */}
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-white text-3xl font-black" style={{ background: foto ? undefined : colorDe(nombre || '?') }}>
            {procesando ? <Loader2 className="w-7 h-7 animate-spin" /> : foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : iniciales(nombre || '?')}
          </div>
          <div className="flex-1 grid gap-2">
            <button id="foto-camara" onClick={() => camara.current?.click()} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold">
              <Camera className="w-4 h-4" /> Tomar foto
            </button>
            <button id="foto-galeria" onClick={() => galeria.current?.click()} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold">
              <ImagePlus className="w-4 h-4" /> De la galería
            </button>
            {foto && (
              <button onClick={() => setFoto('')} className="text-xs text-rose-600 font-semibold">
                Quitar foto
              </button>
            )}
          </div>
          <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={alElegirFoto} />
          <input ref={galeria} id="foto-archivo" type="file" accept="image/*" className="hidden" onChange={alElegirFoto} />
        </div>

        <div className="space-y-1">
          <label htmlFor="prod-nombre" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nombre</label>
          <input id="prod-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Hamburguesa sencilla" className={claseCampo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="prod-precio" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Precio de venta</label>
            <input id="prod-precio" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$ 0" className={claseCampo + ' text-right font-bold'} />
          </div>
          <div className="space-y-1">
            <label htmlFor="prod-codigo" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Código (opcional)</label>
            <input id="prod-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={claseCampo} />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="prod-categoria" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Categoría (pestaña de la caja)</label>
          <select id="prod-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={claseCampo}>
            {CATEGORIAS_VENTA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">{esServicio ? 'Es un servicio: no mueve inventario.' : 'Es un producto: las ventas lo descuentan del inventario.'}</p>
        </div>

        <div className="flex gap-2 pt-1">
          {producto && (
            <button onClick={() => guardar(false)} disabled={procesando} className="p-3 rounded-xl border border-rose-300 text-rose-700" title="Quitar de la caja">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button id="prod-guardar" onClick={() => guardar(true)} disabled={procesando} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-60">
            Guardar producto
          </button>
        </div>
      </div>
    </div>
  );
};
