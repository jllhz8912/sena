import { db, inicializarBaseDatosSiVacia } from './db';
import { CompraDocumento, Proveedor, Categoria, CentroCosto, RegistroPago, EmpresaInfo, Venta } from '../types';
import { generarDatosDemostracion, CATEGORIAS_DEFECTO, CENTROS_COSTO_DEFECTO, PROVEEDORES_DEFECTO, EMPRESA_DEFECTO, VENTAS_DEFECTO } from '../data/defaults';
import { firestore } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';

/**
 * Capa de Abstracción de Datos (Data Service)
 * Ahora sincronizada en tiempo real con Firebase Firestore para compartir información
 * entre múltiples computadores y sesiones de forma automática.
 * Mantiene IndexedDB local como caché de alto rendimiento y soporte offline.
 */
let sincronizacionIniciada = false;

export const dataService = {
  async init(): Promise<void> {
    await inicializarBaseDatosSiVacia();
    if (!sincronizacionIniciada) {
      sincronizacionIniciada = true;
      // Iniciar sincronización bidireccional en segundo plano
      this.sincronizarConNube().catch((err) =>
        console.warn('Sincronización inicial en la nube no completada:', err)
      );
    }
  },

  /**
   * Sincroniza datos entre Firestore (nube compartida) e IndexedDB (local)
   */
  async sincronizarConNube(): Promise<void> {
    try {
      // 1. Sincronizar Proveedores
      const provsSnap = await getDocs(collection(firestore, 'proveedores'));
      if (!provsSnap.empty) {
        const provsNube: Proveedor[] = [];
        provsSnap.forEach((d) => provsNube.push(d.data() as Proveedor));
        await db.proveedores.clear();
        await db.proveedores.bulkAdd(provsNube);
      } else {
        // Subir proveedores iniciales a Firestore
        const provsLocales = await db.proveedores.toArray();
        for (const p of provsLocales) {
          await setDoc(doc(firestore, 'proveedores', p.id), p);
        }
      }

      // 2. Sincronizar Categorías
      const catsSnap = await getDocs(collection(firestore, 'categorias'));
      if (!catsSnap.empty) {
        const catsNube: Categoria[] = [];
        catsSnap.forEach((d) => catsNube.push(d.data() as Categoria));
        await db.categorias.clear();
        await db.categorias.bulkAdd(catsNube);
      } else {
        const catsLocales = await db.categorias.toArray();
        for (const c of catsLocales) {
          await setDoc(doc(firestore, 'categorias', c.id), c);
        }
      }

      // 3. Sincronizar Centros de Costo
      const ccsSnap = await getDocs(collection(firestore, 'centrosCosto'));
      if (!ccsSnap.empty) {
        const ccsNube: CentroCosto[] = [];
        ccsSnap.forEach((d) => ccsNube.push(d.data() as CentroCosto));
        await db.centrosCosto.clear();
        await db.centrosCosto.bulkAdd(ccsNube);
      } else {
        const ccsLocales = await db.centrosCosto.toArray();
        for (const cc of ccsLocales) {
          await setDoc(doc(firestore, 'centrosCosto', cc.id), cc);
        }
      }

      // 4. Sincronizar Documentos y Facturas
      const docsSnap = await getDocs(collection(firestore, 'documentos'));
      if (!docsSnap.empty) {
        const docsNube: CompraDocumento[] = [];
        docsSnap.forEach((d) => docsNube.push(d.data() as CompraDocumento));
        await db.documentos.clear();
        await db.documentos.bulkAdd(docsNube);
      } else {
        // Si la nube está vacía (por ejemplo tras limpiar o sin registros), reflejarlo
        const docsLocales = await db.documentos.toArray();
        if (docsLocales.length > 0) {
          await db.documentos.clear();
        }
      }

      // 5. Sincronizar Datos de Empresa
      const empSnap = await getDoc(doc(firestore, 'configuracion', 'empresa'));
      if (empSnap.exists()) {
        const dataEmp = empSnap.data() as EmpresaInfo;
        localStorage.setItem('vetcompras_empresa', JSON.stringify(dataEmp));
      } else {
        const rawLocal = localStorage.getItem('vetcompras_empresa');
        const empData = rawLocal ? JSON.parse(rawLocal) : EMPRESA_DEFECTO;
        await setDoc(doc(firestore, 'configuracion', 'empresa'), empData);
      }

      // 6. Sincronizar Ventas de la Veterinaria
      const ventasSnap = await getDocs(collection(firestore, 'ventas'));
      if (!ventasSnap.empty) {
        const ventasNube: Venta[] = [];
        ventasSnap.forEach((d) => ventasNube.push(d.data() as Venta));
        await db.ventas.clear();
        await db.ventas.bulkAdd(ventasNube);
      } else {
        const ventasLocales = await db.ventas.toArray();
        if (ventasLocales.length === 0) {
          await db.ventas.bulkAdd(VENTAS_DEFECTO);
          for (const v of VENTAS_DEFECTO) {
            await setDoc(doc(firestore, 'ventas', v.id), v);
          }
        } else {
          for (const v of ventasLocales) {
            await setDoc(doc(firestore, 'ventas', v.id), v);
          }
        }
      }
    } catch (err) {
      console.warn('Error durante sincronización con Firestore:', err);
    }
  },

  /**
   * Suscribe a cambios en vivo desde Firestore para actualizar instantáneamente
   * si otro computador añade o modifica facturas o ventas
   */
  suscribirCambiosEnVivo(onCambio: () => void): () => void {
    try {
      const unsubDocs = onSnapshot(collection(firestore, 'documentos'), async (snapshot) => {
        const docsNube: CompraDocumento[] = [];
        snapshot.forEach((d) => docsNube.push(d.data() as CompraDocumento));
        await db.documentos.clear();
        if (docsNube.length > 0) {
          await db.documentos.bulkAdd(docsNube);
        }
        onCambio();
      });

      const unsubVentas = onSnapshot(collection(firestore, 'ventas'), async (snapshot) => {
        const ventasNube: Venta[] = [];
        snapshot.forEach((d) => ventasNube.push(d.data() as Venta));
        await db.ventas.clear();
        if (ventasNube.length > 0) {
          await db.ventas.bulkAdd(ventasNube);
        }
        onCambio();
      });

      return () => {
        unsubDocs();
        unsubVentas();
      };
    } catch (e) {
      console.warn('No se pudo establecer listener en vivo:', e);
      return () => {};
    }
  },

  // ================= DOCUMENTOS =================

  async obtenerDocumentos(): Promise<CompraDocumento[]> {
    await this.init();
    const docs = await db.documentos.toArray();
    // Ordenar por fecha de emisión descendente
    return docs.sort((a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime());
  },

  async obtenerDocumentoPorId(id: string): Promise<CompraDocumento | undefined> {
    return await db.documentos.get(id);
  },

  /**
   * Valida si ya existe un documento con el mismo CUFE o combinación de NIT Proveedor + Folio
   */
  async buscarDuplicado(cufe?: string, nitProveedor?: string, folio?: string): Promise<CompraDocumento | null> {
    const todos = await db.documentos.toArray();

    // 1. Validar por CUFE si viene informado
    if (cufe && cufe.trim().length > 10) {
      const matchCufe = todos.find(
        (d) => d.cufe && d.cufe.toLowerCase().trim() === cufe.toLowerCase().trim()
      );
      if (matchCufe) return matchCufe;
    }

    // 2. Validar por NIT de Proveedor + Número de Factura / Folio
    if (nitProveedor && folio) {
      const cleanNit = nitProveedor.replace(/\D/g, '');
      const cleanFolio = folio.trim().toLowerCase();

      const matchNitFolio = todos.find((d) => {
        const dNit = (d.proveedor?.nit || '').replace(/\D/g, '');
        const dFolio = (d.folio || '').trim().toLowerCase();
        return dNit === cleanNit && dFolio === cleanFolio;
      });

      if (matchNitFolio) return matchNitFolio;
    }

    return null;
  },

  async guardarDocumento(docData: CompraDocumento): Promise<string> {
    // Si el proveedor no existe en catálogo, registrarlo automáticamente
    if (docData.proveedor && docData.proveedor.nit) {
      await this.asegurarProveedor(docData.proveedor, docData.categoriaId, docData.centroCostoId);
    }

    // Guardar en IndexedDB local
    await db.documentos.put(docData);

    // Guardar en Firestore para sincronización con otros PCs
    try {
      await setDoc(doc(firestore, 'documentos', docData.id), docData);
    } catch (err) {
      console.warn('Error al guardar documento en Firestore:', err);
    }

    return docData.id;
  },

  async actualizarDocumento(docData: CompraDocumento, detalleCambio?: string): Promise<void> {
    const docExistente = await db.documentos.get(docData.id);
    const historial = [...(docExistente?.historialCambios || [])];

    if (detalleCambio) {
      historial.push({
        fecha: new Date().toISOString(),
        usuario: 'Usuario actual',
        accion: 'Modificación de registro',
        detalle: detalleCambio,
      });
    }

    const docActualizado: CompraDocumento = {
      ...docData,
      historialCambios: historial,
      actualizadoEn: new Date().toISOString(),
    };

    await db.documentos.put(docActualizado);

    try {
      await setDoc(doc(firestore, 'documentos', docActualizado.id), docActualizado);
    } catch (err) {
      console.warn('Error al actualizar documento en Firestore:', err);
    }
  },

  async eliminarDocumento(id: string): Promise<void> {
    await db.documentos.delete(id);
    try {
      await deleteDoc(doc(firestore, 'documentos', id));
    } catch (err) {
      console.warn('Error al eliminar documento en Firestore:', err);
    }
  },

  async eliminarDocumentosLote(ids: string[]): Promise<void> {
    await db.documentos.bulkDelete(ids);
    try {
      const batch = writeBatch(firestore);
      ids.forEach((id) => {
        batch.delete(doc(firestore, 'documentos', id));
      });
      await batch.commit();
    } catch (err) {
      console.warn('Error al eliminar lote en Firestore:', err);
    }
  },

  async cambiarCategoriaLote(ids: string[], nuevaCategoriaId: string): Promise<void> {
    const docs = await db.documentos.where('id').anyOf(ids).toArray();
    const actualizados = docs.map((d) => ({
      ...d,
      categoriaId: nuevaCategoriaId,
      actualizadoEn: new Date().toISOString(),
      historialCambios: [
        ...(d.historialCambios || []),
        {
          fecha: new Date().toISOString(),
          usuario: 'Usuario actual',
          accion: 'Cambio masivo de categoría',
        },
      ],
    }));
    await db.documentos.bulkPut(actualizados);

    try {
      const batch = writeBatch(firestore);
      actualizados.forEach((d) => {
        batch.set(doc(firestore, 'documentos', d.id), d);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Error al actualizar lote en Firestore:', err);
    }
  },

  async marcarPagadosLote(ids: string[]): Promise<void> {
    const docs = await db.documentos.where('id').anyOf(ids).toArray();
    const hoy = new Date().toISOString().split('T')[0];

    const actualizados = docs.map((d) => {
      const nuevoPago: RegistroPago = {
        id: 'pago-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        fecha: hoy,
        monto: d.saldoPendiente > 0 ? d.saldoPendiente : d.total,
        medio: 'transferencia',
        nota: 'Marcado masivo como pagado',
      };

      return {
        ...d,
        estadoPago: 'pagada' as const,
        saldoPendiente: 0,
        fechaPago: hoy,
        pagos: [...(d.pagos || []), nuevoPago],
        actualizadoEn: new Date().toISOString(),
      };
    });

    await db.documentos.bulkPut(actualizados);

    try {
      const batch = writeBatch(firestore);
      actualizados.forEach((d) => {
        batch.set(doc(firestore, 'documentos', d.id), d);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Error al marcar pagados en Firestore:', err);
    }
  },

  async registrarAbonoPago(
    documentoId: string,
    pago: { monto: number; fecha: string; medio: string; nota?: string }
  ): Promise<CompraDocumento> {
    const docItem = await db.documentos.get(documentoId);
    if (!docItem) throw new Error('Documento no encontrado');

    const nuevoSaldo = Math.max(0, docItem.saldoPendiente - pago.monto);
    const nuevoEstado = nuevoSaldo === 0 ? 'pagada' : 'parcial';

    const registroPago: RegistroPago = {
      id: 'pago-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      fecha: pago.fecha,
      monto: pago.monto,
      medio: pago.medio,
      nota: pago.nota,
    };

    const docActualizado: CompraDocumento = {
      ...docItem,
      saldoPendiente: nuevoSaldo,
      estadoPago: nuevoEstado,
      fechaPago: nuevoSaldo === 0 ? pago.fecha : docItem.fechaPago,
      pagos: [...(docItem.pagos || []), registroPago],
      actualizadoEn: new Date().toISOString(),
      historialCambios: [
        ...(docItem.historialCambios || []),
        {
          fecha: new Date().toISOString(),
          usuario: 'Usuario actual',
          accion: 'Registro de Abono / Pago',
          detalle: `Medio: ${pago.medio}. Saldo restante: $${nuevoSaldo.toLocaleString('es-CO')}`,
        },
      ],
    };

    await db.documentos.put(docActualizado);

    try {
      await setDoc(doc(firestore, 'documentos', docActualizado.id), docActualizado);
    } catch (err) {
      console.warn('Error al actualizar pago en Firestore:', err);
    }

    return docActualizado;
  },

  async registrarAbono(
    documentoId: string,
    pago: { monto: number; fecha: string; medio: string; referencia?: string; nota?: string }
  ): Promise<CompraDocumento> {
    return this.registrarAbonoPago(documentoId, pago);
  },

  // ================= PROVEEDORES =================

  async obtenerProveedores(): Promise<Proveedor[]> {
    await this.init();
    const provs = await db.proveedores.toArray();
    return provs.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
  },

  async guardarProveedor(proveedor: Proveedor): Promise<void> {
    await db.proveedores.put(proveedor);
    try {
      await setDoc(doc(firestore, 'proveedores', proveedor.id), proveedor);
    } catch (err) {
      console.warn('Error al guardar proveedor en Firestore:', err);
    }
  },

  async eliminarProveedor(id: string): Promise<void> {
    await db.proveedores.delete(id);
    try {
      await deleteDoc(doc(firestore, 'proveedores', id));
    } catch (err) {
      console.warn('Error al eliminar proveedor en Firestore:', err);
    }
  },

  async asegurarProveedor(
    info: { nit: string; dv?: string; razonSocial: string; telefono?: string; email?: string; direccion?: string; ciudad?: string },
    categoriaId?: string,
    centroCostoId?: string
  ): Promise<Proveedor> {
    const cleanNit = info.nit.replace(/\D/g, '');
    const todos = await db.proveedores.toArray();
    const existente = todos.find((p) => p.nit.replace(/\D/g, '') === cleanNit);

    if (existente) {
      return existente;
    }

    const nuevo: Proveedor = {
      id: 'prov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      nit: info.nit,
      dv: info.dv,
      razonSocial: info.razonSocial,
      nombreComercial: info.razonSocial,
      telefono: info.telefono,
      email: info.email,
      direccion: info.direccion,
      ciudad: info.ciudad || 'Colombia',
      categoriaPredeterminadaId: categoriaId,
      centroCostoPredeterminadoId: centroCostoId,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    await db.proveedores.put(nuevo);

    try {
      await setDoc(doc(firestore, 'proveedores', nuevo.id), nuevo);
    } catch (err) {
      console.warn('Error al asegurar proveedor en Firestore:', err);
    }

    return nuevo;
  },

  // ================= CATEGORÍAS =================

  async obtenerCategorias(): Promise<Categoria[]> {
    await this.init();
    return await db.categorias.toArray();
  },

  async guardarCategoria(categoria: Categoria): Promise<void> {
    await db.categorias.put(categoria);
    try {
      await setDoc(doc(firestore, 'categorias', categoria.id), categoria);
    } catch (err) {
      console.warn('Error al guardar categoría en Firestore:', err);
    }
  },

  async eliminarCategoria(id: string): Promise<void> {
    await db.categorias.delete(id);
    try {
      await deleteDoc(doc(firestore, 'categorias', id));
    } catch (err) {
      console.warn('Error al eliminar categoría en Firestore:', err);
    }
  },

  // ================= CENTROS DE COSTO =================

  async obtenerCentrosCosto(): Promise<CentroCosto[]> {
    await this.init();
    return await db.centrosCosto.toArray();
  },

  async guardarCentroCosto(centro: CentroCosto): Promise<void> {
    await db.centrosCosto.put(centro);
    try {
      await setDoc(doc(firestore, 'centrosCosto', centro.id), centro);
    } catch (err) {
      console.warn('Error al guardar centro de costo en Firestore:', err);
    }
  },

  async eliminarCentroCosto(id: string): Promise<void> {
    await db.centrosCosto.delete(id);
    try {
      await deleteDoc(doc(firestore, 'centrosCosto', id));
    } catch (err) {
      console.warn('Error al eliminar centro de costo en Firestore:', err);
    }
  },

  // ================= DATOS DE DEMOSTRACIÓN Y RESPALDOS =================

  async cargarDatosDemostracion(): Promise<void> {
    const demoDocs = generarDatosDemostracion();
    await db.documentos.clear();
    await db.documentos.bulkAdd(demoDocs);

    try {
      // Subir a Firestore
      const docsSnap = await getDocs(collection(firestore, 'documentos'));
      const batch = writeBatch(firestore);
      docsSnap.forEach((d) => batch.delete(d.ref));
      demoDocs.forEach((docItem) => {
        batch.set(doc(firestore, 'documentos', docItem.id), docItem);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Error al recargar demo en Firestore:', err);
    }
  },

  async limpiarTodosLosDatos(): Promise<void> {
    await db.documentos.clear();
    try {
      const docsSnap = await getDocs(collection(firestore, 'documentos'));
      const batch = writeBatch(firestore);
      docsSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Error al limpiar Firestore:', err);
    }
  },

  async resetearTodoPorDefecto(): Promise<void> {
    await db.documentos.clear();
    await db.proveedores.clear();
    await db.categorias.clear();
    await db.centrosCosto.clear();

    await db.categorias.bulkAdd(CATEGORIAS_DEFECTO);
    await db.centrosCosto.bulkAdd(CENTROS_COSTO_DEFECTO);
    await db.proveedores.bulkAdd(PROVEEDORES_DEFECTO);

    try {
      await this.sincronizarConNube();
    } catch (err) {
      console.warn('Error al resetear en Firestore:', err);
    }
  },

  async exportarRespaldoJSON(): Promise<string> {
    const [documentos, proveedores, categorias, centrosCosto] = await Promise.all([
      db.documentos.toArray(),
      db.proveedores.toArray(),
      db.categorias.toArray(),
      db.centrosCosto.toArray(),
    ]);

    const backup = {
      version: '1.0',
      aplicacion: 'VetCompras Colombia',
      fechaExportacion: new Date().toISOString(),
      documentos,
      proveedores,
      categorias,
      centrosCosto,
    };

    return JSON.stringify(backup, null, 2);
  },

  async importarRespaldoJSON(jsonString: string): Promise<{ documentos: number; proveedores: number }> {
    const data = JSON.parse(jsonString);

    if (Array.isArray(data.documentos) && data.documentos.length > 0) {
      await db.documentos.bulkPut(data.documentos);
    }
    if (Array.isArray(data.proveedores) && data.proveedores.length > 0) {
      await db.proveedores.bulkPut(data.proveedores);
    }
    if (Array.isArray(data.categorias) && data.categorias.length > 0) {
      await db.categorias.bulkPut(data.categorias);
    }
    if (Array.isArray(data.centrosCosto) && data.centrosCosto.length > 0) {
      await db.centrosCosto.bulkPut(data.centrosCosto);
    }

    try {
      if (Array.isArray(data.documentos)) {
        for (const docItem of data.documentos) {
          await setDoc(doc(firestore, 'documentos', docItem.id), docItem);
        }
      }
      if (Array.isArray(data.proveedores)) {
        for (const p of data.proveedores) {
          await setDoc(doc(firestore, 'proveedores', p.id), p);
        }
      }
    } catch (err) {
      console.warn('Error al sincronizar respaldo con Firestore:', err);
    }

    return {
      documentos: data.documentos?.length || 0,
      proveedores: data.proveedores?.length || 0,
    };
  },

  // ================= DATOS DE LA EMPRESA VETERINARIA =================

  obtenerDatosEmpresa(): EmpresaInfo {
    const raw = localStorage.getItem('vetcompras_empresa');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Error al parsear datos de empresa:', e);
      }
    }
    return EMPRESA_DEFECTO;
  },

  guardarDatosEmpresa(datos: EmpresaInfo): void {
    localStorage.setItem('vetcompras_empresa', JSON.stringify(datos));
    try {
      setDoc(doc(firestore, 'configuracion', 'empresa'), datos).catch((err) =>
        console.warn('Error al guardar empresa en Firestore:', err)
      );
    } catch (err) {
      console.warn('Error al guardar datos empresa en Firestore:', err);
    }
  },

  // ================= VENTAS DE LA VETERINARIA =================

  async obtenerVentas(): Promise<Venta[]> {
    await this.init();
    const ventas = await db.ventas.toArray();
    return ventas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  },

  async obtenerVentaPorId(id: string): Promise<Venta | undefined> {
    return await db.ventas.get(id);
  },

  async guardarVenta(venta: Venta): Promise<string> {
    await db.ventas.put(venta);
    try {
      await setDoc(doc(firestore, 'ventas', venta.id), venta);
    } catch (err) {
      console.warn('Error al guardar venta en Firestore:', err);
    }
    return venta.id;
  },

  async actualizarVenta(venta: Venta): Promise<void> {
    const actualizada: Venta = {
      ...venta,
      actualizadoEn: new Date().toISOString(),
    };
    await db.ventas.put(actualizada);
    try {
      await setDoc(doc(firestore, 'ventas', actualizada.id), actualizada);
    } catch (err) {
      console.warn('Error al actualizar venta en Firestore:', err);
    }
  },

  async eliminarVenta(id: string): Promise<void> {
    await db.ventas.delete(id);
    try {
      await deleteDoc(doc(firestore, 'ventas', id));
    } catch (err) {
      console.warn('Error al eliminar venta en Firestore:', err);
    }
  },

  async eliminarVentasLote(ids: string[]): Promise<void> {
    await db.ventas.bulkDelete(ids);
    try {
      const batch = writeBatch(firestore);
      for (const id of ids) {
        batch.delete(doc(firestore, 'ventas', id));
      }
      await batch.commit();
    } catch (err) {
      console.warn('Error al eliminar lote de ventas en Firestore:', err);
    }
  },

  async limpiarVentas(): Promise<void> {
    const todas = await db.ventas.toArray();
    await db.ventas.clear();
    try {
      const batch = writeBatch(firestore);
      todas.forEach((v) => batch.delete(doc(firestore, 'ventas', v.id)));
      await batch.commit();
    } catch (err) {
      console.warn('Error al limpiar ventas en Firestore:', err);
    }
  },

  async generarSiguienteConsecutivoVenta(): Promise<string> {
    const todas = await db.ventas.toArray();
    let maxNum = 0;
    for (const v of todas) {
      const match = v.consecutivo?.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
    const siguiente = maxNum + 1;
    return `VNT-${String(siguiente).padStart(3, '0')}`;
  },
};

