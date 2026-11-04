/**
 * Nombre del dato adicional de cada venta. Cada empresa lo define en Configuración
 * (p. ej. Mascota en una veterinaria, Placa en un taller, Paciente en un consultorio).
 */
let referencia = 'Referencia';

export function fijarEtiquetaReferencia(texto?: string) {
  referencia = (texto || '').trim() || 'Referencia';
}

export const etiquetaReferencia = () => referencia;
