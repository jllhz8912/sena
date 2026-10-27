import { LOGO_MARCA } from './logoMarca';

/**
 * Identidad fija de la veterinaria. El logo viene con el programa: si en
 * Configuración no se carga otro, se usa este en la pantalla de inicio, el menú
 * y los recibos.
 */
export const MARCA = {
  nombre: 'Los Criollos Vet',
  razonSocial: 'LOS CRIOLLOS VET',
  slogan: 'Clínica veterinaria · Med. Rojas',
  logo: LOGO_MARCA,
  /** Morado del logo (botones, recibos) */
  colorPrimario: '#9330b3',
  /** Azul marino del borde del logo */
  colorSecundario: '#244568',
};

export const logoDe = (empresa?: { logoUrl?: string } | null): string => empresa?.logoUrl || MARCA.logo;
