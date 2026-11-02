/**
 * Alerta semanal obligatoria: cada 7 días el sistema bloquea la pantalla con un
 * aviso rojo para hacer la copia de seguridad y subirla a la nube (Drive). Solo
 * se quita al darle "Aceptar"; la aceptación queda registrada en el equipo.
 */
export const DIAS_ALERTA_COPIA = 7;

export interface EstadoAlertaCopia {
  pendiente: boolean;
  ultimaAceptacion: string | null;
  /** Última copia de seguridad hecha por el usuario (descargada o copiada a otra carpeta) */
  ultimaCopia: string | null;
  diasSinCopia: number | null;
}

/** ¿Toca mostrar la alerta? Nunca aceptada o aceptada hace 7 días o más. */
export function alertaCopiaPendiente(ultimaAceptacion: string | null | undefined, ahora: Date = new Date()): boolean {
  if (!ultimaAceptacion) return true;
  const t = new Date(ultimaAceptacion).getTime();
  if (Number.isNaN(t)) return true;
  return ahora.getTime() - t >= DIAS_ALERTA_COPIA * 86400000;
}

export function estadoAlertaCopia(
  ultimaAceptacion: string | null | undefined,
  ultimaCopia: { fecha: string } | null | undefined,
  ahora: Date = new Date()
): EstadoAlertaCopia {
  const fechaCopia = ultimaCopia?.fecha || null;
  return {
    pendiente: alertaCopiaPendiente(ultimaAceptacion, ahora),
    ultimaAceptacion: ultimaAceptacion || null,
    ultimaCopia: fechaCopia,
    diasSinCopia: fechaCopia ? Math.floor((ahora.getTime() - new Date(fechaCopia).getTime()) / 86400000) : null,
  };
}
