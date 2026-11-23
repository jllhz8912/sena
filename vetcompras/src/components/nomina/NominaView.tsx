import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Calculator, ChevronDown, ChevronUp, FileText, Loader2, Pencil, Plus, Upload, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';
import { formatCOP, formatFecha } from '../../utils/formatters';
import {
  MEDIOS_PAGO_NOMINA, MOTIVOS_RETIRO, NOMBRE_TIPO_PAGO, NOVEDADES_VACIAS, PARAMETROS_2026, TARIFAS_ARL,
  basePrestaciones, dias360, inicioSemestre, liquidacionFinal, liquidarCesantias, liquidarIntereses, liquidarPago, liquidarPrima, liquidarVacaciones,
  parametrosParaFecha, periodoDe, type Concepto, type Empleado, type MotivoRetiro, type Novedades, type PagoNomina, type ParametrosNomina, type TipoPagoNomina,
} from '../../utils/nomina';
import { reducirImagen } from '../movil/fotos';
import { ModalComprobanteNomina } from './ModalComprobanteNomina';

const nuevoId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const n = (v: string | number) => Math.round(Number(String(v).replace(/[^\d.-]/g, '')) || 0);
const claseCampo = 'px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const claseInput = 'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const claseTarjeta = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800';
const etiqueta = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1';

type Pestana = 'empleados' | 'liquidar' | 'prestaciones' | 'final' | 'comprobantes';

const CLAVE_PARAMETROS = 'sc-nomina-parametros';
function parametrosGuardados(): Partial<ParametrosNomina> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PARAMETROS) || '{}');
  } catch {
    return {};
  }
}

/** Lista editable de conceptos (devengados o deducciones): todo valor se puede corregir. */
const EditorConceptos: React.FC<{ titulo: string; lista: Concepto[]; onCambiar: (l: Concepto[]) => void; color: string; idBase: string }> = ({ titulo, lista, onCambiar, color, idBase }) => {
  const total = lista.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>{titulo}</p>
        <button onClick={() => onCambiar([...lista, { concepto: 'Otro concepto', valor: 0 }])} className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>
      {lista.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input id={`${idBase}-concepto-${i}`} value={c.concepto} onChange={(e) => onCambiar(lista.map((x, k) => (k === i ? { ...x, concepto: e.target.value } : x)))} className={claseCampo + ' flex-1 min-w-0'} />
          <input id={`${idBase}-valor-${i}`} inputMode="numeric" value={c.valor} onChange={(e) => onCambiar(lista.map((x, k) => (k === i ? { ...x, valor: n(e.target.value) } : x)))} className={claseCampo + ' w-28 shrink-0 text-right tabular-nums'} />
          <button onClick={() => onCambiar(lista.filter((_, k) => k !== i))} className="p-1.5 text-slate-400 hover:text-rose-600" title="Quitar concepto">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100 dark:border-slate-800 tabular-nums">
        <span>Total</span>
        <span>{formatCOP(total)}</span>
      </div>
    </div>
  );
};

/** Formulario de pago: medio, referencia, soporte y observaciones; guarda el comprobante. */
const DatosPago: React.FC<{
  onGuardar: (d: Pick<PagoNomina, 'fechaPago' | 'medioPago' | 'referenciaPago' | 'soporte' | 'observaciones'>) => Promise<void>;
  guardando: boolean;
  textoBoton: string;
}> = ({ onGuardar, guardando, textoBoton }) => {
  const { mostrarToast } = useToast();
  const [fechaPago, setFechaPago] = useState(hoy());
  const [medioPago, setMedioPago] = useState<PagoNomina['medioPago']>('consignacion');
  const [referenciaPago, setReferencia] = useState('');
  const [soporte, setSoporte] = useState('');
  const [observaciones, setObservaciones] = useState('');
  return (
    <div className="space-y-2.5">
      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <label className={etiqueta} htmlFor="pago-fecha">Fecha de pago</label>
          <input id="pago-fecha" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className={etiqueta} htmlFor="pago-medio">Forma de pago</label>
          <select id="pago-medio" value={medioPago} onChange={(e) => setMedioPago(e.target.value as PagoNomina['medioPago'])} className={claseInput}>
            {MEDIOS_PAGO_NOMINA.map((m) => (
              <option key={m.id} value={m.id}>
                {m.texto}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={etiqueta} htmlFor="pago-referencia">Referencia / N.º consignación</label>
          <input id="pago-referencia" value={referenciaPago} onChange={(e) => setReferencia(e.target.value)} className={claseInput} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer">
          <Upload className="w-4 h-4" /> {soporte ? 'Cambiar soporte' : 'Adjuntar soporte (foto de la consignación)'}
          <input
            id="pago-soporte"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                setSoporte(await reducirImagen(f));
              } catch (err: any) {
                mostrarToast('error', 'Soporte', err?.message);
              }
            }}
          />
        </label>
        {soporte && <img src={soporte} alt="Soporte" className="h-12 rounded border" />}
        {soporte && (
          <button onClick={() => setSoporte('')} className="text-xs text-rose-600 font-semibold">
            Quitar
          </button>
        )}
      </div>
      <input id="pago-observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones (salen en el comprobante)" className={claseInput} />
      <button
        id="pago-guardar"
        disabled={guardando}
        onClick={() => onGuardar({ fechaPago, medioPago, referenciaPago: referenciaPago.trim() || undefined, soporte: soporte || undefined, observaciones: observaciones.trim() || undefined })}
        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {textoBoton}
      </button>
    </div>
  );
};

