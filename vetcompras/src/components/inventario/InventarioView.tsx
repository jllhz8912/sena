import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  Download,
  FilePenLine,
  FileSpreadsheet,
  History,
  Loader2,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { guardarExcel } from '../../services/descargaExcel';
import { MovimientoInventario, Producto, TipoMovimiento } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { ModalConfirmacion } from '../common/ModalConfirmacion';
import { formatCOP, formatFecha, fechaLocal } from '../../utils/formatters';
import { MOTIVOS_BAJA, SaldoProducto, ajusteASaldo, buscarProducto, calcularSaldos, efecto } from '../../utils/inventario';

const claseInput =
  'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500';
const claseEtiqueta = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800';
const boton = 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors';

const ETIQUETA_TIPO: Record<TipoMovimiento, { texto: string; clase: string }> = {
  entrada: { texto: 'Entrada', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  salida: { texto: 'Salida', clase: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  baja: { texto: 'Baja', clase: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  ajuste: { texto: 'Ajuste', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
};
const ORIGEN: Record<string, string> = { compra: 'Compra', venta: 'Venta', manual: 'Manual', importacion: 'Excel', inicial: 'Inventario inicial' };
const unidades = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('es-CO');
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ------------------------------------------------------------------ modales

const Modal: React.FC<{ titulo: string; onCerrar: () => void; children: React.ReactNode; ancho?: string }> = ({ titulo, onCerrar, children, ancho = 'max-w-lg' }) => (
  <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className={`bg-white dark:bg-slate-900 rounded-2xl w-full ${ancho} max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white">{titulo}</h3>
        <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600" title="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const ModalProducto: React.FC<{ producto?: Producto; onCerrar: () => void; onGuardado: () => void }> = ({ producto, onCerrar, onGuardado }) => {
  const { mostrarToast } = useToast();
  const [p, setP] = useState<Producto>(
    producto || { id: nuevoId('prod'), nombre: '', unidad: 'UND', activo: true, creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString() }
  );
  const [alias, setAlias] = useState((producto?.alias || []).join(', '));
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p.nombre.trim()) return mostrarToast('warning', 'Falta el nombre', 'Escriba el nombre del producto.');
    await dataService.guardarProducto({ ...p, nombre: p.nombre.trim(), alias: alias.split(',').map((a) => a.trim()).filter(Boolean) });
    mostrarToast('success', 'Producto guardado', p.nombre);
    onGuardado();
    onCerrar();
  };
  const num = (v: string) => (v === '' ? undefined : Number(v.replace(/\D/g, '')) || 0);
  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className={claseEtiqueta}>Nombre *</span>
          <input autoFocus value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} className={claseInput} placeholder="Ej. Nexgard 10-25 kg" />
        </label>
        <label>
          <span className={claseEtiqueta}>Código (opcional)</span>
          <input value={p.codigo || ''} onChange={(e) => setP({ ...p, codigo: e.target.value })} className={claseInput} placeholder="Código de barras o del proveedor" />
        </label>
        <label>
          <span className={claseEtiqueta}>Grupo</span>
          <input value={p.grupo || ''} onChange={(e) => setP({ ...p, grupo: e.target.value })} className={claseInput} list="grupos-inventario" placeholder="Medicamentos, Alimentos…" />
        </label>
        <label>
          <span className={claseEtiqueta}>Unidad</span>
          <input value={p.unidad} onChange={(e) => setP({ ...p, unidad: e.target.value.toUpperCase() })} className={claseInput} placeholder="UND, KG, BULTO…" />
        </label>
        <label>
          <span className={claseEtiqueta}>Precio de venta</span>
          <input inputMode="numeric" value={p.precioVenta ? p.precioVenta.toLocaleString('es-CO') : ''} onChange={(e) => setP({ ...p, precioVenta: num(e.target.value) })} className={claseInput} />
        </label>
        <label>
          <span className={claseEtiqueta}>Último costo</span>
          <input inputMode="numeric" value={p.costoUltimo ? p.costoUltimo.toLocaleString('es-CO') : ''} onChange={(e) => setP({ ...p, costoUltimo: num(e.target.value) })} className={claseInput} />
        </label>
        <label>
          <span className={claseEtiqueta}>Stock mínimo (aviso)</span>
          <input inputMode="numeric" value={p.stockMinimo ?? ''} onChange={(e) => setP({ ...p, stockMinimo: num(e.target.value) })} className={claseInput} />
        </label>
        <label className="col-span-2">
          <span className={claseEtiqueta}>Otros nombres (separados por coma)</span>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} className={claseInput} placeholder="Como aparece en facturas del proveedor o como se vende" />
          <span className="text-[11px] text-slate-500">Sirven para reconocer el producto en compras y ventas aunque el nombre cambie.</span>
        </label>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={`${boton} border-slate-300 dark:border-slate-700`}>
            Cancelar
          </button>
          <button className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>Guardar producto</button>
        </div>
      </form>
    </Modal>
  );
};

const ModalMovimiento: React.FC<{
  productos: Producto[];
  inicial: Partial<MovimientoInventario>;
  onCerrar: () => void;
  onGuardado: () => void;
  onNuevoProducto: () => void;
}> = ({ productos, inicial, onCerrar, onGuardado, onNuevoProducto }) => {
  const { mostrarToast } = useToast();
  const editando = !!inicial.id;
  const [m, setM] = useState<Partial<MovimientoInventario>>({ fecha: fechaLocal(), tipo: 'entrada', origen: 'manual', cantidad: 1, ...inicial });
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m.productoId) return mostrarToast('warning', 'Elija el producto', 'Seleccione el producto del movimiento.');
    if (!m.cantidad) return mostrarToast('warning', 'Cantidad', 'Escriba la cantidad.');
    const ahora = new Date().toISOString();
    await dataService.guardarMovimiento({
      id: m.id || nuevoId('mov-m'),
      fecha: m.fecha || fechaLocal(),
      productoId: m.productoId,
      tipo: m.tipo as TipoMovimiento,
      cantidad: m.tipo === 'ajuste' ? Number(m.cantidad) : Math.abs(Number(m.cantidad)),
      costoUnitario: m.costoUnitario || undefined,
      origen: m.origen || 'manual',
      origenId: m.origenId,
      origenLineaId: m.origenLineaId,
      referencia: m.referencia,
      motivo: m.motivo,
      observaciones: m.observaciones,
      editado: m.editado,
      creadoEn: m.creadoEn || ahora,
      actualizadoEn: ahora,
    });
    mostrarToast('success', editando ? 'Movimiento actualizado' : 'Movimiento registrado', ETIQUETA_TIPO[m.tipo as TipoMovimiento].texto);
    onGuardado();
    onCerrar();
  };
  const titulo = editando ? 'Editar movimiento' : m.tipo === 'baja' ? 'Registrar baja (daño, pérdida, vencimiento)' : m.tipo === 'ajuste' ? 'Registrar ajuste' : m.tipo === 'salida' ? 'Registrar salida' : 'Registrar entrada';
  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      {m.origenId && (
        <p className="text-xs rounded-xl px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          Este movimiento salió de una {m.origen === 'venta' ? 'venta' : 'compra'} ({m.referencia}). Al guardarlo queda fijo: si después se edita esa {m.origen === 'venta' ? 'venta' : 'compra'}, este movimiento no se recalcula.
        </p>
      )}
      <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className={claseEtiqueta}>Producto *</span>
          <div className="flex gap-2">
            <select value={m.productoId || ''} onChange={(e) => setM({ ...m, productoId: e.target.value })} className={claseInput} autoFocus={!editando}>
              <option value="">— Seleccione —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.codigo ? ` (${p.codigo})` : ''}
                </option>
              ))}
            </select>
            <button type="button" onClick={onNuevoProducto} className={`${boton} border-emerald-600 text-emerald-700 dark:text-emerald-300 whitespace-nowrap`} title="Crear un producto nuevo">
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>
        </label>
        <label>
          <span className={claseEtiqueta}>Tipo</span>
          <select value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value as TipoMovimiento })} className={claseInput}>
            <option value="entrada">Entrada (compra, devolución de cliente)</option>
            <option value="salida">Salida (venta)</option>
            <option value="baja">Baja (daño, pérdida, vencimiento)</option>
            <option value="ajuste">Ajuste (+ suma / − resta)</option>
          </select>
        </label>
        <label>
          <span className={claseEtiqueta}>Fecha</span>
          <input type="date" value={m.fecha} onChange={(e) => setM({ ...m, fecha: e.target.value })} className={claseInput} />
        </label>
        <label>
          <span className={claseEtiqueta}>{m.tipo === 'ajuste' ? 'Cantidad (use − para restar)' : 'Cantidad'}</span>
          <input type="number" step="any" value={m.cantidad ?? ''} onChange={(e) => setM({ ...m, cantidad: e.target.value === '' ? undefined : Number(e.target.value) })} className={claseInput} />
        </label>
        {m.tipo === 'entrada' ? (
          <label>
            <span className={claseEtiqueta}>Costo unitario (sin IVA)</span>
            <input inputMode="numeric" value={m.costoUnitario ? m.costoUnitario.toLocaleString('es-CO') : ''} onChange={(e) => setM({ ...m, costoUnitario: Number(e.target.value.replace(/\D/g, '')) || undefined })} className={claseInput} />
          </label>
        ) : (
          <label>
            <span className={claseEtiqueta}>Motivo</span>
            {m.tipo === 'baja' ? (
              <select value={m.motivo || ''} onChange={(e) => setM({ ...m, motivo: e.target.value })} className={claseInput}>
                <option value="">— Seleccione —</option>
                {MOTIVOS_BAJA.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            ) : (
              <input value={m.motivo || ''} onChange={(e) => setM({ ...m, motivo: e.target.value })} className={claseInput} />
            )}
          </label>
        )}
        <label className="col-span-2">
          <span className={claseEtiqueta}>Referencia (factura, venta, lote…)</span>
          <input value={m.referencia || ''} onChange={(e) => setM({ ...m, referencia: e.target.value })} className={claseInput} />
        </label>
        <label className="col-span-2">
          <span className={claseEtiqueta}>Observaciones</span>
          <input value={m.observaciones || ''} onChange={(e) => setM({ ...m, observaciones: e.target.value })} className={claseInput} />
        </label>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={`${boton} border-slate-300 dark:border-slate-700`}>
            Cancelar
          </button>
          <button className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>Guardar</button>
        </div>
      </form>
    </Modal>
  );
};

const ModalAjuste: React.FC<{ saldo: SaldoProducto; onCerrar: () => void; onGuardado: () => void }> = ({ saldo, onCerrar, onGuardado }) => {
  const { mostrarToast } = useToast();
  const [contado, setContado] = useState(String(Math.max(0, saldo.saldo)));
  const [obs, setObs] = useState('');
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const mov = ajusteASaldo(saldo.producto.id, saldo.saldo, Number(contado) || 0, fechaLocal(), obs || undefined);
    if (!mov) return onCerrar();
    await dataService.guardarMovimiento(mov);
    mostrarToast('success', 'Saldo ajustado', `${saldo.producto.nombre}: ahora ${unidades(Number(contado) || 0)} ${saldo.producto.unidad}`);
    onGuardado();
    onCerrar();
  };
  const diferencia = (Number(contado) || 0) - saldo.saldo;
  return (
    <Modal titulo={`Ajustar saldo: ${saldo.producto.nombre}`} onCerrar={onCerrar} ancho="max-w-md">
      <form onSubmit={guardar} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Saldo según el sistema: <strong>{unidades(saldo.saldo)} {saldo.producto.unidad}</strong>. Escriba lo que contó físicamente; se registra un ajuste por la diferencia.
        </p>
        <label className="block">
          <span className={claseEtiqueta}>Unidades contadas</span>
          <input type="number" step="any" autoFocus value={contado} onChange={(e) => setContado(e.target.value)} className={claseInput} />
        </label>
        <label className="block">
          <span className={claseEtiqueta}>Observaciones</span>
          <input value={obs} onChange={(e) => setObs(e.target.value)} className={claseInput} placeholder="Ej. conteo de fin de mes" />
        </label>
        <p className="text-xs text-slate-500">Ajuste: <strong className={diferencia < 0 ? 'text-rose-600' : 'text-emerald-700'}>{diferencia > 0 ? '+' : ''}{unidades(diferencia)}</strong></p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={`${boton} border-slate-300 dark:border-slate-700`}>
            Cancelar
          </button>
          <button className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>Registrar ajuste</button>
        </div>
      </form>
    </Modal>
  );
};

// ------------------------------------------------------------- importar Excel

interface FilaImportada {
  codigo?: string;
  nombre: string;
  grupo?: string;
  unidad?: string;
  cantidad: number;
  costo?: number;
  precioVenta?: number;
  fecha?: string;
  tipo: TipoMovimiento;
  motivo?: string;
}

const ENCABEZADOS: Record<keyof FilaImportada, RegExp> = {
  codigo: /c[oó]digo|referencia|sku|barras/i,
  nombre: /producto|nombre|descripci[oó]n|art[ií]culo|detalle/i,
  grupo: /grupo|l[ií]nea|familia|categor/i,
  unidad: /unidad|u\.?\s?m/i,
  cantidad: /cantidad|cant\.?|unidades|existencia|saldo|stock/i,
  costo: /costo|valor\s+unit|precio\s+(?:de\s+)?compra|vr\.?\s*unit/i,
  precioVenta: /precio\s+(?:de\s+)?venta|pvp/i,
  fecha: /fecha/i,
  tipo: /tipo|movimiento/i,
  motivo: /motivo|observaci/i,
};

function leerHojaInventario(datos: ArrayBuffer): FilaImportada[] {
  const libro = XLSX.read(datos, { type: 'array', cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<any[]>(hoja, { header: 1, raw: true, defval: '' });
  const iEnc = filas.findIndex((f) => f.some((c) => ENCABEZADOS.nombre.test(String(c))) && f.some((c) => ENCABEZADOS.cantidad.test(String(c))));
  if (iEnc < 0) throw new Error('No se encontró la fila de títulos. Debe tener al menos las columnas "Producto" y "Cantidad" (use la plantilla).');
  const enc = filas[iEnc].map((c) => String(c));
  const col: Partial<Record<keyof FilaImportada, number>> = {};
  (Object.keys(ENCABEZADOS) as (keyof FilaImportada)[]).forEach((k) => {
    const i = enc.findIndex((t, idx) => ENCABEZADOS[k].test(t) && !Object.values(col).includes(idx));
    if (i >= 0) col[k] = i;
  });
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) || 0);
  const tipoDe = (v: unknown): TipoMovimiento => {
    const t = String(v || '').toLowerCase();
    return /sal|venta/.test(t) ? 'salida' : /baja|da[ñn]o|p[eé]rdida|venc/.test(t) ? 'baja' : /ajus/.test(t) ? 'ajuste' : 'entrada';
  };
  const fechaDe = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : /\d{4}-\d{2}-\d{2}/.exec(String(v))?.[0] || (/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v)) ? String(v).replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, (_, d, m, a) => `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`) : undefined));
  return filas
    .slice(iEnc + 1)
    .map((f) => ({
      codigo: col.codigo !== undefined ? String(f[col.codigo] || '').trim() || undefined : undefined,
      nombre: String(f[col.nombre!] || '').trim(),
      grupo: col.grupo !== undefined ? String(f[col.grupo] || '').trim() || undefined : undefined,
      unidad: col.unidad !== undefined ? String(f[col.unidad] || '').trim().toUpperCase() || undefined : undefined,
      cantidad: num(f[col.cantidad!]),
      costo: col.costo !== undefined ? num(f[col.costo]) || undefined : undefined,
      precioVenta: col.precioVenta !== undefined ? num(f[col.precioVenta]) || undefined : undefined,
      fecha: col.fecha !== undefined ? fechaDe(f[col.fecha]) : undefined,
      tipo: col.tipo !== undefined ? tipoDe(f[col.tipo]) : 'entrada',
      motivo: col.motivo !== undefined ? String(f[col.motivo] || '').trim() || undefined : undefined,
    }))
    .filter((f) => f.nombre && f.cantidad);
}

function descargarPlantilla() {
  const filas = [
    ['Código', 'Producto', 'Grupo', 'Unidad', 'Cantidad', 'Costo unitario', 'Precio venta', 'Fecha', 'Tipo', 'Motivo'],
    ['7702001', 'Nexgard 10-25 kg', 'Antiparasitarios', 'UND', 12, 38000, 52000, fechaLocal(), 'Entrada', 'Inventario inicial'],
    ['', 'Dog Chow adulto 22 kg', 'Alimentos', 'BULTO', 5, 165000, 198000, fechaLocal(), 'Entrada', ''],
    ['', 'Shampoo antipulgas 500 ml', 'Higiene', 'UND', 2, '', '', fechaLocal(), 'Baja', 'Vencimiento'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 10 }, { wch: 32 }, { wch: 16 }, { wch: 8 }, { wch: 9 }, { wch: 14 }, { wch: 13 }, { wch: 12 }, { wch: 9 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  guardarExcel(wb, 'VetCompras_Plantilla_Inventario.xlsx');
}

// ------------------------------------------------------------------- vista

interface InventarioViewProps {
  onCargarCompra: () => void;
  onRegistroManual: () => void;
}

export const InventarioView: React.FC<InventarioViewProps> = ({ onCargarCompra, onRegistroManual }) => {
  const { mostrarToast } = useToast();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState<'existencias' | 'movimientos'>('existencias');
  const [texto, setTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'negativo' | 'agotado' | 'bajo' | 'con_saldo'>('todos');
  const [filtroProducto, setFiltroProducto] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoMovimiento>('');
  const [modalProducto, setModalProducto] = useState<{ abierto: boolean; producto?: Producto }>({ abierto: false });
  const [modalMov, setModalMov] = useState<Partial<MovimientoInventario> | null>(null);
  const [ajuste, setAjuste] = useState<SaldoProducto | null>(null);
  const [aEliminar, setAEliminar] = useState<{ tipo: 'producto' | 'movimiento'; id: string; nombre: string } | null>(null);
  const [importacion, setImportacion] = useState<FilaImportada[] | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const [p, m] = await Promise.all([dataService.obtenerProductos(), dataService.obtenerMovimientos()]);
    setProductos(p);
    setMovimientos(m);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    return dataService.suscribirCambiosEnVivo(cargar);
  }, [cargar]);

  const saldos = useMemo(() => calcularSaldos(productos, movimientos), [productos, movimientos]);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const resumen = useMemo(
    () => ({
      productos: productos.filter((p) => p.activo !== false).length,
      unidades: saldos.reduce((a, s) => a + Math.max(0, s.saldo), 0),
      valor: saldos.reduce((a, s) => a + s.valor, 0),
      negativos: saldos.filter((s) => s.estado === 'negativo').length,
      agotados: saldos.filter((s) => s.estado === 'agotado').length,
      bajos: saldos.filter((s) => s.estado === 'bajo').length,
    }),
    [productos, saldos]
  );

  const q = texto.trim().toLowerCase();
  const saldosFiltrados = saldos
    .filter((s) => !q || `${s.producto.nombre} ${s.producto.codigo || ''} ${s.producto.grupo || ''} ${(s.producto.alias || []).join(' ')}`.toLowerCase().includes(q))
    .filter((s) => filtroEstado === 'todos' || (filtroEstado === 'con_saldo' ? s.saldo > 0 : s.estado === filtroEstado));
  const movimientosFiltrados = movimientos
    .filter((m) => !filtroProducto || m.productoId === filtroProducto)
    .filter((m) => !filtroTipo || m.tipo === filtroTipo)
    .filter((m) => !q || `${porId.get(m.productoId)?.nombre || ''} ${m.referencia || ''} ${m.motivo || ''} ${m.observaciones || ''}`.toLowerCase().includes(q));

  const verKardex = (productoId: string) => {
    setFiltroProducto(productoId);
    setTexto('');
    setPestana('movimientos');
  };

  const recalcular = async () => {
    setTrabajando(true);
    try {
      const r = await dataService.recalcularInventario();
      mostrarToast('success', 'Inventario recalculado', `Se revisaron ${r.compras} compras y ${r.ventas} ventas. Lo editado a mano se conservó.`);
      await cargar();
    } catch (e: any) {
      mostrarToast('error', 'No se pudo recalcular', e?.message);
    } finally {
      setTrabajando(false);
    }
  };

  const elegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const filas = leerHojaInventario(await archivo.arrayBuffer());
      if (!filas.length) throw new Error('El archivo no tiene filas con producto y cantidad.');
      setImportacion(filas);
    } catch (err: any) {
      mostrarToast('error', 'No se pudo leer el Excel', err?.message);
    }
  };

  const confirmarImportacion = async () => {
    if (!importacion) return;
    setTrabajando(true);
    try {
      const catalogo = [...productos];
      const nuevos: Producto[] = [];
      const movs: MovimientoInventario[] = [];
      const ahora = new Date().toISOString();
      for (const f of importacion) {
        let p = buscarProducto(catalogo, { codigo: f.codigo, nombre: f.nombre });
        if (!p) {
          p = { id: nuevoId('prod'), codigo: f.codigo, nombre: f.nombre, grupo: f.grupo, unidad: f.unidad || 'UND', costoUltimo: f.costo, precioVenta: f.precioVenta, activo: true, creadoEn: ahora, actualizadoEn: ahora };
          catalogo.push(p);
          nuevos.push(p);
        } else if ((f.precioVenta && !p.precioVenta) || (f.grupo && !p.grupo)) {
          const act = { ...p, precioVenta: p.precioVenta || f.precioVenta, grupo: p.grupo || f.grupo, actualizadoEn: ahora };
          catalogo[catalogo.indexOf(p)] = act;
          nuevos.push(act);
          p = act;
        }
        movs.push({
          id: nuevoId('mov-x'),
          fecha: f.fecha || fechaLocal(),
          productoId: p.id,
          tipo: f.tipo,
          cantidad: f.tipo === 'ajuste' ? f.cantidad : Math.abs(f.cantidad),
          costoUnitario: f.tipo === 'entrada' ? f.costo : undefined,
          origen: 'importacion',
          motivo: f.motivo,
          referencia: 'Importado de Excel',
          creadoEn: ahora,
          actualizadoEn: ahora,
        });
      }
      await dataService.importarInventario(nuevos, movs);
      mostrarToast('success', 'Inventario importado', `${movs.length} movimiento(s); ${nuevos.length} producto(s) nuevos o completados.`);
      setImportacion(null);
      await cargar();
    } catch (e: any) {
      mostrarToast('error', 'No se pudo importar', e?.message);
    } finally {
      setTrabajando(false);
    }
  };

  const exportar = () => {
    const existencias = [
      ['Código', 'Producto', 'Grupo', 'Unidad', 'Entradas', 'Salidas', 'Bajas', 'Ajustes', 'Saldo', 'Costo promedio', 'Valor inventario', 'Precio venta', 'Estado'],
      ...saldos.map((s) => [s.producto.codigo || '', s.producto.nombre, s.producto.grupo || '', s.producto.unidad, s.entradas, s.salidas, s.bajas, s.ajustes, s.saldo, s.costoPromedio, s.valor, s.producto.precioVenta || '', s.estado]),
    ];
    const kardex = [
      ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Efecto en saldo', 'Costo unitario', 'Origen', 'Referencia', 'Motivo', 'Observaciones'],
      ...movimientos.map((m) => [m.fecha, porId.get(m.productoId)?.nombre || '', ETIQUETA_TIPO[m.tipo].texto, m.cantidad, efecto(m), m.costoUnitario || '', ORIGEN[m.origen] || m.origen, m.referencia || '', m.motivo || '', m.observaciones || '']),
    ];
    const wb = XLSX.utils.book_new();
    const h1 = XLSX.utils.aoa_to_sheet(existencias);
    h1['!cols'] = [{ wch: 10 }, { wch: 34 }, { wch: 14 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, h1, 'Existencias');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kardex), 'Movimientos (kárdex)');
    guardarExcel(wb, `VetCompras_Inventario_${fechaLocal()}.xlsx`);
  };

  const eliminar = async () => {
    if (!aEliminar) return;
    try {
      if (aEliminar.tipo === 'producto') await dataService.eliminarProducto(aEliminar.id);
      else await dataService.eliminarMovimiento(aEliminar.id);
      mostrarToast('info', 'Eliminado', aEliminar.nombre);
      await cargar();
    } catch (e: any) {
      mostrarToast('error', 'No se pudo eliminar', e?.message);
    } finally {
      setAEliminar(null);
    }
  };

  const colorSaldo = (s: SaldoProducto) =>
    s.estado === 'negativo' ? 'text-rose-600' : s.estado === 'agotado' ? 'text-slate-400' : s.estado === 'bajo' ? 'text-amber-600' : 'text-slate-900 dark:text-white';

  if (cargando) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <datalist id="grupos-inventario">
        {[...new Set(productos.map((p) => p.grupo).filter(Boolean))].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {/* Encabezado */}
      <div className={`${claseTarjeta} p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Boxes className="w-5 h-5 text-emerald-600" /> Inventario de productos
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Control <strong>informativo</strong>: las compras con detalle de productos suman, las ventas restan y usted registra bajas y ajustes. El saldo puede quedar
              en negativo y nunca impide vender. Todo movimiento se puede editar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onCargarCompra} className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`} title="Factura XML/ZIP de la DIAN, PDF, foto o matriz de Excel">
              <UploadCloud className="w-4 h-4" /> Cargar compra
            </button>
            <button onClick={onRegistroManual} className={`${boton} border-emerald-600 text-emerald-700 dark:text-emerald-300`} title="Compra sin factura electrónica, con detalle de productos">
              <FilePenLine className="w-4 h-4" /> Compra manual
            </button>
            <button onClick={() => setModalMov({ tipo: 'entrada' })} className={`${boton} border-slate-300 dark:border-slate-700`}>
              <PackagePlus className="w-4 h-4 text-emerald-600" /> Entrada rápida
            </button>
            <button onClick={() => setModalMov({ tipo: 'baja' })} className={`${boton} border-slate-300 dark:border-slate-700`}>
              <PackageMinus className="w-4 h-4 text-rose-600" /> Registrar baja
            </button>
            <button onClick={() => setModalProducto({ abierto: true })} className={`${boton} border-slate-300 dark:border-slate-700`}>
              <Plus className="w-4 h-4" /> Nuevo producto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { t: 'Productos', v: resumen.productos.toLocaleString('es-CO'), c: 'text-slate-900 dark:text-white' },
            { t: 'Unidades en existencia', v: unidades(resumen.unidades), c: 'text-slate-900 dark:text-white' },
            { t: 'Valor del inventario (costo)', v: formatCOP(resumen.valor), c: 'text-emerald-700 dark:text-emerald-400' },
            { t: 'Con saldo negativo', v: String(resumen.negativos), c: resumen.negativos ? 'text-rose-600' : 'text-slate-400', f: 'negativo' as const },
            { t: 'Agotados / bajo mínimo', v: `${resumen.agotados} / ${resumen.bajos}`, c: resumen.agotados + resumen.bajos ? 'text-amber-600' : 'text-slate-400', f: 'bajo' as const },
          ].map((k) => (
            <button
              key={k.t}
              onClick={() => k.f && (setFiltroEstado(filtroEstado === k.f ? 'todos' : k.f), setPestana('existencias'))}
              className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 p-3 ${k.f ? 'hover:border-emerald-400' : 'cursor-default'}`}
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{k.t}</p>
              <p className={`text-lg font-black ${k.c}`}>{k.v}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Pestañas y herramientas */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'existencias' as const, label: 'Existencias', icon: ClipboardList },
          { id: 'movimientos' as const, label: 'Movimientos (kárdex)', icon: History },
        ].map(({ id, label, icon: Icono }) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
              pestana === id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Icono className="w-4 h-4" /> {label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar producto, código, grupo, referencia…" className={claseInput + ' pl-9'} />
        </div>
        <button onClick={() => archivoRef.current?.click()} className={`${boton} border-slate-300 dark:border-slate-700`} title="Inventario inicial o movimientos desde una matriz de Excel">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Importar Excel
        </button>
        <input ref={archivoRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={elegirArchivo} />
        <button onClick={descargarPlantilla} className={`${boton} border-slate-300 dark:border-slate-700`}>
          <ArrowDownToLine className="w-4 h-4" /> Plantilla
        </button>
        <button onClick={exportar} className={`${boton} border-slate-300 dark:border-slate-700`}>
          <Download className="w-4 h-4" /> Exportar
        </button>
        <button onClick={recalcular} disabled={trabajando} className={`${boton} border-slate-300 dark:border-slate-700`} title="Rehace las entradas y salidas automáticas desde todas las compras y ventas registradas">
          {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Recalcular
        </button>
      </div>

      {pestana === 'existencias' ? (
        <div className={`${claseTarjeta} overflow-x-auto`}>
          {filtroEstado !== 'todos' && (
            <div className="px-4 pt-3 text-xs">
              Filtro: <strong>{filtroEstado}</strong>{' '}
              <button onClick={() => setFiltroEstado('todos')} className="text-emerald-700 underline">
                quitar
              </button>
            </div>
          )}
          {saldosFiltrados.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 space-y-2">
              <Boxes className="w-10 h-10 mx-auto text-slate-300" />
              <p>No hay productos {productos.length ? 'con ese filtro' : 'todavía'}.</p>
              {!productos.length && (
                <p className="text-xs">
                  Cargue una compra con detalle de productos, importe su inventario inicial desde Excel o pulse “Recalcular” para tomar las compras y ventas ya registradas.
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm min-w-[980px]">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left py-2.5 px-3">Producto</th>
                  <th className="text-right px-2 whitespace-nowrap">Entradas</th>
                  <th className="text-right px-2 whitespace-nowrap">Salidas</th>
                  <th className="text-right px-2 whitespace-nowrap">Bajas</th>
                  <th className="text-right px-2 whitespace-nowrap">Ajustes</th>
                  <th className="text-right px-2 whitespace-nowrap">Saldo</th>
                  <th className="text-right px-2 whitespace-nowrap">Costo prom.</th>
                  <th className="text-right px-2 whitespace-nowrap">Valor</th>
                  <th className="text-right px-2 whitespace-nowrap">P. venta</th>
                  <th className="text-right px-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {saldosFiltrados.map((s) => (
                  <tr key={s.producto.id} className={s.producto.activo === false ? 'opacity-50' : ''}>
                    <td className="py-2.5 px-3">
                      <button onClick={() => verKardex(s.producto.id)} className="font-semibold text-left hover:text-emerald-700" title="Ver movimientos">
                        {s.producto.nombre}
                      </button>
                      <p className="text-[11px] text-slate-500">
                        {[s.producto.codigo, s.producto.grupo, s.producto.unidad].filter(Boolean).join(' · ')}
                        {s.ultimoMovimiento ? ` · últ. mov. ${formatFecha(s.ultimoMovimiento)}` : ''}
                      </p>
                    </td>
                    <td className="text-right px-2 whitespace-nowrap">{unidades(s.entradas)}</td>
                    <td className="text-right px-2 whitespace-nowrap">{unidades(s.salidas)}</td>
                    <td className="text-right px-2 whitespace-nowrap">{unidades(s.bajas)}</td>
                    <td className="text-right px-2 whitespace-nowrap">{s.ajustes ? (s.ajustes > 0 ? '+' : '') + unidades(s.ajustes) : '—'}</td>
                    <td className={`text-right px-2 font-black ${colorSaldo(s)}`}>
                      {unidades(s.saldo)}
                      {s.estado === 'negativo' && <AlertTriangle className="w-3.5 h-3.5 inline ml-1" aria-label="Saldo negativo" />}
                    </td>
                    <td className="text-right px-2 whitespace-nowrap">{s.costoPromedio ? formatCOP(s.costoPromedio) : '—'}</td>
                    <td className="text-right px-2 whitespace-nowrap">{s.valor ? formatCOP(s.valor) : '—'}</td>
                    <td className="text-right px-2 whitespace-nowrap">{s.producto.precioVenta ? formatCOP(s.producto.precioVenta) : '—'}</td>
                    <td className="px-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setModalMov({ tipo: 'entrada', productoId: s.producto.id, costoUnitario: s.producto.costoUltimo })} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700" title="Entrada">
                          <ArrowDownToLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => setModalMov({ tipo: 'baja', productoId: s.producto.id })} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600" title="Baja (daño, pérdida, vencimiento)">
                          <ArrowUpFromLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => setAjuste(s)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600" title="Ajustar saldo (conteo físico)">
                          <Scale className="w-4 h-4" />
                        </button>
                        <button onClick={() => setModalProducto({ abierto: true, producto: s.producto })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Editar producto">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setAEliminar({ tipo: 'producto', id: s.producto.id, nombre: s.producto.nombre })} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600" title="Eliminar producto y sus movimientos">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className={`${claseTarjeta} overflow-x-auto`}>
          <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100 dark:border-slate-800">
            <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} className={claseInput + ' max-w-xs'}>
              <option value="">Todos los productos</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)} className={claseInput + ' max-w-[180px]'}>
              <option value="">Todos los tipos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
              <option value="baja">Bajas</option>
              <option value="ajuste">Ajustes</option>
            </select>
            {filtroProducto && (
              <span className="self-center text-xs text-slate-600 dark:text-slate-300">
                Saldo: <strong>{unidades(saldos.find((s) => s.producto.id === filtroProducto)?.saldo || 0)}</strong>
              </span>
            )}
          </div>
          {movimientosFiltrados.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">No hay movimientos con ese filtro.</p>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left py-2.5 px-3">Fecha</th>
                  <th className="text-left px-2">Producto</th>
                  <th className="text-left px-2">Tipo</th>
                  <th className="text-right px-2 whitespace-nowrap">Unidades</th>
                  <th className="text-right px-2 whitespace-nowrap">Costo unit.</th>
                  <th className="text-left px-2">Origen / referencia</th>
                  <th className="text-right px-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {movimientosFiltrados.slice(0, 500).map((m) => {
                  const e = efecto(m);
                  return (
                    <tr key={m.id}>
                      <td className="py-2 px-3 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                      <td className="px-2">{porId.get(m.productoId)?.nombre || <em className="text-slate-400">Producto eliminado</em>}</td>
                      <td className="px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ETIQUETA_TIPO[m.tipo].clase}`}>{ETIQUETA_TIPO[m.tipo].texto}</span>
                        {m.editado && <span className="ml-1 text-[10px] text-amber-600" title="Editado a mano: no se recalcula">✎</span>}
                      </td>
                      <td className={`text-right px-2 font-bold ${e < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {e > 0 ? '+' : ''}
                        {unidades(e)}
                      </td>
                      <td className="text-right px-2 whitespace-nowrap">{m.costoUnitario ? formatCOP(m.costoUnitario) : '—'}</td>
                      <td className="px-2 text-xs text-slate-600 dark:text-slate-300">
                        <strong>{ORIGEN[m.origen] || m.origen}</strong>
                        {m.referencia ? ` · ${m.referencia}` : ''}
                        {m.motivo ? ` · ${m.motivo}` : ''}
                        {m.observaciones ? ` · ${m.observaciones}` : ''}
                      </td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setModalMov(m)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title="Editar movimiento">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAEliminar({ tipo: 'movimiento', id: m.id, nombre: `${ETIQUETA_TIPO[m.tipo].texto} de ${porId.get(m.productoId)?.nombre || 'producto'}` })}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600"
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalProducto.abierto && <ModalProducto producto={modalProducto.producto} onCerrar={() => setModalProducto({ abierto: false })} onGuardado={cargar} />}
      {modalMov && (
        <ModalMovimiento
          productos={productos}
          inicial={modalMov}
          onCerrar={() => setModalMov(null)}
          onGuardado={cargar}
          onNuevoProducto={() => setModalProducto({ abierto: true })}
        />
      )}
      {ajuste && <ModalAjuste saldo={ajuste} onCerrar={() => setAjuste(null)} onGuardado={cargar} />}
      {importacion && (
        <Modal titulo="Importar inventario desde Excel" onCerrar={() => setImportacion(null)} ancho="max-w-3xl">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Se encontraron <strong>{importacion.length}</strong> fila(s). Los productos que no existan se crean; cada fila queda como un movimiento (entrada si no se indica el tipo).
          </p>
          <div className="max-h-72 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                <tr>
                  <th className="text-left p-2">Producto</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-right p-2">Cantidad</th>
                  <th className="text-right p-2">Costo</th>
                  <th className="text-left p-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {importacion.slice(0, 100).map((f, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-2">
                      {f.nombre}
                      {buscarProducto(productos, { codigo: f.codigo, nombre: f.nombre }) ? '' : <span className="ml-1 text-emerald-700 font-semibold">(nuevo)</span>}
                    </td>
                    <td className="p-2">{ETIQUETA_TIPO[f.tipo].texto}</td>
                    <td className="p-2 text-right">{unidades(f.cantidad)}</td>
                    <td className="p-2 text-right">{f.costo ? formatCOP(f.costo) : '—'}</td>
                    <td className="p-2">{f.fecha || 'hoy'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setImportacion(null)} className={`${boton} border-slate-300 dark:border-slate-700`}>
              Cancelar
            </button>
            <button onClick={confirmarImportacion} disabled={trabajando} className={`${boton} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600`}>
              {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Importar {importacion.length} fila(s)
            </button>
          </div>
        </Modal>
      )}
      <ModalConfirmacion
        abierto={!!aEliminar}
        titulo={aEliminar?.tipo === 'producto' ? '¿Eliminar el producto?' : '¿Eliminar el movimiento?'}
        mensaje={
          aEliminar?.tipo === 'producto'
            ? `Se eliminan "${aEliminar?.nombre}" y todos sus movimientos. Las compras y ventas no se tocan.`
            : `Se elimina: ${aEliminar?.nombre}. El saldo se recalcula. (Si salió de una compra o venta, vuelve a crearse al editar esa compra o venta o al pulsar "Recalcular").`
        }
        textoConfirmar="Sí, eliminar"
        tipo="peligro"
        enConfirmar={eliminar}
        enCancelar={() => setAEliminar(null)}
      />
    </div>
  );
};
