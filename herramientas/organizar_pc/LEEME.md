# Organizador y depurador de PC

Ordena Escritorio, Documentos, Descargas, Imágenes, Videos, Música y OneDrive en `C:\Users\<usuario>\PC_ORGANIZADO`:

```
PC_ORGANIZADO\
├── 01_SENA\<año>\<tipo>\            contratación, SECOP, CDP/RP, SIIF, estudios previos...
├── 02_CONTABILIDADES\<año>\<tipo>\  DIAN, IVA, retención, exógena, facturas, renta...
├── 03_ESTUDIOS\<año>\<tipo>\        CUN, tesis, especialización...
├── 04_PERSONAL\<año>\<tipo>\        fotos, cédula, salud, banco, vehículo...
├── 99_POR_REVISAR\<año>\<tipo>\     sin pistas suficientes o con empate
├── _DUPLICADOS\                     copias exactas (SHA-256); se conserva la más antigua
└── _REPORTES\                       inventario CSV (Excel), resumen HTML y log para deshacer
```

La categoría se decide por palabras clave en ruta, nombre y **contenido** (txt, csv, xml, docx, xlsx, pptx y, si instala `pypdf`, PDF). El año corresponde a la fecha más antigua del archivo (creación o modificación). Las palabras clave se editan en el diccionario `CATEGORIAS` al inicio del script.

## Uso

1. Instale Python 3 (python.org, marque "Add to PATH"). Opcional: `pip install pypdf`.
2. Doble clic en `ORGANIZAR_PC.bat`:
   - **1 Simular**: no mueve nada; abre `_REPORTES` para revisar `resumen_*.html` e `inventario_*.csv`.
   - **2 Ejecutar**: mueve los archivos y aparta los duplicados.
   - **3 Deshacer**: revierte la última ejecución.

Por consola:

```
python organizar_pc.py --origen "D:\Trabajo" --destino "D:\PC_ORGANIZADO"      # simulación
python organizar_pc.py --ejecutar --limpiar-vacias                            # aplicar
python organizar_pc.py --ejecutar --borrar-duplicados                         # borra _DUPLICADOS (pide escribir BORRAR)
python organizar_pc.py --deshacer "...\_REPORTES\log_movimientos_AAAAMMDD_HHMM.csv"
```

Nunca toca Windows, Program Files, AppData, `.git`, `node_modules` ni archivos de Office abiertos (`~$`). Cierre Excel/Word antes de ejecutar: un archivo abierto queda en su sitio y aparece como ERROR en el log.
