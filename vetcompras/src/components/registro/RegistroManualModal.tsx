import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  FilePenLine,
  Building,
  Plus,
  Trash2,
  Paperclip,
  CheckCircle2,
  Boxes,
  FileSpreadsheet,
  ArrowDownToLine,
  Keyboard,
  Wallet,
} from 'lucide-react';
import {
  CompraDocumento,
  LineaFactura,
  TipoDocumento,
  Categoria,
  CentroCosto,
  Proveedor,
  FormaPago,
  Producto,
  RegistroPago,
} from '../../types';
import { formatCOP, fechaLocal } from '../../utils/formatters';
import { conceptosPara, tipoDe } from '../../utils/conceptos';
import { buscarProducto, compraMueveInventario } from '../../utils/inventario';
import { FORMAS_PAGO, MEDIOS_PAGO_COMPRA, calcularPagosCompra, esPagoDelRegistro } from '../../utils/pagosCompra';
import { nombreSubcategoria, subcategoriasActivas } from '../../utils/subcategorias';
import { descargarPlantillaProductosCompra, leerProductosCompra } from '../../services/plantillaProductosCompra';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

interface RegistroManualModalProps {
  categorias: Categoria[];
  centrosCosto: CentroCosto[];
  proveedores: Proveedor[];
  documentoParaEditar?: CompraDocumento;
  /** Abrir como compra de mercancía que afecta inventario, con productos */
  detallado?: boolean;
  onGuardado: (docId: string) => void;
  onCerrar: () => void;
  onProveedorCreado: () => void;
}

type Modo = 'sencilla' | 'detallada';

