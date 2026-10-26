import Dexie, { type Table } from 'dexie';
import { CompraDocumento, Proveedor, Categoria, CentroCosto, Venta } from '../types';
import { CATEGORIAS_DEFECTO, CENTROS_COSTO_DEFECTO, PROVEEDORES_DEFECTO } from '../data/defaults';

export class VetComprasDatabase extends Dexie {
  documentos!: Table<CompraDocumento, string>;
  ventas!: Table<Venta, string>;
  proveedores!: Table<Proveedor, string>;
  categorias!: Table<Categoria, string>;
  centrosCosto!: Table<CentroCosto, string>;

  constructor() {
    super('VetComprasDB');

    this.version(2).stores({
      documentos: 'id, folio, cufe, fechaEmision, estadoPago, categoriaId, centroCostoId, proveedorId, origen',
      ventas: 'id, consecutivo, fecha, categoria, medioPago, estado',
      proveedores: 'id, nit, razonSocial',
      categorias: 'id, nombre, esGasto, activo',
      centrosCosto: 'id, nombre, codigo, activo',
    });
  }
}

export const db = new VetComprasDatabase();

/**
 * Inicializa los catálogos base y documentos demo en IndexedDB si la base de datos está recién creada
 */
export async function inicializarBaseDatosSiVacia(): Promise<void> {
  try {
    const totalCategorias = await db.categorias.count();
    if (totalCategorias === 0) {
      await db.categorias.bulkAdd(CATEGORIAS_DEFECTO);
    }

    const totalCentrosCosto = await db.centrosCosto.count();
    if (totalCentrosCosto === 0) {
      await db.centrosCosto.bulkAdd(CENTROS_COSTO_DEFECTO);
    }

    const totalProveedores = await db.proveedores.count();
    if (totalProveedores === 0) {
      await db.proveedores.bulkAdd(PROVEEDORES_DEFECTO);
    }
  } catch (error) {
    console.error('Error al inicializar la base de datos IndexedDB:', error);
  }
}
