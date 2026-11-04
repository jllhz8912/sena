import { COLOR_POR_DEFECTO } from '../utils/tema';

/**
 * Producto genérico: no trae logo ni nombre de ningún negocio. Cada cliente carga
 * en Configuración su razón social, logo y color; mientras no lo haga se usan estos
 * valores neutros.
 */
export const PRODUCTO = {
  nombre: 'Sistema de Control',
  nombreCompleto: 'Aplicativo Sistema de Control 2.0',
  version: '2.0',
  descripcion: 'Ventas, compras, gastos, inventario y reportes',
};

export const MARCA = {
  nombre: 'Mi Empresa',
  razonSocial: '',
  slogan: 'Configure el nombre y el logo de su empresa en Configuración',
  /** Sin logo por defecto: se muestra un icono genérico */
  logo: '',
  colorPrimario: COLOR_POR_DEFECTO,
  colorSecundario: '#0f766e',
};

export const logoDe = (empresa?: { logoUrl?: string } | null): string => empresa?.logoUrl || '';
