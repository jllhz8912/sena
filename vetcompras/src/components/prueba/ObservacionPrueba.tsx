import React, { useState } from 'react';
import { MessageSquarePlus, X, Bug, Lightbulb, HelpCircle } from 'lucide-react';
import { dataService, Observacion } from '../../services/dataService';
import { useToast } from '../../context/ToastContext';

const TIPOS: { id: Observacion['tipo']; label: string; icono: React.ElementType }[] = [
  { id: 'error', label: 'Algo falla', icono: Bug },
  { id: 'mejora', label: 'Sugerencia', icono: Lightbulb },
  { id: 'duda', label: 'No entiendo', icono: HelpCircle },
];

/** Botón y formulario para que los probadores dejen observaciones (solo en la etapa de prueba). */
export const BotonObservacion: React.FC<{ modulo: string }> = ({ modulo }) => {
  const { mostrarToast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<Observacion['tipo']>('error');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Sin usuarios no se sabe quién prueba: se pide el nombre y se recuerda en este equipo
  const accesoLibre = dataService.modoAcceso() === 'libre';
  const [nombre, setNombre] = useState(() => {
    try {
      return localStorage.getItem('vetcompras_probador') || '';
    } catch {
      return '';
    }
  });

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (descripcion.trim().length < 5) {
      mostrarToast('warning', 'Describa la observación', 'Cuéntenos qué pasó o qué cambiaría.');
      return;
    }
    setGuardando(true);
    try {
      await dataService.guardarObservacion({
        id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fecha: new Date().toISOString(),
        usuario: (accesoLibre ? nombre.trim() : dataService.usuarioActual()?.nombre) || 'Probador',
        modulo,
        tipo,
        descripcion: descripcion.trim(),
        estado: 'nueva',
      });
      try {
        if (accesoLibre) localStorage.setItem('vetcompras_probador', nombre.trim());
      } catch {
        /* sin almacenamiento local: se vuelve a pedir */
      }
      mostrarToast('success', '¡Gracias!', 'Su observación quedó registrada.');
      setDescripcion('');
      setAbierto(false);
    } catch (err: any) {
      mostrarToast('error', 'No se guardó', err?.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
        title="Reportar un error, una sugerencia o una duda sobre esta pantalla"
      >
        <MessageSquarePlus className="w-4 h-4" /> <span className="hidden sm:inline">Observación</span>
      </button>
      {abierto && (
        <div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={enviar} className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Observación de prueba</h3>
              <button type="button" onClick={() => setAbierto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Pantalla: <strong>{modulo}</strong>
            </p>
            {accesoLibre && (
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Su nombre (opcional)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            )}
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(({ id, label, icono: Icono }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setTipo(id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold ${
                    tipo === id ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Icono className="w-5 h-5" /> {label}
                </button>
              ))}
            </div>
            <textarea
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={
                tipo === 'error'
                  ? '¿Qué estaba haciendo y qué pasó? Ej.: al guardar la venta con dos formas de pago salió un error…'
                  : tipo === 'mejora'
                    ? '¿Qué cambiaría o agregaría?'
                    : '¿Qué no quedó claro?'
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              autoFocus
            />
            <button disabled={guardando} className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-60">
              Enviar observación
            </button>
          </form>
        </div>
      )}
    </>
  );
};