/** Ficha del empleado (crear o editar). */
const ModalEmpleado: React.FC<{ empleado?: Empleado; parametros: ParametrosNomina; onGuardado: () => void; onCerrar: () => void }> = ({ empleado, parametros, onGuardado, onCerrar }) => {
  const { mostrarToast } = useToast();
  const [e, setE] = useState<Empleado>(
    empleado || {
      id: nuevoId('emp'),
      nombre: '',
      documento: '',
      fechaIngreso: hoy(),
      tipoContrato: 'indefinido',
      salario: parametros.smmlv,
      periodicidad: 'quincenal',
      claseRiesgo: 1,
      activo: true,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    }
  );
  const poner = <K extends keyof Empleado>(k: K, v: Empleado[K]) => setE((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    if (!e.nombre.trim() || !e.documento.trim()) return mostrarToast('warning', 'Faltan datos', 'Escriba el nombre y la cédula.');
    if (!(e.salario > 0)) return mostrarToast('warning', 'Falta el salario', 'Escriba el salario mensual.');
    if (e.salario < parametros.smmlv && e.tipoContrato !== 'aprendiz') mostrarToast('warning', 'Salario por debajo del mínimo', `El mínimo de ${parametros.anio} es ${formatCOP(parametros.smmlv)}.`);
    await dataService.guardarEmpleado({ ...e, nombre: e.nombre.trim(), documento: e.documento.trim() });
    mostrarToast('success', 'Empleado guardado', e.nombre);
    onGuardado();
  };
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-2xl max-h-[94%] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{empleado ? 'Editar empleado' : 'Nuevo empleado'}</h3>
          <button onClick={onCerrar} className="p-1.5" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <div className="sm:col-span-2">
            <label className={etiqueta} htmlFor="emp-nombre">Nombre completo</label>
            <input id="emp-nombre" value={e.nombre} onChange={(x) => poner('nombre', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-documento">Cédula</label>
            <input id="emp-documento" inputMode="numeric" value={e.documento} onChange={(x) => poner('documento', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-cargo">Cargo</label>
            <input id="emp-cargo" value={e.cargo || ''} onChange={(x) => poner('cargo', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-salario">Salario mensual</label>
            <input id="emp-salario" inputMode="numeric" value={e.salario} onChange={(x) => poner('salario', n(x.target.value))} className={claseInput + ' text-right font-bold'} />
            <p className="text-[10px] text-slate-500 mt-0.5">Mínimo {parametros.anio}: {formatCOP(parametros.smmlv)} {e.salario <= 2 * parametros.smmlv && !e.integral ? '· recibe auxilio de transporte' : ''}</p>
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-periodicidad">Pago</label>
            <select id="emp-periodicidad" value={e.periodicidad} onChange={(x) => poner('periodicidad', x.target.value as Empleado['periodicidad'])} className={claseInput}>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-ingreso">Fecha de ingreso</label>
            <input id="emp-ingreso" type="date" value={e.fechaIngreso} onChange={(x) => poner('fechaIngreso', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-contrato">Contrato</label>
            <select id="emp-contrato" value={e.tipoContrato} onChange={(x) => poner('tipoContrato', x.target.value as Empleado['tipoContrato'])} className={claseInput}>
              <option value="indefinido">Término indefinido</option>
              <option value="fijo">Término fijo</option>
              <option value="obra">Obra o labor</option>
              <option value="aprendiz">Aprendizaje (SENA)</option>
            </select>
          </div>
          {(e.tipoContrato === 'fijo' || e.tipoContrato === 'obra') && (
            <div>
              <label className={etiqueta} htmlFor="emp-fin">Fecha de terminación pactada</label>
              <input id="emp-fin" type="date" value={e.fechaFinContrato || ''} onChange={(x) => poner('fechaFinContrato', x.target.value)} className={claseInput} />
            </div>
          )}
          <div>
            <label className={etiqueta} htmlFor="emp-riesgo">Riesgo ARL</label>
            <select id="emp-riesgo" value={e.claseRiesgo} onChange={(x) => poner('claseRiesgo', Number(x.target.value))} className={claseInput}>
              {TARIFAS_ARL.map((t) => (
                <option key={t.clase} value={t.clase}>
                  {t.texto} · {t.tarifa} %
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-email">Correo</label>
            <input id="emp-email" type="email" value={e.email || ''} onChange={(x) => poner('email', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-telefono">Celular / WhatsApp</label>
            <input id="emp-telefono" inputMode="tel" value={e.telefono || ''} onChange={(x) => poner('telefono', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-eps">EPS</label>
            <input id="emp-eps" value={e.eps || ''} onChange={(x) => poner('eps', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-pension">Fondo de pensión</label>
            <input id="emp-pension" value={e.fondoPension || ''} onChange={(x) => poner('fondoPension', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-cesantias">Fondo de cesantías</label>
            <input id="emp-cesantias" value={e.fondoCesantias || ''} onChange={(x) => poner('fondoCesantias', x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="emp-cuenta">Banco y cuenta</label>
            <input id="emp-cuenta" value={e.cuenta || ''} onChange={(x) => poner('cuenta', x.target.value)} placeholder="Ej. Bancolombia ahorros 123…" className={claseInput} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!e.dependientes} onChange={(x) => poner('dependientes', x.target.checked)} /> Tiene dependientes (retención)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!e.integral} onChange={(x) => poner('integral', x.target.checked)} /> Salario integral
          </label>
        </div>
        <button id="emp-guardar" onClick={guardar} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold">
          Guardar empleado
        </button>
      </div>
    </div>
  );
};

/**
 * Nómina: empleados, liquidación quincenal o mensual con todo lo de ley,
 * prestaciones (prima, cesantías, intereses, vacaciones), liquidación final y
 * comprobantes de pago. Todo valor calculado se puede editar antes de guardar.
 */
export const NominaView: React.FC = () => {
  const { mostrarToast } = useToast();
  const [pestana, setPestana] = useState<Pestana>('empleados');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [pagos, setPagos] = useState<PagoNomina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ajustes, setAjustes] = useState<Partial<ParametrosNomina>>(parametrosGuardados());
  const [verParametros, setVerParametros] = useState(false);
  const [editando, setEditando] = useState<Empleado | 'nuevo' | null>(null);
  const [comprobante, setComprobante] = useState<PagoNomina | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    Promise.all([dataService.obtenerEmpleados(), dataService.obtenerPagosNomina()])
      .then(([e, p]) => (setEmpleados(e), setPagos(p)))
      .catch((err) => mostrarToast('error', 'Nómina', err?.message))
      .finally(() => setCargando(false));
  }, [mostrarToast]);
  useEffect(cargar, [cargar]);

  const parametros = (fecha: string): ParametrosNomina => ({ ...parametrosParaFecha(fecha, PARAMETROS_2026), ...ajustes });
  const pHoy = parametros(hoy());
  const guardarAjustes = (a: Partial<ParametrosNomina>) => {
    setAjustes(a);
    try {
      localStorage.setItem(CLAVE_PARAMETROS, JSON.stringify(a));
    } catch {
      /* se usa en esta sesión */
    }
  };
  const activos = empleados.filter((e) => e.activo);
  const empleadoDe = (id: string) => empleados.find((e) => e.id === id);

  /** Guarda un comprobante y lo abre. */
  const registrarPago = async (base: Omit<PagoNomina, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn' | 'totalDevengado' | 'totalDeducciones' | 'neto'>) => {
    setGuardando(true);
    try {
      const totalDevengado = base.devengados.reduce((s, c) => s + c.valor, 0);
      const totalDeducciones = base.deducciones.reduce((s, c) => s + c.valor, 0);
      const ahora = new Date().toISOString();
      const pago: PagoNomina = { ...base, id: nuevoId('nom'), numero: await dataService.siguienteNumeroNomina(), totalDevengado, totalDeducciones, neto: totalDevengado - totalDeducciones, creadoEn: ahora, actualizadoEn: ahora };
      await dataService.guardarPagoNomina(pago);
      mostrarToast('success', `Comprobante ${pago.numero} guardado`, `${pago.empleadoNombre}: ${formatCOP(pago.neto)}`);
      setComprobante(pago);
      cargar();
      return pago;
    } catch (err: any) {
      mostrarToast('error', 'No se guardó', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  const pestanas: { id: Pestana; texto: string }[] = [
    { id: 'empleados', texto: `Empleados (${activos.length})` },
    { id: 'liquidar', texto: 'Liquidar nómina' },
    { id: 'prestaciones', texto: 'Prima, cesantías y vacaciones' },
    { id: 'final', texto: 'Liquidación final' },
    { id: 'comprobantes', texto: `Comprobantes (${pagos.length})` },
  ];

  if (cargando) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${claseTarjeta} p-4 sm:p-5 space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Users className="w-5 h-5 text-blue-600" /> Nómina y empleados
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Ponga el salario y el sistema calcula el pago con todo lo de ley ({pHoy.anio}): auxilio de transporte, salud y pensión, fondo de solidaridad, retención, horas extra y
              recargos. Todo valor se puede corregir antes de guardar. Genera el comprobante para firma o para enviar.
            </p>
          </div>
          <button id="nomina-nuevo-empleado" onClick={() => setEditando('nuevo')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">
            <UserPlus className="w-4 h-4" /> Nuevo empleado
          </button>
        </div>
        <button onClick={() => setVerParametros(!verParametros)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {verParametros ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Valores de ley {pHoy.anio}: mínimo {formatCOP(pHoy.smmlv)} · auxilio {formatCOP(pHoy.auxilioTransporte)} · UVT{' '}
          {formatCOP(pHoy.uvt)} · jornada {pHoy.horasSemana} h · dominical {pHoy.recargoDominical} %
        </button>
        {verParametros && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            {(
              [
                ['smmlv', 'Salario mínimo'],
                ['auxilioTransporte', 'Auxilio de transporte'],
                ['uvt', 'UVT'],
                ['horasSemana', 'Horas por semana'],
                ['recargoDominical', 'Recargo dominical %'],
              ] as const
            ).map(([k, t]) => (
              <div key={k}>
                <label className={etiqueta}>{t}</label>
                <input inputMode="numeric" value={(ajustes as any)[k] ?? pHoy[k]} onChange={(e) => guardarAjustes({ ...ajustes, [k]: n(e.target.value) })} className={claseInput + ' text-right'} />
              </div>
            ))}
            <label className="flex items-center gap-2 text-xs col-span-2">
              <input type="checkbox" checked={ajustes.exoneradoParafiscales ?? pHoy.exoneradoParafiscales} onChange={(e) => guardarAjustes({ ...ajustes, exoneradoParafiscales: e.target.checked })} />
              Exonerado de salud 8,5 %, SENA e ICBF (art. 114-1 E.T.)
            </label>
            <button onClick={() => guardarAjustes({})} className="text-xs font-semibold text-blue-600 text-left">
              Volver a los valores de ley
            </button>
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {pestanas.map((t) => (
            <button
              key={t.id}
              id={`nomina-pestana-${t.id}`}
              onClick={() => setPestana(t.id)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold ${pestana === t.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
            >
              {t.texto}
            </button>
          ))}
        </div>
      </div>

      {pestana === 'empleados' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {empleados.map((e) => (
            <div key={e.id} className={`${claseTarjeta} p-4 space-y-1.5 ${e.activo ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold truncate">{e.nombre}</p>
                  <p className="text-xs text-slate-500">C.C. {e.documento}{e.cargo ? ` · ${e.cargo}` : ''}</p>
                </div>
                <button onClick={() => setEditando(e)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar empleado">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <p className="text-lg font-black tabular-nums">{formatCOP(e.salario)}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {e.periodicidad === 'quincenal' ? 'Pago quincenal' : 'Pago mensual'} · {e.tipoContrato === 'indefinido' ? 'Indefinido' : e.tipoContrato === 'fijo' ? 'Término fijo' : e.tipoContrato === 'obra' ? 'Obra o labor' : 'Aprendiz'} · desde {formatFecha(e.fechaIngreso)}
              </p>
              {!e.activo && <p className="text-xs font-semibold text-rose-600">Retirado el {e.fechaRetiro ? formatFecha(e.fechaRetiro) : '—'}</p>}
            </div>
          ))}
          {!empleados.length && (
            <div className={`${claseTarjeta} p-8 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3`}>
              <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              Aún no hay empleados. Pulse <strong>Nuevo empleado</strong> y escriba su salario: el sistema hace el resto.
            </div>
          )}
        </div>
      )}

      {pestana === 'liquidar' && <LiquidarNomina empleados={activos} pagos={pagos} parametros={parametros} guardando={guardando} onRegistrar={registrarPago} />}
      {pestana === 'prestaciones' && <Prestaciones empleados={activos} parametros={parametros} guardando={guardando} onRegistrar={registrarPago} />}
      {pestana === 'final' && (
        <LiquidacionFinalVista
          empleados={activos}
          parametros={parametros}
          guardando={guardando}
          onRegistrar={async (pago, e, fecha) => {
            const r = await registrarPago(pago);
            if (r) {
              await dataService.guardarEmpleado({ ...e, activo: false, fechaRetiro: fecha });
              cargar();
            }
          }}
        />
      )}
      {pestana === 'comprobantes' && (
        <div className={`${claseTarjeta} divide-y divide-slate-100 dark:divide-slate-800`}>
          {pagos.map((p) => (
            <button key={p.id} onClick={() => setComprobante(p)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {p.numero} · {p.empleadoNombre}
                </p>
                <p className="text-xs text-slate-500">
                  {NOMBRE_TIPO_PAGO[p.tipo]} · {formatFecha(p.periodoDesde)} a {formatFecha(p.periodoHasta)} · pagado {formatFecha(p.fechaPago)}
                </p>
              </div>
              <span className="font-black tabular-nums">{formatCOP(p.neto)}</span>
            </button>
          ))}
          {!pagos.length && <p className="p-8 text-center text-sm text-slate-500">Todavía no hay comprobantes.</p>}
        </div>
      )}

      {editando && (
        <ModalEmpleado
          empleado={editando === 'nuevo' ? undefined : editando}
          parametros={pHoy}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
      {comprobante && (
        <ModalComprobanteNomina
          pago={comprobante}
          empresa={dataService.obtenerDatosEmpresa()}
          email={empleadoDe(comprobante.empleadoId)?.email}
          telefono={empleadoDe(comprobante.empleadoId)?.telefono}
          onCerrar={() => setComprobante(null)}
          onEliminar={async () => {
            await dataService.eliminarPagoNomina(comprobante.id);
            mostrarToast('info', 'Comprobante anulado', comprobante.numero);
            setComprobante(null);
            cargar();
          }}
        />
      )}
    </div>
  );
};

type Registrar = (base: Omit<PagoNomina, 'id' | 'numero' | 'creadoEn' | 'actualizadoEn' | 'totalDevengado' | 'totalDeducciones' | 'neto'>) => Promise<PagoNomina | undefined>;

const SelectorEmpleado: React.FC<{ empleados: Empleado[]; valor: string; onCambiar: (id: string) => void }> = ({ empleados, valor, onCambiar }) => (
  <select id="nomina-empleado" value={valor} onChange={(e) => onCambiar(e.target.value)} className={claseInput}>
    <option value="">— Escoja el empleado —</option>
    {empleados.map((e) => (
      <option key={e.id} value={e.id}>
        {e.nombre} · {formatCOP(e.salario)}
      </option>
    ))}
  </select>
);

/** Liquidar la quincena o el mes de un empleado, con novedades y valores editables. */
const LiquidarNomina: React.FC<{ empleados: Empleado[]; pagos: PagoNomina[]; parametros: (f: string) => ParametrosNomina; guardando: boolean; onRegistrar: Registrar }> = ({
  empleados,
  pagos,
  parametros,
  guardando,
  onRegistrar,
}) => {
  const [fecha, setFecha] = useState(hoy());
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || '');
  const e = empleados.find((x) => x.id === empleadoId);
  const periodo = e ? periodoDe(fecha, e.periodicidad) : null;
  const [nov, setNov] = useState<Novedades>(NOVEDADES_VACIAS(15));
  const [devengados, setDevengados] = useState<Concepto[]>([]);
  const [deducciones, setDeducciones] = useState<Concepto[]>([]);
  const p = parametros(fecha);
  const resultado = useMemo(() => (e ? liquidarPago(e, nov, p) : null), [e, nov, JSON.stringify(p)]);

  // Al cambiar empleado o periodo se reinician las novedades
  useEffect(() => {
    if (periodo) setNov(NOVEDADES_VACIAS(periodo.dias));
  }, [empleadoId, periodo?.desde]);
  // Lo calculado llena las listas editables
  useEffect(() => {
    if (resultado) {
      setDevengados(resultado.devengados);
      setDeducciones(resultado.deducciones);
    }
  }, [resultado]);

  const yaPagado = e && periodo && pagos.find((x) => x.empleadoId === e.id && x.tipo === 'nomina' && x.periodoDesde === periodo.desde);
  const campo = (k: keyof Novedades, t: string) => (
    <div key={k}>
      <label className={etiqueta + ' truncate'} htmlFor={`nov-${k}`} title={t}>{t}</label>
      <input id={`nov-${k}`} inputMode="numeric" value={(nov as any)[k] || ''} onChange={(x) => setNov({ ...nov, [k]: Number(String(x.target.value).replace(',', '.')) || 0 })} className={claseInput + ' text-right'} placeholder="0" />
    </div>
  );
  const totalDev = devengados.reduce((s, c) => s + c.valor, 0);
  const totalDed = deducciones.reduce((s, c) => s + c.valor, 0);

  if (!empleados.length) return <p className={`${claseTarjeta} p-8 text-center text-sm text-slate-500`}>Primero cree sus empleados en la pestaña Empleados.</p>;
  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4 [&>*]:min-w-0">
      <div className={`${claseTarjeta} p-4 space-y-3`}>
        <div className="grid sm:grid-cols-2 gap-2 [&>*]:min-w-0">
          <div>
            <label className={etiqueta}>Empleado</label>
            <SelectorEmpleado empleados={empleados} valor={empleadoId} onCambiar={setEmpleadoId} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="nomina-fecha">Fecha dentro del periodo</label>
            <input id="nomina-fecha" type="date" value={fecha} onChange={(x) => setFecha(x.target.value)} className={claseInput} />
          </div>
        </div>
        {e && periodo && (
          <p className="text-sm font-semibold">
            {e.periodicidad === 'quincenal' ? 'Quincena' : 'Mes'} del {formatFecha(periodo.desde)} al {formatFecha(periodo.hasta)}
            {yaPagado && <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">Ya pagado ({yaPagado.numero})</span>}
          </p>
        )}
        <p className="text-xs font-bold uppercase text-slate-500 pt-1">Novedades del periodo</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 [&>*]:min-w-0">
          {campo('dias', 'Días trabajados')}
          {campo('horasExtraDiurnas', 'H. extra diurnas (+25 %)')}
          {campo('horasExtraNocturnas', 'H. extra nocturnas (+75 %)')}
          {campo('horasRecargoNocturno', 'H. nocturnas 7 p. m.–6 a. m. (+35 %)')}
          {campo('horasDominicales', `H. dominicales y festivas (+${p.recargoDominical} %)`)}
          {campo('horasExtraDominicalesDiurnas', 'H. extra dominicales diurnas')}
          {campo('comisiones', 'Comisiones')}
          {campo('bonificacionesNoSalariales', 'Bonificación no salarial')}
          {campo('otrosDescuentos', 'Préstamos y otros descuentos')}
        </div>
        {resultado && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs space-y-1">
            <p className="font-bold text-slate-700 dark:text-slate-200">Lo que paga el empleador además (informativo)</p>
            {[...resultado.aportesEmpleador, ...resultado.provisiones].map((a) => (
              <div key={a.concepto} className="flex justify-between tabular-nums">
                <span>{a.concepto}</span>
                <span>{formatCOP(a.valor)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-1 border-t border-slate-200 dark:border-slate-700 tabular-nums">
              <span>Costo total del periodo</span>
              <span>{formatCOP(resultado.costoTotalEmpleador)}</span>
            </div>
          </div>
        )}
      </div>
      <div className={`${claseTarjeta} p-4 space-y-4`}>
        <EditorConceptos titulo="Devengados" lista={devengados} onCambiar={setDevengados} color="text-green-700" idBase="dev" />
        <EditorConceptos titulo="Deducciones" lista={deducciones} onCambiar={setDeducciones} color="text-rose-600" idBase="ded" />
        <div className="flex items-center justify-between rounded-xl bg-blue-600 text-white px-4 py-3">
          <span className="font-bold">Neto a pagar</span>
          <span id="nomina-neto" className="text-2xl font-black tabular-nums">{formatCOP(totalDev - totalDed)}</span>
        </div>
        {e && periodo && (
          <DatosPago
            guardando={guardando}
            textoBoton="Guardar y generar comprobante"
            onGuardar={async (d) => {
              await onRegistrar({ ...d, tipo: 'nomina', empleadoId: e.id, empleadoNombre: e.nombre, empleadoDocumento: e.documento, cargo: e.cargo, periodoDesde: periodo.desde, periodoHasta: periodo.hasta, devengados, deducciones });
            }}
          />
        )}
      </div>
    </div>
  );
};

/** Prima, cesantías e intereses, y vacaciones de un empleado. */
const Prestaciones: React.FC<{ empleados: Empleado[]; parametros: (f: string) => ParametrosNomina; guardando: boolean; onRegistrar: Registrar }> = ({ empleados, parametros, guardando, onRegistrar }) => {
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || '');
  const [tipo, setTipo] = useState<'prima' | 'cesantias' | 'vacaciones'>('prima');
  const e = empleados.find((x) => x.id === empleadoId);
  const corte = hoy();
  const [desde, setDesde] = useState(inicioSemestre(corte));
  const [hasta, setHasta] = useState(corte.slice(5, 7) <= '06' ? `${corte.slice(0, 4)}-06-30` : `${corte.slice(0, 4)}-12-31`);
  const [diasDisfrutar, setDiasDisfrutar] = useState(15);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [formula, setFormula] = useState('');

  useEffect(() => {
    const y = corte.slice(0, 4);
    if (tipo === 'prima') {
      setDesde(inicioSemestre(corte));
      setHasta(corte.slice(5, 7) <= '06' ? `${y}-06-30` : `${y}-12-31`);
    } else if (tipo === 'cesantias') {
      setDesde(`${Number(y) - 1}-01-01`);
      setHasta(`${Number(y) - 1}-12-31`);
    }
  }, [tipo]);

  useEffect(() => {
    if (!e) return setConceptos([]);
    const p = parametros(hasta);
    const inicio = [desde, e.fechaIngreso].sort().pop()!;
    const dias = dias360(inicio, hasta);
    const base = basePrestaciones(e, p);
    if (tipo === 'prima') {
      const r = liquidarPrima(base, dias);
      setConceptos([{ concepto: r.concepto, valor: r.valor, detalle: `${r.dias} días` }]);
      setFormula(`Base ${formatCOP(base)} (salario + auxilio) × ${dias} días / 360`);
    } else if (tipo === 'cesantias') {
      const c = liquidarCesantias(base, dias);
      const i = liquidarIntereses(c.valor, dias);
      setConceptos([
        { concepto: 'Cesantías', valor: c.valor, detalle: `${dias} días` },
        { concepto: 'Intereses de cesantías (12 %)', valor: i.valor },
      ]);
      setFormula(`Cesantías: ${formatCOP(base)} × ${dias} / 360 · Intereses: cesantías × ${dias} × 12 % / 360. Las cesantías se consignan al fondo antes del 14 de febrero; los intereses se pagan al trabajador antes del 31 de enero.`);
    } else {
      const v = liquidarVacaciones(e.salario, dias360(e.fechaIngreso, hoy()));
      const valor = Math.round((e.salario / 30) * diasDisfrutar);
      setConceptos([{ concepto: 'Vacaciones disfrutadas', valor, detalle: `${diasDisfrutar} días hábiles` }]);
      setFormula(`${formatCOP(e.salario)} / 30 × ${diasDisfrutar} días (15 días hábiles por cada año trabajado; sin auxilio de transporte). Causados a la fecha: ${v.dias.toLocaleString('es-CO')} días.`);
    }
  }, [e?.id, tipo, desde, hasta, diasDisfrutar]);

  if (!empleados.length) return <p className={`${claseTarjeta} p-8 text-center text-sm text-slate-500`}>Primero cree sus empleados.</p>;
  const tipoPago: TipoPagoNomina = tipo === 'prima' ? 'prima' : tipo === 'cesantias' ? 'cesantias' : 'vacaciones';
  return (
    <div className={`${claseTarjeta} p-4 space-y-3 max-w-3xl`}>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className={etiqueta}>Empleado</label>
          <SelectorEmpleado empleados={empleados} valor={empleadoId} onCambiar={setEmpleadoId} />
        </div>
        <div>
          <label className={etiqueta}>Qué liquidar</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['prima', 'Prima'],
                ['cesantias', 'Cesantías'],
                ['vacaciones', 'Vacaciones'],
              ] as const
            ).map(([id, t]) => (
              <button key={id} id={`prest-${id}`} onClick={() => setTipo(id)} className={`py-2 rounded-xl text-sm font-semibold ${tipo === id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {tipo !== 'vacaciones' ? (
          <>
            <div>
              <label className={etiqueta} htmlFor="prest-desde">Desde</label>
              <input id="prest-desde" type="date" value={desde} onChange={(x) => setDesde(x.target.value)} className={claseInput} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="prest-hasta">Hasta</label>
              <input id="prest-hasta" type="date" value={hasta} onChange={(x) => setHasta(x.target.value)} className={claseInput} />
            </div>
          </>
        ) : (
          <div>
            <label className={etiqueta} htmlFor="prest-dias">Días hábiles de vacaciones a pagar</label>
            <input id="prest-dias" inputMode="numeric" value={diasDisfrutar} onChange={(x) => setDiasDisfrutar(Number(x.target.value) || 0)} className={claseInput + ' text-right'} />
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 flex gap-1.5">
        <Calculator className="w-4 h-4 shrink-0" /> {formula}
      </p>
      <EditorConceptos titulo="Valores a pagar (editables)" lista={conceptos} onCambiar={setConceptos} color="text-green-700" idBase="prest" />
      {e && (
        <DatosPago
          guardando={guardando}
          textoBoton="Guardar y generar comprobante"
          onGuardar={async (d) => {
            await onRegistrar({ ...d, tipo: tipoPago, empleadoId: e.id, empleadoNombre: e.nombre, empleadoDocumento: e.documento, cargo: e.cargo, periodoDesde: tipo === 'vacaciones' ? d.fechaPago : desde, periodoHasta: tipo === 'vacaciones' ? d.fechaPago : hasta, devengados: conceptos, deducciones: [] });
          }}
        />
      )}
    </div>
  );
};

/** Liquidación final del contrato. */
const LiquidacionFinalVista: React.FC<{
  empleados: Empleado[];
  parametros: (f: string) => ParametrosNomina;
  guardando: boolean;
  onRegistrar: (base: Parameters<Registrar>[0], e: Empleado, fecha: string) => Promise<void>;
}> = ({ empleados, parametros, guardando, onRegistrar }) => {
  const [empleadoId, setEmpleadoId] = useState(empleados[0]?.id || '');
  const [fecha, setFecha] = useState(hoy());
  const [motivo, setMotivo] = useState<MotivoRetiro>('renuncia');
  const [diasSalario, setDiasSalario] = useState(0);
  const [diasVacDisfrutadas, setDiasVacDisfrutadas] = useState(0);
  const [cesantiasDesde, setCesantiasDesde] = useState('');
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [deducciones, setDeducciones] = useState<Concepto[]>([]);
  const [detalle, setDetalle] = useState<string[]>([]);
  const e = empleados.find((x) => x.id === empleadoId);

  useEffect(() => {
    if (!e) return;
    const l = liquidacionFinal(e, fecha, motivo, parametros(fecha), { diasSalarioPendiente: diasSalario, diasVacacionesDisfrutadas: diasVacDisfrutadas, cesantiasDesde: cesantiasDesde || undefined });
    setConceptos(l.conceptos.map((c) => ({ concepto: c.concepto, valor: c.valor, detalle: `${c.dias.toLocaleString('es-CO')} días` })));
    setDetalle([`Tiempo trabajado: ${l.diasTrabajados} días (${(l.diasTrabajados / 360).toFixed(2)} años)`, ...l.conceptos.map((c) => `${c.concepto}: ${c.formula}`)]);
    // Sobre el salario pendiente se descuentan salud y pensión
    const sal = l.conceptos.find((c) => c.concepto === 'Salario pendiente')?.valor || 0;
    setDeducciones(sal ? [{ concepto: 'Salud (4 %)', valor: Math.ceil((sal * 0.04) / 100) * 100 }, { concepto: 'Pensión (4 %)', valor: Math.ceil((sal * 0.04) / 100) * 100 }] : []);
  }, [e?.id, fecha, motivo, diasSalario, diasVacDisfrutadas, cesantiasDesde]);

  if (!empleados.length) return <p className={`${claseTarjeta} p-8 text-center text-sm text-slate-500`}>No hay empleados activos.</p>;
  const total = conceptos.reduce((s, c) => s + c.valor, 0) - deducciones.reduce((s, c) => s + c.valor, 0);
  return (
    <div className="grid lg:grid-cols-2 gap-4 [&>*]:min-w-0">
      <div className={`${claseTarjeta} p-4 space-y-2.5`}>
        <div>
          <label className={etiqueta}>Empleado</label>
          <SelectorEmpleado empleados={empleados} valor={empleadoId} onCambiar={setEmpleadoId} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={etiqueta} htmlFor="final-fecha">Fecha de retiro</label>
            <input id="final-fecha" type="date" value={fecha} onChange={(x) => setFecha(x.target.value)} className={claseInput} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="final-motivo">Motivo</label>
            <select id="final-motivo" value={motivo} onChange={(x) => setMotivo(x.target.value as MotivoRetiro)} className={claseInput}>
              {MOTIVOS_RETIRO.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.texto}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="final-dias-salario">Días de salario sin pagar</label>
            <input id="final-dias-salario" inputMode="numeric" value={diasSalario || ''} onChange={(x) => setDiasSalario(Number(x.target.value) || 0)} placeholder="0" className={claseInput + ' text-right'} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="final-vac">Días de vacaciones ya disfrutados</label>
            <input id="final-vac" inputMode="numeric" value={diasVacDisfrutadas || ''} onChange={(x) => setDiasVacDisfrutadas(Number(x.target.value) || 0)} placeholder="0" className={claseInput + ' text-right'} />
          </div>
          <div className="col-span-2">
            <label className={etiqueta} htmlFor="final-ces-desde">Cesantías pendientes desde (si no se consignaron las de años anteriores)</label>
            <input id="final-ces-desde" type="date" value={cesantiasDesde} onChange={(x) => setCesantiasDesde(x.target.value)} className={claseInput} />
          </div>
        </div>
        <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">
          {detalle.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      <div className={`${claseTarjeta} p-4 space-y-3`}>
        <EditorConceptos titulo="Conceptos de la liquidación" lista={conceptos} onCambiar={setConceptos} color="text-green-700" idBase="fin" />
        <EditorConceptos titulo="Descuentos" lista={deducciones} onCambiar={setDeducciones} color="text-rose-600" idBase="findesc" />
        <div className="flex items-center justify-between rounded-xl bg-blue-600 text-white px-4 py-3">
          <span className="font-bold">Total a pagar</span>
          <span id="final-total" className="text-2xl font-black tabular-nums">{formatCOP(total)}</span>
        </div>
        {e && (
          <DatosPago
            guardando={guardando}
            textoBoton="Guardar liquidación y retirar al empleado"
            onGuardar={async (d) => {
              await onRegistrar(
                { ...d, tipo: 'liquidacion', empleadoId: e.id, empleadoNombre: e.nombre, empleadoDocumento: e.documento, cargo: e.cargo, periodoDesde: e.fechaIngreso, periodoHasta: fecha, devengados: conceptos, deducciones },
                e,
                fecha
              );
            }}
          />
        )}
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <UserMinus className="w-3.5 h-3.5" /> Al guardar, el empleado queda como retirado y su comprobante en el historial.
        </p>
      </div>
    </div>
  );
};