const input = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs';
const etiqueta = 'block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1';
const nuevoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const sumarDias = (fecha: string, dias: number) => {
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(y, m - 1, d + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};
const lineaVacia = (): LineaFactura => ({ id: nuevoId('lin'), descripcion: '', cantidad: 1, unidad: 'UND', valorUnitario: 0, descuento: 0, porcentajeIva: 19, valorIva: 0, totalLinea: 0 });
const recalcular = (l: LineaFactura): LineaFactura => {
  const base = Math.max(0, (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0) - (Number(l.descuento) || 0));
  const valorIva = Math.round((base * (Number(l.porcentajeIva) || 0)) / 100);
  return { ...l, valorIva, totalLinea: base + valorIva };
};

/** Pregunta de Sí / No con dos botones grandes. */
const Pregunta: React.FC<{ id: string; texto: string; ayuda?: string; valor: boolean | null; si: string; no: string; onCambio: (v: boolean) => void }> = ({
  id,
  texto,
  ayuda,
  valor,
  si,
  no,
  onCambio,
}) => (
  <div className="space-y-2">
    <p className="text-sm font-bold text-slate-900 dark:text-white">{texto}</p>
    {ayuda && <p className="text-[11px] text-slate-500 -mt-1">{ayuda}</p>}
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={texto}>
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          id={`${id}-${v ? 'si' : 'no'}`}
          role="radio"
          aria-checked={valor === v}
          onClick={() => onCambio(v)}
          className={`px-3 py-2.5 rounded-xl border-2 text-xs font-bold text-left ${
            valor === v ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          {v ? 'Sí' : 'No'} <span className="font-normal">· {v ? si : no}</span>
        </button>
      ))}
    </div>
  </div>
);

export const RegistroManualModal: React.FC<RegistroManualModalProps> = ({
  categorias,
  centrosCosto,
  proveedores,
  documentoParaEditar: doc0,
  detallado,
  onGuardado,
  onCerrar,
}) => {
  const { mostrarToast } = useToast();
  const abs = (v: number | undefined) => Math.abs(Number(v) || 0);

  const tieneDetalle = !!doc0?.lineas?.length && !doc0.lineas.every((l) => l.resumen || l.id === 'lin-global');

  // ------------------------------------------------------------ modo y preguntas
  const [modo, setModo] = useState<Modo>(doc0?.modoRegistro || (doc0 && (tieneDetalle || doc0.cufe || doc0.totalRetenciones) ? 'detallada' : 'sencilla'));
  const [esMercancia, setEsMercancia] = useState<boolean | null>(doc0 ? doc0.esMercancia ?? !doc0.esGasto : detallado ? true : null);
  const [afecta, setAfecta] = useState<boolean | null>(doc0 ? doc0.afectaInventario ?? compraMueveInventario(doc0) : detallado ? true : null);
  const [carga, setCarga] = useState<'manual' | 'archivo'>('manual');
  const [desglose, setDesglose] = useState(tieneDetalle);
  const usaLineas = (esMercancia === true && afecta === true) || (modo === 'detallada' && desglose);
  const preguntasListas = esMercancia === false || (esMercancia === true && afecta !== null);

  // ------------------------------------------------------------ datos del documento
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>(doc0?.tipoDocumento || 'factura_electronica');
  const [prefijo, setPrefijo] = useState(doc0?.prefijo || '');
  const [folio, setFolio] = useState(doc0?.folio || '');
  const [cufe, setCufe] = useState(doc0?.cufe || '');
  const [fechaEmision, setFechaEmision] = useState(doc0?.fechaEmision || fechaLocal());

  const [proveedorId, setProveedorId] = useState(doc0?.proveedorId || '');
  const [nit, setNit] = useState(doc0?.proveedor?.nit || '');
  const [razonSocial, setRazonSocial] = useState(doc0?.proveedor?.razonSocial || '');
  const [telefono, setTelefono] = useState(doc0?.proveedor?.telefono || '');
  const [email, setEmail] = useState(doc0?.proveedor?.email || '');
  const [ciudad, setCiudad] = useState(doc0?.proveedor?.ciudad || '');

  const categoriasCompra = categorias.filter((c) => !c.esGasto);
  const categoriasGasto = categorias.filter((c) => c.esGasto);
  const [categoriaId, setCategoriaId] = useState(doc0?.categoriaId || '');
  const [subcategoriaId, setSubcategoriaId] = useState(doc0?.subcategoriaId || '');
  const subcategorias = subcategoriasActivas(categorias.find((c) => c.id === categoriaId));
  // Al cambiar de categoría, la subcategoría anterior deja de aplicar
  useEffect(() => {
    if (subcategoriaId && !categorias.find((c) => c.id === categoriaId)?.subcategorias?.some((x) => x.id === subcategoriaId)) setSubcategoriaId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);
  const [centroCostoId, setCentroCostoId] = useState(doc0?.centroCostoId || centrosCosto[0]?.id || 'cc-clinica');
  // Mercancía → solo categorías de compra; si no, cualquiera (primero las de gasto)
  const opcionesCategoria = esMercancia ? categoriasCompra : [...categoriasGasto, ...categoriasCompra];
  useEffect(() => {
    if (esMercancia === null) return;
    if (!opcionesCategoria.some((c) => c.id === categoriaId)) setCategoriaId(opcionesCategoria[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esMercancia]);

  const [subtotalRapido, setSubtotalRapido] = useState(abs(doc0?.subtotal));
  const [ivaRapido, setIvaRapido] = useState(abs(doc0?.totalIva));
  const [reteFuente, setReteFuente] = useState(abs(doc0?.reteFuente));
  const [reteIva, setReteIva] = useState(abs(doc0?.reteIva));
  const [reteIca, setReteIca] = useState(abs(doc0?.reteIca));
  const descuentosDocumento = abs(doc0?.descuentos);
  const impoconsumo = abs(doc0?.impoconsumo);

  const [lineas, setLineas] = useState<LineaFactura[]>(
    tieneDetalle ? doc0!.lineas.filter((l) => !l.resumen).map((l) => ({ ...l, valorIva: abs(l.valorIva), totalLinea: abs(l.totalLinea) })) : [lineaVacia()]
  );
  const [archivoAdjunto, setArchivoAdjunto] = useState(doc0?.archivoAdjunto);
  const [observaciones, setObservaciones] = useState(doc0?.observaciones || '');
  const [guardando, setGuardando] = useState(false);
  const [leyendoArchivo, setLeyendoArchivo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  // Conceptos del catálogo como sugerencia en cada ítem
  const [conceptos, setConceptos] = useState<Producto[]>([]);
  useEffect(() => {
    dataService.obtenerProductos().then((p) => setConceptos(conceptosPara(p, ['compra', 'gasto']))).catch(() => undefined);
  }, []);

  // ------------------------------------------------------------ totales
  const totalSubtotal = usaLineas
    ? lineas.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0) - (Number(l.descuento) || 0), 0)
    : Number(subtotalRapido) || 0;
  const totalIva = usaLineas ? lineas.reduce((a, l) => a + (Number(l.valorIva) || 0), 0) : Number(ivaRapido) || 0;
  const totalRetenciones = modo === 'detallada' ? (Number(reteFuente) || 0) + (Number(reteIva) || 0) + (Number(reteIca) || 0) : abs(doc0?.totalRetenciones);
  const totalGeneral = Math.max(0, totalSubtotal - descuentosDocumento + totalIva + impoconsumo);
  const neto = Math.max(0, totalGeneral - totalRetenciones);
  const esNota = tipoDocumento === 'nota_credito';

  // ------------------------------------------------------------ forma de pago
  const formaInicial: FormaPago = doc0?.formaPago || 'contado';
  const [formaPago, setFormaPago] = useState<FormaPago>(formaInicial);
  const [fechaVencimiento, setFechaVencimiento] = useState(
    doc0?.fechaVencimiento && doc0.fechaVencimiento !== doc0.fechaEmision ? doc0.fechaVencimiento : sumarDias(doc0?.fechaEmision || fechaLocal(), 30)
  );
  const [pagos, setPagos] = useState<RegistroPago[]>(doc0?.pagos?.length ? doc0.pagos.map((p) => ({ ...p })) : []);
  // En contado, mientras no se toquen los pagos, uno solo cubre todo el valor
  const [pagosTocados, setPagosTocados] = useState(!!doc0?.pagos?.length);
  const [medioContado, setMedioContado] = useState(
    doc0?.medioPago && MEDIOS_PAGO_COMPRA.includes(doc0.medioPago) ? doc0.medioPago : MEDIOS_PAGO_COMPRA[0]
  );
  const pagosEfectivos: RegistroPago[] =
    formaPago === 'contado' && !pagosTocados ? [{ id: 'pago-contado', fecha: fechaEmision, monto: neto, medio: medioContado, nota: 'Pago de contado' }] : pagos;
  const resultadoPagos = useMemo(
    () => calcularPagosCompra({ neto, formaPago, pagos: formaPago === 'credito' ? doc0?.pagos || [] : pagosEfectivos, medioPorDefecto: medioContado, fecha: fechaEmision, esNotaCredito: esNota }),
    [neto, formaPago, pagosEfectivos, medioContado, fechaEmision, esNota, doc0]
  );

  const cambiarForma = (f: FormaPago) => {
    setFormaPago(f);
    if (f === 'contado') {
      // Los abonos ya hechos se conservan y el resto se paga de contado
      const posteriores = pagos.filter((x) => !esPagoDelRegistro(x));
      const abonado = posteriores.reduce((acc, x) => acc + (Number(x.monto) || 0), 0);
      if (posteriores.length) {
        setPagosTocados(true);
        setPagos([...posteriores, ...(neto - abonado > 0 ? [{ id: nuevoId('pago'), fecha: fechaEmision, monto: Math.round(neto - abonado), medio: medioContado, nota: 'Pago de contado' }] : [])]);
      } else {
        setPagosTocados(false);
        setPagos([]);
      }
    } else if (f === 'credito_contado') {
      setPagosTocados(true);
      // Si venía de contado, el pago completo no sirve como abono: se empieza con el abono vacío
      setPagos((p) => {
        const posteriores = p.filter((x) => !esPagoDelRegistro(x));
        const iniciales = p.filter((x) => esPagoDelRegistro(x) && x.nota === 'Abono inicial');
        return [...posteriores, ...(iniciales.length ? iniciales : [{ id: nuevoId('pago'), fecha: fechaEmision, monto: 0, medio: medioContado, nota: 'Abono inicial' }])];
      });
    }
  };
  const editarPago = (id: string, cambios: Partial<RegistroPago>) => {
    const base = formaPago === 'contado' && !pagosTocados ? pagosEfectivos.map((p) => ({ ...p, id: nuevoId('pago') })) : pagos;
    const lista = base.map((p, i) => (p.id === id || (id === 'pago-contado' && i === 0) ? { ...p, ...cambios } : p));
    setPagosTocados(true);
    setPagos(lista);
  };
  const agregarPago = () => {
    const base = formaPago === 'contado' && !pagosTocados ? pagosEfectivos.map((p) => ({ ...p, id: nuevoId('pago') })) : pagos;
    const pagado = base.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const falta = formaPago === 'contado' ? Math.max(0, neto - pagado) : 0;
    setPagosTocados(true);
    setPagos([...base, { id: nuevoId('pago'), fecha: fechaEmision, monto: falta, medio: base.length ? MEDIOS_PAGO_COMPRA.find((m) => !base.some((p) => p.medio === m)) || MEDIOS_PAGO_COMPRA[1] : medioContado, nota: formaPago === 'contado' ? 'Pago de contado' : 'Abono inicial' }]);
  };
  const quitarPago = (id: string) => {
    setPagosTocados(true);
    setPagos(pagos.filter((p) => p.id !== id));
  };

  // ------------------------------------------------------------ proveedor y líneas
  const seleccionarProveedor = (id: string) => {
    setProveedorId(id);
    const p = proveedores.find((x) => x.id === id);
    if (!p) return;
    setNit(p.nit);
    setRazonSocial(p.razonSocial);
    setTelefono(p.telefono || '');
    setEmail(p.email || '');
    setCiudad(p.ciudad || '');
    if (p.categoriaPredeterminadaId && opcionesCategoria.some((c) => c.id === p.categoriaPredeterminadaId)) setCategoriaId(p.categoriaPredeterminadaId);
    if (p.centroCostoPredeterminadoId) setCentroCostoId(p.centroCostoPredeterminadoId);
  };

  const cambiarLinea = (id: string, cambios: Partial<LineaFactura>) => setLineas((ls) => ls.map((l) => (l.id === id ? recalcular({ ...l, ...cambios }) : l)));
  const cambiarDescripcion = (id: string, texto: string) => {
    const c = buscarProducto(conceptos, { nombre: texto });
    setLineas((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const act: LineaFactura = { ...l, descripcion: texto };
        if (c) {
          act.productoId = c.id;
          act.codigo = c.codigo || act.codigo;
          act.unidad = c.unidad || act.unidad;
          if (c.ivaPct !== undefined && c.ivaPct !== null) act.porcentajeIva = c.ivaPct;
          if (!Number(act.valorUnitario) && c.costoUltimo) act.valorUnitario = c.costoUltimo;
        } else if (act.productoId && conceptos.some((x) => x.id === act.productoId)) act.productoId = undefined;
        return recalcular(act);
      })
    );
    if (c && lineas[0]?.id === id) {
      if (c.categoriaCompraId && opcionesCategoria.some((x) => x.id === c.categoriaCompraId)) setCategoriaId(c.categoriaCompraId);
      if (c.centroCostoId && centrosCosto.some((x) => x.id === c.centroCostoId)) setCentroCostoId(c.centroCostoId);
    }
  };

  const cargarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setLeyendoArchivo(true);
    try {
      const { lineas: leidas, errores } = await leerProductosCompra(archivo);
      if (!leidas.length) {
        mostrarToast('warning', 'No se cargaron productos', errores[0] || 'El archivo no tiene filas con producto, cantidad y costo.');
        return;
      }
      setLineas(leidas);
      mostrarToast(
        errores.length ? 'warning' : 'success',
        `${leidas.length} producto(s) cargados`,
        errores.length ? `${errores.length} fila(s) con observaciones: ${errores.slice(0, 2).join(' ')}` : 'Revíselos abajo antes de guardar.'
      );
    } catch (err: any) {
      mostrarToast('error', 'No se pudo leer el archivo', err?.message || 'Use la plantilla en formato Excel (.xlsx).');
    } finally {
      setLeyendoArchivo(false);
    }
  };

  const adjuntar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setArchivoAdjunto({ nombre: file.name, tipo: file.type.includes('pdf') ? 'pdf' : 'imagen', tamano: file.size, dataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  // ------------------------------------------------------------ guardar
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const aviso = (t: string, m: string) => mostrarToast('warning', t, m);
    if (esMercancia === null) return aviso('Falta una respuesta', '¿Es compra de mercancía? Responda Sí o No.');
    if (esMercancia && afecta === null) return aviso('Falta una respuesta', '¿Desea que afecte el inventario? Responda Sí o No.');
    if (!nit.trim() || !razonSocial.trim()) return aviso('Proveedor incompleto', 'Escriba el NIT y el nombre o razón social del proveedor.');
    if (!folio.trim()) return aviso('Número requerido', 'Escriba el número de la factura o documento.');
    if (usaLineas) {
      const malas = lineas.filter((l) => !l.descripcion.trim() || !(Number(l.cantidad) > 0));
      if (malas.length) return aviso('Revise los productos', 'Cada producto necesita nombre y cantidad mayor a cero.');
    }
    if (totalGeneral <= 0) return aviso('Valor inválido', 'El valor de la factura debe ser mayor a cero.');
    if (resultadoPagos.error) return aviso('Revise la forma de pago', resultadoPagos.error);
    if (formaPago !== 'contado' && !esNota && !fechaVencimiento) return aviso('Falta el vencimiento', 'Indique hasta cuándo tiene plazo para pagar el saldo.');

    setGuardando(true);
    try {
      const cat = categorias.find((c) => c.id === categoriaId);
      const signo = esNota ? -1 : 1;
      const s = (v: number) => Math.round(v) * signo;

      let base0 = 0, base5 = 0, base19 = 0, iva5 = 0, iva19 = 0;
      if (usaLineas) {
        for (const l of lineas) {
          const b = (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0) - (Number(l.descuento) || 0);
          if (Math.abs(l.porcentajeIva - 19) < 0.5) (base19 += b), (iva19 += l.valorIva);
          else if (Math.abs(l.porcentajeIva - 5) < 0.5) (base5 += b), (iva5 += l.valorIva);
          else base0 += b;
        }
      } else {
        const tarifa = totalSubtotal > 0 ? (totalIva / totalSubtotal) * 100 : 0;
        if (totalIva > 0 && Math.abs(tarifa - 5) < 1) (base5 = totalSubtotal), (iva5 = totalIva);
        else if (totalIva > 0) (base19 = totalSubtotal), (iva19 = totalIva);
        else base0 = totalSubtotal;
      }

      const ultimoPago = [...resultadoPagos.pagos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).pop();
      const ahora = new Date().toISOString();
      const usuario = dataService.usuarioActual()?.nombre || 'Usuario';
      const doc: CompraDocumento = {
        // Se parte del original para no perder datos sin campo aquí (adquirente, DV, extracción…)
        ...(doc0 || {}),
        id: doc0?.id || nuevoId('doc'),
        tipoDocumento,
        origen: tipoDocumento === 'factura_electronica' ? 'electronica' : 'manual',
        prefijo: prefijo.trim(),
        folio: folio.trim(),
        cufe: cufe.trim() || undefined,
        fechaEmision,
        fechaVencimiento: formaPago === 'contado' || esNota ? fechaEmision : fechaVencimiento,
        formaPago,
        medioPago: resultadoPagos.medio,
        proveedorId: proveedorId || undefined,
        proveedor: { ...(doc0?.proveedor || {}), nit: nit.trim(), razonSocial: razonSocial.trim(), telefono: telefono.trim(), email: email.trim(), ciudad: ciudad.trim() },
        categoriaId,
        subcategoriaId: subcategoriaId || undefined,
        centroCostoId,
        esGasto: esMercancia ? false : !!cat?.esGasto,
        esMercancia,
        afectaInventario: esMercancia === true && afecta === true,
        modoRegistro: modo,
        moneda: 'COP',
        subtotal: s(totalSubtotal),
        descuentos: s(descuentosDocumento),
        baseIva0: s(base0),
        baseIva5: s(base5),
        baseIva19: s(base19),
        iva5: s(iva5),
        iva19: s(iva19),
        totalIva: s(totalIva),
        impoconsumo: s(impoconsumo),
        reteFuente: s(modo === 'detallada' ? reteFuente : abs(doc0?.reteFuente)),
        reteIva: s(modo === 'detallada' ? reteIva : abs(doc0?.reteIva)),
        reteIca: s(modo === 'detallada' ? reteIca : abs(doc0?.reteIca)),
        totalRetenciones: s(totalRetenciones),
        total: s(totalGeneral),
        saldoPendiente: resultadoPagos.saldo,
        estadoPago: resultadoPagos.estado,
        fechaPago: resultadoPagos.estado === 'pagada' ? ultimoPago?.fecha || fechaEmision : undefined,
        pagos: resultadoPagos.pagos,
        lineas: usaLineas
          ? lineas.map((l) => ({ ...l, resumen: undefined, valorIva: s(l.valorIva), totalLinea: s(l.totalLinea) }))
          : [
              {
                id: 'lin-global',
                descripcion: `${esMercancia ? 'Compra de mercancía' : 'Compra o gasto'} - ${cat?.nombre || 'General'}`,
                cantidad: 1,
                unidad: 'UND',
                valorUnitario: Math.round(totalSubtotal),
                descuento: 0,
                porcentajeIva: totalSubtotal > 0 ? Math.round((totalIva / totalSubtotal) * 100) : 0,
                valorIva: s(totalIva),
                totalLinea: s(totalSubtotal + totalIva),
                resumen: true, // sin detalle de productos: no mueve inventario
              },
            ],
        archivoAdjunto,
        observaciones,
        historialCambios: [
          ...(doc0?.historialCambios || []),
          { fecha: ahora, usuario, accion: doc0 ? `Edición (registro ${modo})` : `Creación (registro ${modo})` },
        ],
        creadoEn: doc0?.creadoEn || ahora,
        actualizadoEn: ahora,
      };
      await dataService.guardarDocumento(doc);
      const extra = doc.afectaInventario ? ` · ${lineas.length} producto(s) al inventario` : '';
      mostrarToast('success', 'Documento guardado', `${doc.folio}: ${resultadoPagos.saldo > 0 ? `saldo por pagar ${formatCOP(resultadoPagos.saldo)}` : 'pagado'}${extra}.`);
      onGuardado(doc.id);
    } catch (err: any) {
      mostrarToast('error', 'Error al guardar', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  // ------------------------------------------------------------ vista
  const seccion = 'p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 space-y-3';
  const titulo = (t: string, icono?: React.ReactNode) => (
    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
      {icono}
      {t}
    </p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <FilePenLine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{doc0 ? 'Editar compra o gasto' : 'Registrar compra o gasto'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {modo === 'sencilla' ? 'Sencilla: solo los datos básicos.' : 'Detallada: todos los datos de la factura (tipo, CUFE, retenciones, soporte…).'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800" role="tablist" aria-label="Forma de registro">
              {(['sencilla', 'detallada'] as Modo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  id={`modo-${m}`}
                  aria-selected={modo === m}
                  onClick={() => setModo(m)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${modo === m ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {m === 'sencilla' ? 'Sencilla' : 'Detallada'}
                </button>
              ))}
            </div>
            <button onClick={onCerrar} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={guardar} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* 1. Preguntas */}
          <div className={seccion}>
            <Pregunta
              id="pregunta-mercancia"
              texto="¿Es compra de mercancía?"
              ayuda="Mercancía = productos para vender (medicamentos, alimentos, accesorios…)."
              valor={esMercancia}
              si="productos para vender"
              no="gasto, servicio u otra compra"
              onCambio={(v) => {
                setEsMercancia(v);
                if (!v) setAfecta(null);
              }}
            />
            {esMercancia && (
              <Pregunta
                id="pregunta-inventario"
                texto="¿Desea que afecte el inventario?"
                ayuda="Sí: los productos de la factura suman a las existencias. No: solo se registra la compra."
                valor={afecta}
                si="cargar los productos"
                no="solo datos de la compra"
                onCambio={setAfecta}
              />
            )}
            {esMercancia && afecta && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">¿Cómo va a cargar los productos?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="carga-manual"
                    onClick={() => setCarga('manual')}
                    className={`p-3 rounded-xl border-2 text-left ${carga === 'manual' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white"><Keyboard className="w-4 h-4 text-emerald-600" /> Cargar manual</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">Escriba cada producto con su cantidad y costo.</span>
                  </button>
                  <button
                    type="button"
                    id="carga-archivo"
                    onClick={() => setCarga('archivo')}
                    className={`p-3 rounded-xl border-2 text-left ${carga === 'archivo' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Cargar archivo</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">Diligencie la plantilla de Excel y súbala.</span>
                  </button>
                </div>
                {carga === 'archivo' && (
                  <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-emerald-400">
                    <button type="button" id="descargar-plantilla-compra" onClick={descargarPlantillaProductosCompra} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                      <ArrowDownToLine className="w-4 h-4" /> 1. Descargar plantilla
                    </button>
                    <button type="button" onClick={() => archivoRef.current?.click()} disabled={leyendoArchivo} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-60">
                      <FileSpreadsheet className="w-4 h-4" /> {leyendoArchivo ? 'Leyendo…' : '2. Subir plantilla diligenciada'}
                    </button>
                    <input ref={archivoRef} id="archivo-productos-compra" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={cargarArchivo} />
                    <span className="text-[11px] text-slate-500">Los productos quedan abajo para revisarlos antes de guardar.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {!preguntasListas ? (
            <p className="text-xs text-slate-500 text-center py-4">Responda las preguntas de arriba para continuar con el registro.</p>
          ) : (
            <>
              {/* 2. Proveedor y documento */}
              <div className={seccion}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {titulo('Proveedor y factura', <Building className="w-4 h-4 text-teal-600" />)}
                  <select value={proveedorId} onChange={(e) => seleccionarProveedor(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 max-w-full">
                    <option value="">-- Elegir proveedor guardado --</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.razonSocial} (NIT {p.nit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className={etiqueta} htmlFor="reg-nit">NIT o cédula *</label>
                    <input id="reg-nit" value={nit} onChange={(e) => setNit(e.target.value)} className={input + ' font-semibold'} placeholder="900123456" />
                  </div>
                  <div className="sm:col-span-5">
                    <label className={etiqueta} htmlFor="reg-razon">Nombre o razón social *</label>
                    <input id="reg-razon" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className={input + ' font-semibold'} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={etiqueta} htmlFor="reg-folio">N.º factura *</label>
                    <input id="reg-folio" value={folio} onChange={(e) => setFolio(e.target.value)} className={input + ' font-bold'} placeholder="0045" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={etiqueta} htmlFor="reg-fecha">Fecha *</label>
                    <input id="reg-fecha" type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className={input} />
                  </div>
                </div>
                <div className={`grid grid-cols-1 gap-3 ${modo === 'detallada' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  <div>
                    <label className={etiqueta} htmlFor="reg-categoria">Categoría *</label>
                    <select id="reg-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={input}>
                      {opcionesCategoria.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.esGasto ? '(gasto)' : '(compra)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={etiqueta} htmlFor="reg-subcategoria">Subcategoría</label>
                    <select id="reg-subcategoria" value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)} className={input} disabled={!subcategorias.length}>
                      <option value="">{subcategorias.length ? 'Sin subcategoría' : 'Esta categoría no tiene'}</option>
                      {subcategorias.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nombre}
                        </option>
                      ))}
                      {subcategoriaId && !subcategorias.some((x) => x.id === subcategoriaId) && (
                        <option value={subcategoriaId}>{nombreSubcategoria(categorias, categoriaId, subcategoriaId) || subcategoriaId} (eliminada)</option>
                      )}
                    </select>
                  </div>
                  {modo === 'detallada' && (
                    <div>
                      <label className={etiqueta} htmlFor="reg-centro">Centro de costo</label>
                      <select id="reg-centro" value={centroCostoId} onChange={(e) => setCentroCostoId(e.target.value)} className={input}>
                        {centrosCosto.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            {cc.codigo} - {cc.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {modo === 'detallada' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={etiqueta} htmlFor="reg-tipo">Tipo de documento</label>
                        <select id="reg-tipo" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)} className={input}>
                          <option value="factura_electronica">Factura electrónica (DIAN)</option>
                          <option value="documento_soporte">Documento soporte (no obligados)</option>
                          <option value="cuenta_cobro">Cuenta de cobro</option>
                          <option value="factura_papel">Factura de papel / talonario</option>
                          <option value="tiquete_pos">Tiquete de caja / POS</option>
                          <option value="recibo_caja">Recibo de caja menor</option>
                          <option value="servicios_publicos">Servicios públicos</option>
                          <option value="nota_credito">Nota crédito (resta)</option>
                          <option value="nota_debito">Nota débito</option>
                          <option value="nomina_honorarios">Nómina / prestaciones</option>
                          <option value="otro">Otro documento</option>
                        </select>
                      </div>
                      <div>
                        <label className={etiqueta} htmlFor="reg-prefijo">Prefijo</label>
                        <input id="reg-prefijo" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} className={input} placeholder="FE, SETT, DS" />
                      </div>
                      <div>
                        <label className={etiqueta} htmlFor="reg-cufe">CUFE (factura electrónica)</label>
                        <input id="reg-cufe" value={cufe} onChange={(e) => setCufe(e.target.value)} className={input + ' font-mono'} placeholder="Opcional" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={etiqueta} htmlFor="reg-tel">Teléfono proveedor</label>
                        <input id="reg-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={input} />
                      </div>
                      <div>
                        <label className={etiqueta} htmlFor="reg-email">Correo proveedor</label>
                        <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                      </div>
                      <div>
                        <label className={etiqueta} htmlFor="reg-ciudad">Ciudad</label>
                        <input id="reg-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={input} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 3. Valores o productos */}
              <div className={seccion}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {titulo(
                    usaLineas ? (esMercancia && afecta ? `Productos que entran al inventario (${lineas.length})` : `Ítems de la factura (${lineas.length})`) : 'Valor de la factura',
                    usaLineas && esMercancia && afecta ? <Boxes className="w-4 h-4 text-emerald-600" /> : undefined
                  )}
                  {modo === 'detallada' && !(esMercancia && afecta) && (
                    <button type="button" onClick={() => setDesglose(!desglose)} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-400">
                      {desglose ? 'Ingresar solo subtotal e IVA' : 'Desglosar por ítems'}
                    </button>
                  )}
                </div>

                {usaLineas ? (
                  <div className="space-y-2">
                    <datalist id="productos-inventario">
                      {conceptos.map((c) => (
                        <option key={c.id} value={c.nombre}>
                          {[c.codigo, tipoDe(c) === 'gasto' ? 'Gasto' : tipoDe(c) === 'servicio' ? 'Servicio' : 'Producto'].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </datalist>
                    {lineas.map((l, i) => (
                      <div key={l.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={l.descripcion}
                            onChange={(e) => cambiarDescripcion(l.id, e.target.value)}
                            list="productos-inventario"
                            aria-label={`Producto ${i + 1}`}
                            placeholder="Producto (escriba o elija del catálogo)"
                            className={input + ' font-medium'}
                          />
                          {lineas.length > 1 && (
                            <button type="button" onClick={() => setLineas(lineas.filter((x) => x.id !== l.id))} className="p-1.5 text-rose-500 hover:text-rose-700" aria-label={`Quitar producto ${i + 1}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className={`grid grid-cols-2 gap-2 text-[11px] ${modo === 'detallada' ? 'sm:grid-cols-7' : 'sm:grid-cols-4'}`}>
                          {modo === 'detallada' && (
                            <div>
                              <label className="text-slate-500 block mb-0.5">Código</label>
                              <input value={l.codigo || ''} onChange={(e) => cambiarLinea(l.id, { codigo: e.target.value })} className={input} />
                            </div>
                          )}
                          <div>
                            <label className="text-slate-500 block mb-0.5">Cantidad</label>
                            <input type="number" min="0" step="any" value={l.cantidad} onChange={(e) => cambiarLinea(l.id, { cantidad: Number(e.target.value) })} className={input} aria-label={`Cantidad ${i + 1}`} />
                          </div>
                          {modo === 'detallada' && (
                            <div>
                              <label className="text-slate-500 block mb-0.5">Unidad</label>
                              <input value={l.unidad} onChange={(e) => cambiarLinea(l.id, { unidad: e.target.value })} className={input} />
                            </div>
                          )}
                          <div>
                            <label className="text-slate-500 block mb-0.5">Costo unit. sin IVA</label>
                            <input type="number" min="0" value={l.valorUnitario} onChange={(e) => cambiarLinea(l.id, { valorUnitario: Number(e.target.value) })} className={input} aria-label={`Costo ${i + 1}`} />
                          </div>
                          <div>
                            <label className="text-slate-500 block mb-0.5">IVA</label>
                            <select value={l.porcentajeIva} onChange={(e) => cambiarLinea(l.id, { porcentajeIva: Number(e.target.value) })} className={input}>
                              <option value={0}>0 %</option>
                              <option value={5}>5 %</option>
                              <option value={19}>19 %</option>
                            </select>
                          </div>
                          {modo === 'detallada' && esMercancia && afecta && (
                            <div>
                              <label className="text-slate-500 block mb-0.5">Precio venta sug.</label>
                              <input type="number" min="0" value={l.precioVentaSugerido || ''} onChange={(e) => cambiarLinea(l.id, { precioVentaSugerido: Number(e.target.value) || undefined })} className={input} />
                            </div>
                          )}
                          <div>
                            <label className="text-slate-500 block mb-0.5">Total</label>
                            <p className="font-bold py-2 text-xs text-slate-900 dark:text-white tabular-nums">{formatCOP(l.totalLinea)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" id="agregar-producto" onClick={() => setLineas([...lineas, lineaVacia()])} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold">
                      <Plus className="w-3.5 h-3.5" /> Agregar {esMercancia && afecta ? 'producto' : 'ítem'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={etiqueta} htmlFor="reg-subtotal">Subtotal (sin IVA) *</label>
                      <input id="reg-subtotal" type="number" min="0" value={subtotalRapido || ''} onChange={(e) => setSubtotalRapido(Number(e.target.value))} className={input + ' font-bold'} placeholder="0" />
                    </div>
                    <div>
                      <label className={etiqueta} htmlFor="reg-iva">IVA</label>
                      <input id="reg-iva" type="number" min="0" value={ivaRapido || ''} onChange={(e) => setIvaRapido(Number(e.target.value))} className={input + ' font-bold'} placeholder="0" />
                    </div>
                    <div>
                      <span className={etiqueta}>Total factura</span>
                      <p className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-black text-emerald-800 dark:text-emerald-200 tabular-nums">{formatCOP(totalGeneral)}</p>
                    </div>
                  </div>
                )}

                {modo === 'detallada' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label className={etiqueta} htmlFor="reg-retefuente">ReteFuente practicada</label>
                      <input id="reg-retefuente" type="number" min="0" value={reteFuente || ''} onChange={(e) => setReteFuente(Number(e.target.value))} className={input} placeholder="0" />
                    </div>
                    <div>
                      <label className={etiqueta} htmlFor="reg-reteiva">ReteIVA</label>
                      <input id="reg-reteiva" type="number" min="0" value={reteIva || ''} onChange={(e) => setReteIva(Number(e.target.value))} className={input} placeholder="0" />
                    </div>
                    <div>
                      <label className={etiqueta} htmlFor="reg-reteica">ReteICA</label>
                      <input id="reg-reteica" type="number" min="0" value={reteIca || ''} onChange={(e) => setReteIca(Number(e.target.value))} className={input} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Forma de pago */}
              {!esNota && (
                <div className={seccion}>
                  {titulo('Forma de pago', <Wallet className="w-4 h-4 text-teal-600" />)}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pago">
                    {FORMAS_PAGO.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        role="radio"
                        id={`forma-${f.id}`}
                        aria-checked={formaPago === f.id}
                        onClick={() => cambiarForma(f.id)}
                        className={`p-3 rounded-xl border-2 text-left ${formaPago === f.id ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        <span className="block text-xs font-bold text-slate-900 dark:text-white">{f.label}</span>
                        <span className="block text-[11px] text-slate-500">{f.ayuda}</span>
                      </button>
                    ))}
                  </div>

                  {formaPago !== 'credito' && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{formaPago === 'contado' ? 'Cómo se pagó (puede combinar medios)' : 'Abono que se paga hoy'}</p>
                      {pagosEfectivos.map((p, i) => (
                        <div key={p.id} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-12 sm:col-span-5">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Medio</label>
                            <select
                              value={p.medio}
                              onChange={(e) => (formaPago === 'contado' && !pagosTocados ? setMedioContado(e.target.value) : editarPago(p.id, { medio: e.target.value }))}
                              className={input}
                              aria-label={`Medio de pago ${i + 1}`}
                            >
                              {MEDIOS_PAGO_COMPRA.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Valor</label>
                            <input type="number" min="0" value={p.monto || ''} onChange={(e) => editarPago(p.id, { monto: Number(e.target.value) })} className={input + ' font-bold'} aria-label={`Valor pago ${i + 1}`} />
                          </div>
                          <div className="col-span-5 sm:col-span-3">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Fecha</label>
                            <input type="date" value={p.fecha} onChange={(e) => editarPago(p.id, { fecha: e.target.value })} className={input} />
                          </div>
                          <div className="col-span-1">
                            {(pagosEfectivos.length > 1 || formaPago === 'credito_contado') && pagosTocados && (
                              <button type="button" onClick={() => quitarPago(p.id)} className="p-2 text-rose-500" aria-label={`Quitar pago ${i + 1}`}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button type="button" id="agregar-pago" onClick={agregarPago} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <Plus className="w-3.5 h-3.5" /> Agregar otro medio de pago
                      </button>
                    </div>
                  )}

                  {formaPago !== 'contado' && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className={etiqueta} htmlFor="reg-vence">{formaPago === 'credito' ? 'Vence el' : 'El saldo vence el'}</label>
                        <input id="reg-vence" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={input} />
                      </div>
                      {[15, 30, 45, 60].map((d) => (
                        <button key={d} type="button" onClick={() => setFechaVencimiento(sumarDias(fechaEmision, d))} className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold">
                          {d} días
                        </button>
                      ))}
                    </div>
                  )}

                  {formaPago === 'credito' && !!doc0?.pagos?.filter((p) => !esPagoDelRegistro(p)).length && (
                    <p className="text-[11px] text-slate-500">
                      Se conservan {doc0.pagos.filter((p) => !esPagoDelRegistro(p)).length} abono(s) registrados después en Cuentas por pagar.
                    </p>
                  )}
                  {doc0 && formaPago !== formaInicial && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400" role="status">
                      Cambia de {FORMAS_PAGO.find((f) => f.id === formaInicial)?.label} a {FORMAS_PAGO.find((f) => f.id === formaPago)?.label}: al guardar, el saldo y el estado de la
                      factura se recalculan.
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="block text-[10px] text-slate-500">Valor a pagar{totalRetenciones > 0 ? ' (neto)' : ''}</span>
                      <span className="font-bold tabular-nums">{formatCOP(neto)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="block text-[10px] text-slate-500">Pagado</span>
                      <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCOP(resultadoPagos.pagado)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="block text-[10px] text-slate-500">Saldo por pagar</span>
                      <span className={`font-bold tabular-nums ${resultadoPagos.saldo > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{formatCOP(resultadoPagos.saldo)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="block text-[10px] text-slate-500">Quedará</span>
                      <span className="font-bold">{resultadoPagos.estado === 'pagada' ? 'Pagada' : resultadoPagos.estado === 'parcial' ? 'Con saldo' : 'Por pagar'}</span>
                    </div>
                  </div>
                  {resultadoPagos.error && <p className="text-xs font-semibold text-rose-600" role="alert">{resultadoPagos.error}</p>}
                </div>
              )}

              {/* 5. Soporte y observaciones (detallada) */}
              {modo === 'detallada' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className={etiqueta}>Foto o PDF del soporte</span>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer">
                      <Paperclip className="w-4 h-4 text-slate-500" />
                      <span>{archivoAdjunto ? `✓ ${archivoAdjunto.nombre}` : 'Seleccionar archivo'}</span>
                      <input type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={adjuntar} />
                    </label>
                  </div>
                  <div>
                    <label className={etiqueta} htmlFor="reg-obs">Observaciones</label>
                    <input id="reg-obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={input} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Totales y guardar */}
          <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-3 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-black text-lg text-slate-900 dark:text-white tabular-nums">{formatCOP(totalGeneral)}</span>
              <span className="ml-2">Subtotal {formatCOP(totalSubtotal)} · IVA {formatCOP(totalIva)}{totalRetenciones > 0 ? ` · Retenciones ${formatCOP(totalRetenciones)}` : ''}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onCerrar} className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                Cancelar
              </button>
              <button type="submit" id="guardar-compra" disabled={guardando || !preguntasListas} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" />
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
