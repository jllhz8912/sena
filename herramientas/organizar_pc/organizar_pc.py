#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ORGANIZADOR Y DEPURADOR DE PC
=============================
Clasifica los archivos del usuario en:
    01_SENA / 02_CONTABILIDADES / 03_ESTUDIOS / 04_PERSONAL / 99_POR_REVISAR
y dentro de cada categoría por AÑO (antigüedad) y TIPO de archivo.
Detecta duplicados exactos (hash SHA-256) y los aparta en _DUPLICADOS.

Seguridad:
  * Por defecto corre en SIMULACIÓN: no mueve nada, solo genera el reporte.
  * Con --ejecutar mueve los archivos y guarda un log para deshacer.
  * Los duplicados NO se borran: se mueven a _DUPLICADOS (cuarentena).
    Solo con --borrar-duplicados se eliminan, previa confirmación escrita.
  * --deshacer <log.csv> devuelve todo a su ubicación original.

Sin dependencias externas (solo Python 3.8+). Si está instalado `pypdf`,
también lee el texto de los PDF para clasificarlos por contenido.

Uso rápido (Windows, PowerShell o CMD):
    python organizar_pc.py                         -> simulación sobre Escritorio, Documentos, Descargas...
    python organizar_pc.py --ejecutar              -> aplica los cambios
    python organizar_pc.py --origen "D:\\Trabajo" --destino "D:\\PC_ORGANIZADO" --ejecutar
    python organizar_pc.py --deshacer "C:\\Users\\yo\\PC_ORGANIZADO\\_REPORTES\\log_movimientos_20260928_1030.csv"
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import os
import re
import shutil
import sys
import unicodedata
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIGURACIÓN (ajustable sin tocar la lógica)
# ---------------------------------------------------------------------------

# Palabras clave por categoría. Se buscan en ruta + nombre + contenido.
# Peso: nombre/ruta cuenta x3, contenido x1. Gana la de mayor puntaje.
CATEGORIAS: dict[str, list[str]] = {
    "01_SENA": [
        "sena", "secop", "siif", "cdp", "registro presupuestal", "rps cen", "rps reg",
        "macro ejec", "caqueta", "caquetá", "estudio previo", "estudios previos",
        "analisis del sector", "análisis del sector", "estudio de mercado",
        "supervision", "supervisión", "supervisor", "acta de inicio", "acta de entrega",
        "pliego", "invitacion publica", "invitación pública", "minima cuantia",
        "mínima cuantía", "contratacion", "contratación", "contratista", "psp", "bys",
        "sabana contratos", "sábana contratos", "colombia compra", "unspsc",
        "matriz de riesgo", "plan anual de adquisiciones", "paa", "aprendiz",
        "formacion profesional", "centro tecnologico", "regional",
    ],
    "02_CONTABILIDADES": [
        "dian", "iva", "f300", "formulario 300", "f350", "formulario 350", "retencion",
        "retención", "retefuente", "reteica", "rete ica", "ica", "renta", "f110",
        "f210", "f250", "exogena", "exógena", "formato 1001", "formato 1007",
        "medios magneticos", "medios magnéticos", "factura", "facturacion",
        "facturación", "cufe", "nota credito", "nota crédito", "ubl", "rut",
        "declaracion", "declaración", "balance", "estado de resultados",
        "estados financieros", "libro auxiliar", "auxiliar", "conciliacion",
        "conciliación", "contabilidad", "contable", "nomina", "nómina", "pila",
        "samit", "siigo", "helisa", "world office", "puc", "impuesto", "tributari",
        "nit", "cartera", "extracto bancario", "extracto", "anticipo", "gmf",
        "consorcio", "union temporal", "unión temporal", "aiu",
    ],
    "03_ESTUDIOS": [
        "cun", "tesis", "trabajo de grado", "anteproyecto", "especializacion",
        "especialización", "maestria", "maestría", "monografia", "monografía",
        "marco teorico", "marco teórico", "metodologia", "metodología", "apa",
        "bibliografia", "bibliografía", "referencias", "aca", "actividad academica",
        "diplomado", "curso", "certificado de estudio", "universidad", "pae",
        "compras publicas sostenibles", "compras públicas sostenibles", "sustentacion",
        "sustentación", "semestre", "parcial", "taller",
    ],
    "04_PERSONAL": [
        "personal", "familia", "cedula", "cédula", "pasaporte", "licencia",
        "hoja de vida", "cv", "curriculum", "whatsapp", "img_", "dsc_", "dcim",
        "screenshot", "captura", "vacaciones", "cumpleaños", "boda", "matrimonio",
        "salud", "eps", "historia clinica", "historia clínica", "banco", "credito",
        "crédito", "hipoteca", "arriendo", "servicios publicos", "servicios públicos",
        "recibo", "soat", "tecnomecanica", "tecnomecánica", "vehiculo", "vehículo",
        "musica", "música", "pelicula", "película", "foto", "fotos", "video",
    ],
}

# Tipos de archivo -> subcarpeta
TIPOS: dict[str, set[str]] = {
    "PDF": {".pdf"},
    "Excel_y_Datos": {".xlsx", ".xlsm", ".xls", ".xlsb", ".csv", ".ods", ".json", ".xml", ".dbf", ".accdb", ".mdb"},
    "Word_y_Textos": {".docx", ".doc", ".odt", ".rtf", ".md", ".txt"},
    "Presentaciones": {".pptx", ".ppt", ".odp", ".key"},
    "Imagenes": {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".webp", ".svg", ".raw", ".cr2", ".nef"},
    "Videos": {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".3gp", ".m4v", ".webm"},
    "Audio": {".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac", ".flac", ".wma"},
    "Comprimidos": {".zip", ".rar", ".7z", ".tar", ".gz"},
    "Codigo_y_Macros": {".py", ".ipynb", ".bas", ".vba", ".pq", ".m", ".sql", ".js", ".ts", ".html", ".css", ".ps1", ".bat"},
    "Instaladores": {".exe", ".msi", ".apk", ".iso", ".dmg"},
    "Correos": {".msg", ".eml", ".pst"},
}

# Carpetas que NUNCA se tocan (sistema, programas, proyectos, nubes internas)
CARPETAS_EXCLUIDAS = {
    "windows", "program files", "program files (x86)", "programdata", "appdata",
    "$recycle.bin", "system volume information", "recovery", "perflogs",
    ".git", ".svn", "node_modules", "__pycache__", ".venv", "venv", "env",
    ".vscode", ".idea", "site-packages", "anaconda3", "miniconda3",
    "my music", "my pictures", "my videos",  # enlaces heredados de Windows
}

# Archivos que no se mueven
ARCHIVOS_EXCLUIDOS = {"desktop.ini", "thumbs.db", ".ds_store", "ntuser.dat"}
PREFIJOS_EXCLUIDOS = ("~$", ".~lock", "~wr")  # temporales de Office abiertos

# Extensiones cuyo contenido se lee para clasificar
EXT_TEXTO = {".txt", ".csv", ".xml", ".json", ".md", ".html", ".py", ".bas", ".sql"}
EXT_OFFICE = {".docx": ["word/document.xml"],
              ".xlsx": ["xl/sharedStrings.xml"],
              ".xlsm": ["xl/sharedStrings.xml"],
              ".pptx": None}  # None = todas las diapositivas
BYTES_CONTENIDO = 200_000       # máximo leído por archivo para clasificar
MAX_MB_HASH_COMPLETO = 2048      # archivos más grandes: hash parcial (inicio+fin+tamaño)

# ---------------------------------------------------------------------------


def normalizar(texto: str) -> str:
    """minúsculas y sin tildes, para comparar palabras clave."""
    t = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in t if not unicodedata.combining(c))


# Pre-compila las palabras clave (límites de palabra, sin tildes)
_PATRONES = {
    cat: [re.compile(r"(?<![a-z0-9])" + re.escape(normalizar(p)) + r"(?![a-z0-9])")
          for p in sorted(set(normalizar(x) for x in palabras))]
    for cat, palabras in CATEGORIAS.items()
}
# Prefijos de cámara como img_ / dsc_ no llevan límite al final
_PATRONES["04_PERSONAL"] += [re.compile(r"(?<![a-z0-9])(img|dsc|vid|pxl)[_-]?\d")]

try:  # opcional
    from pypdf import PdfReader  # type: ignore
except Exception:  # pragma: no cover
    PdfReader = None


@dataclass
class Archivo:
    ruta: Path
    tamano: int
    fecha: datetime
    tipo: str = ""
    categoria: str = ""
    motivo: str = ""
    hash: str = ""
    duplicado_de: str = ""
    destino: Path | None = None
    puntajes: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Lectura de contenido
# ---------------------------------------------------------------------------

def leer_contenido(ruta: Path) -> str:
    ext = ruta.suffix.lower()
    try:
        if ext in EXT_TEXTO:
            with open(ruta, "rb") as f:
                crudo = f.read(BYTES_CONTENIDO)
            for enc in ("utf-8", "latin-1"):
                try:
                    return crudo.decode(enc)
                except UnicodeDecodeError:
                    continue
        elif ext in EXT_OFFICE:
            partes = EXT_OFFICE[ext]
            with zipfile.ZipFile(ruta) as z:
                nombres = partes or [n for n in z.namelist()
                                     if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
                texto = []
                for n in nombres:
                    if n in z.namelist():
                        texto.append(z.read(n)[:BYTES_CONTENIDO].decode("utf-8", "ignore"))
                return re.sub(r"<[^>]+>", " ", " ".join(texto))
        elif ext == ".pdf" and PdfReader is not None:
            lector = PdfReader(str(ruta))
            return " ".join((p.extract_text() or "") for p in lector.pages[:3])[:BYTES_CONTENIDO]
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# Clasificación
# ---------------------------------------------------------------------------

def tipo_de(ruta: Path) -> str:
    ext = ruta.suffix.lower()
    for tipo, exts in TIPOS.items():
        if ext in exts:
            return tipo
    return "Otros"


def puntuar(texto: str) -> Counter:
    t = normalizar(texto)
    c = Counter()
    for cat, patrones in _PATRONES.items():
        for p in patrones:
            n = len(p.findall(t))
            if n:
                c[cat] += min(n, 5)  # tope por palabra para no sesgar
    return c


def clasificar(a: Archivo, origen_base: Path, leer: bool) -> None:
    try:
        rel = str(a.ruta.relative_to(origen_base))
    except ValueError:
        rel = str(a.ruta)
    ruta_txt = rel.replace("\\", " ").replace("/", " ").replace("_", " ").replace("-", " ")
    puntos = Counter()
    for cat, v in puntuar(ruta_txt).items():
        puntos[cat] += v * 3
    # Prefijos de cámara (IMG_2023...) necesitan el guion bajo original
    for cat, v in puntuar(a.ruta.name).items():
        if cat == "04_PERSONAL":
            puntos[cat] += v
    if leer:
        for cat, v in puntuar(leer_contenido(a.ruta)).items():
            puntos[cat] += v
    # Fotos, videos y audio sin otra pista -> personal
    if not puntos and a.tipo in {"Imagenes", "Videos", "Audio"}:
        puntos["04_PERSONAL"] = 1
    a.puntajes = dict(puntos)
    if not puntos:
        a.categoria, a.motivo = "99_POR_REVISAR", "sin palabras clave"
        return
    orden = puntos.most_common()
    if len(orden) > 1 and orden[0][1] == orden[1][1]:
        a.categoria = "99_POR_REVISAR"
        a.motivo = f"empate {orden[0][0]} / {orden[1][0]}"
        return
    a.categoria = orden[0][0]
    a.motivo = ", ".join(f"{k}={v}" for k, v in orden[:3])


# ---------------------------------------------------------------------------
# Duplicados
# ---------------------------------------------------------------------------

def calcular_hash(ruta: Path, tamano: int) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        if tamano > MAX_MB_HASH_COMPLETO * 1024 * 1024:
            h.update(f.read(8 * 1024 * 1024))
            f.seek(-8 * 1024 * 1024, os.SEEK_END)
            h.update(f.read())
            h.update(str(tamano).encode())
        else:
            for bloque in iter(lambda: f.read(1024 * 1024), b""):
                h.update(bloque)
    return h.hexdigest()


def marcar_duplicados(archivos: list[Archivo]) -> None:
    por_tamano: dict[int, list[Archivo]] = defaultdict(list)
    for a in archivos:
        if a.tamano > 0:
            por_tamano[a.tamano].append(a)
    candidatos = [g for g in por_tamano.values() if len(g) > 1]
    total = sum(len(g) for g in candidatos)
    hechos = 0
    for grupo in candidatos:
        por_hash: dict[str, list[Archivo]] = defaultdict(list)
        for a in grupo:
            hechos += 1
            try:
                a.hash = calcular_hash(a.ruta, a.tamano)
                por_hash[a.hash].append(a)
            except OSError:
                pass
            if hechos % 200 == 0:
                print(f"   hash {hechos}/{total}...", flush=True)
        for iguales in por_hash.values():
            if len(iguales) < 2:
                continue
            # Se conserva el más antiguo; a igual fecha, la ruta más corta
            iguales.sort(key=lambda x: (x.fecha, len(str(x.ruta)), str(x.ruta)))
            original = iguales[0]
            for d in iguales[1:]:
                d.duplicado_de = str(original.ruta)


# ---------------------------------------------------------------------------
# Recorrido
# ---------------------------------------------------------------------------

def carpetas_por_defecto() -> list[Path]:
    casa = Path.home()
    nombres = ["Desktop", "Escritorio", "Documents", "Documentos", "Downloads",
               "Descargas", "Pictures", "Imágenes", "Imagenes", "Videos", "Vídeos",
               "Music", "Música", "Musica"]
    rutas = [casa / n for n in nombres]
    rutas += [p for p in casa.glob("OneDrive*") if p.is_dir()]
    vistos, res = set(), []
    for r in rutas:
        if r.is_dir():
            real = r.resolve()
            if real not in vistos:
                vistos.add(real)
                res.append(r)
    return res


def fecha_archivo(st: os.stat_result) -> datetime:
    # En Windows st_ctime es la fecha de creación; se toma la más antigua.
    marcas = [st.st_mtime, st.st_ctime]
    if hasattr(st, "st_birthtime"):
        marcas.append(st.st_birthtime)
    return datetime.fromtimestamp(min(m for m in marcas if m > 0))


def recorrer(origenes: list[Path], destino: Path) -> list[tuple[Path, Archivo]]:
    destino_r = destino.resolve()
    res = []
    for base in origenes:
        for raiz, dirs, files in os.walk(base):
            raiz_p = Path(raiz)
            # no entrar en excluidas ni en el propio destino
            dirs[:] = [d for d in dirs
                       if d.lower() not in CARPETAS_EXCLUIDAS
                       and not d.startswith(".")
                       and (raiz_p / d).resolve() != destino_r]
            for nombre in files:
                low = nombre.lower()
                if low in ARCHIVOS_EXCLUIDOS or low.startswith(PREFIJOS_EXCLUIDOS) or low.endswith(".lnk"):
                    continue
                p = raiz_p / nombre
                try:
                    if p.is_symlink():
                        continue
                    st = p.stat()
                except OSError:
                    continue
                res.append((base, Archivo(p, st.st_size, fecha_archivo(st))))
    return res


# ---------------------------------------------------------------------------
# Plan de destino y ejecución
# ---------------------------------------------------------------------------

def nombre_libre(destino: Path, ocupados: set[str]) -> Path:
    cand, n = destino, 1
    while str(cand).lower() in ocupados or cand.exists():
        cand = destino.with_name(f"{destino.stem} ({n}){destino.suffix}")
        n += 1
    ocupados.add(str(cand).lower())
    return cand


def planificar(pares: list[tuple[Path, Archivo]], destino: Path) -> None:
    ocupados: set[str] = set()
    for base, a in pares:
        if a.duplicado_de:
            try:
                rel = a.ruta.relative_to(base)
            except ValueError:
                rel = Path(a.ruta.name)
            d = destino / "_DUPLICADOS" / base.name / rel
        else:
            d = destino / a.categoria / str(a.fecha.year) / a.tipo / a.ruta.name
        a.destino = nombre_libre(d, ocupados)


def mover(archivos: list[Archivo], carpeta_rep: Path, sello: str) -> Path:
    log = carpeta_rep / f"log_movimientos_{sello}.csv"
    ok = err = 0
    with open(log, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["origen", "destino", "estado"])
        for a in archivos:
            if a.destino is None or a.destino == a.ruta:
                continue
            try:
                a.destino.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(a.ruta), str(a.destino))
                # conserva la fecha original
                os.utime(a.destino, (a.fecha.timestamp(), a.fecha.timestamp()))
                w.writerow([a.ruta, a.destino, "OK"])
                ok += 1
            except Exception as e:  # archivo abierto, sin permisos, ruta larga...
                w.writerow([a.ruta, a.destino, f"ERROR: {e}"])
                err += 1
    print(f"\n   Movidos: {ok}   Con error (quedaron en su sitio): {err}")
    return log


def borrar_carpetas_vacias(origenes: list[Path]) -> int:
    n = 0
    for base in origenes:
        for raiz, dirs, files in os.walk(base, topdown=False):
            p = Path(raiz)
            if p == base or any(parte.lower() in CARPETAS_EXCLUIDAS for parte in p.parts):
                continue
            try:
                resto = [x for x in p.iterdir() if x.name.lower() not in ARCHIVOS_EXCLUIDOS]
                if not resto:
                    for x in p.iterdir():
                        x.unlink()
                    p.rmdir()
                    n += 1
            except OSError:
                pass
    return n


def deshacer(log: Path) -> None:
    with open(log, encoding="utf-8-sig") as f:
        filas = list(csv.DictReader(f, delimiter=";"))
    ok = 0
    for fila in reversed(filas):
        if fila["estado"] != "OK":
            continue
        dst, org = Path(fila["destino"]), Path(fila["origen"])
        if dst.exists() and not org.exists():
            org.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(dst), str(org))
            ok += 1
    print(f"Restaurados {ok} archivos a su ubicación original.")


# ---------------------------------------------------------------------------
# Reportes
# ---------------------------------------------------------------------------

def mb(n: int) -> str:
    return f"{n / 1024 / 1024:,.1f} MB"


def escribir_reportes(archivos: list[Archivo], carpeta: Path, sello: str, simulacion: bool) -> tuple[Path, Path]:
    carpeta.mkdir(parents=True, exist_ok=True)
    csv_path = carpeta / f"inventario_{sello}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:  # abre bien en Excel
        w = csv.writer(f, delimiter=";")
        w.writerow(["ruta_original", "nombre", "extension", "tamano_bytes", "fecha", "anio",
                    "tipo", "categoria", "motivo_clasificacion", "es_duplicado",
                    "duplicado_de", "sha256", "destino_propuesto"])
        for a in sorted(archivos, key=lambda x: (x.categoria, x.fecha)):
            w.writerow([a.ruta, a.ruta.name, a.ruta.suffix.lower(), a.tamano,
                        a.fecha.strftime("%Y-%m-%d %H:%M"), a.fecha.year, a.tipo,
                        a.categoria, a.motivo, "SI" if a.duplicado_de else "NO",
                        a.duplicado_de, a.hash, a.destino])

    dups = [a for a in archivos if a.duplicado_de]
    unicos = [a for a in archivos if not a.duplicado_de]
    por_cat = Counter(a.categoria for a in unicos)
    peso_cat = Counter()
    for a in unicos:
        peso_cat[a.categoria] += a.tamano
    por_anio = Counter(a.fecha.year for a in unicos)
    por_tipo = Counter(a.tipo for a in unicos)
    ahorro = sum(a.tamano for a in dups)

    def tabla(titulo: str, filas: list[tuple], cab: tuple) -> str:
        cuerpo = "".join("<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in fila) + "</tr>" for fila in filas)
        encab = "".join(f"<th>{c}</th>" for c in cab)
        return f"<h2>{titulo}</h2><table><thead><tr>{encab}</tr></thead><tbody>{cuerpo}</tbody></table>"

    top_dups = sorted(dups, key=lambda a: -a.tamano)[:100]
    revisar = [a for a in unicos if a.categoria == "99_POR_REVISAR"][:200]
    estado = "SIMULACIÓN — no se movió ningún archivo" if simulacion else "EJECUTADO — archivos movidos"
    html_doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Depuración del PC</title>
<style>
:root{{--bg:#fff;--fg:#1d1d1f;--mut:#666;--line:#ddd;--acc:#0b6e4f;--head:#f3f5f4}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151716;--fg:#e8e8e8;--mut:#9a9a9a;--line:#333;--acc:#4cc38a;--head:#1f2321}}}}
body{{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,Segoe UI,sans-serif;margin:0 auto;max-width:1100px;padding:24px 16px}}
h1{{margin:0 0 4px}} .est{{color:var(--acc);font-weight:600}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}}
.k{{border:1px solid var(--line);border-radius:10px;padding:12px}} .k b{{display:block;font-size:22px}} .k span{{color:var(--mut);font-size:13px}}
table{{border-collapse:collapse;width:100%;font-size:13px;display:block;overflow-x:auto}}
th,td{{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;white-space:nowrap}} th{{background:var(--head)}}
</style></head><body>
<h1>Depuración del PC</h1><div class="est">{estado}</div>
<div style="color:var(--mut)">Generado {datetime.now():%Y-%m-%d %H:%M} · Inventario completo: {html.escape(csv_path.name)}</div>
<div class="kpis">
<div class="k"><b>{len(archivos):,}</b><span>archivos analizados</span></div>
<div class="k"><b>{len(dups):,}</b><span>duplicados exactos</span></div>
<div class="k"><b>{mb(ahorro)}</b><span>espacio recuperable</span></div>
<div class="k"><b>{por_cat.get('99_POR_REVISAR', 0):,}</b><span>por revisar manualmente</span></div>
</div>
{tabla("Por categoría", [(c, f"{n:,}", mb(peso_cat[c])) for c, n in sorted(por_cat.items())], ("Categoría", "Archivos", "Tamaño"))}
{tabla("Por año (antigüedad)", [(y, f"{n:,}") for y, n in sorted(por_anio.items())], ("Año", "Archivos"))}
{tabla("Por tipo", por_tipo.most_common(), ("Tipo", "Archivos"))}
{tabla("Duplicados más pesados (top 100)", [(mb(a.tamano), a.ruta, a.duplicado_de) for a in top_dups], ("Tamaño", "Copia (se aparta)", "Original (se conserva)"))}
{tabla("Por revisar (primeros 200)", [(a.ruta.name, a.ruta.parent, a.motivo) for a in revisar], ("Archivo", "Carpeta", "Motivo"))}
</body></html>"""
    html_path = carpeta / f"resumen_{sello}.html"
    html_path.write_text(html_doc, encoding="utf-8")
    return csv_path, html_path


# ---------------------------------------------------------------------------
# Principal
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Organiza y depura el PC (SENA / Contabilidades / Estudios / Personal).")
    ap.add_argument("--origen", action="append", help="Carpeta a organizar (se puede repetir). Por defecto: Escritorio, Documentos, Descargas, Imágenes, Videos, Música y OneDrive.")
    ap.add_argument("--destino", help="Carpeta donde queda todo ordenado. Por defecto: <usuario>/PC_ORGANIZADO")
    ap.add_argument("--ejecutar", action="store_true", help="Aplica los movimientos (sin esto solo simula).")
    ap.add_argument("--borrar-duplicados", action="store_true", help="Elimina definitivamente la carpeta _DUPLICADOS al final (pide confirmación).")
    ap.add_argument("--sin-contenido", action="store_true", help="Clasifica solo por nombre y ruta (más rápido).")
    ap.add_argument("--limpiar-vacias", action="store_true", help="Borra carpetas que queden vacías en el origen.")
    ap.add_argument("--deshacer", metavar="LOG_CSV", help="Revierte una ejecución usando su log_movimientos_*.csv")
    args = ap.parse_args()

    if args.deshacer:
        deshacer(Path(args.deshacer))
        return 0

    origenes = [Path(o).expanduser() for o in args.origen] if args.origen else carpetas_por_defecto()
    origenes = [o for o in origenes if o.is_dir()]
    if not origenes:
        print("No se encontraron carpetas de origen.")
        return 1
    destino = Path(args.destino).expanduser() if args.destino else Path.home() / "PC_ORGANIZADO"
    sello = datetime.now().strftime("%Y%m%d_%H%M")
    carpeta_rep = destino / "_REPORTES"

    print("=" * 70)
    print(" ORGANIZADOR DE PC —", "EJECUCIÓN REAL" if args.ejecutar else "SIMULACIÓN (no mueve nada)")
    print("=" * 70)
    for o in origenes:
        print("  Origen :", o)
    print("  Destino:", destino)
    if PdfReader is None and not args.sin_contenido:
        print("  (Aviso: sin 'pypdf' los PDF se clasifican solo por nombre. Instalar: pip install pypdf)")

    print("\n[1/4] Recorriendo carpetas...")
    pares = recorrer(origenes, destino)
    archivos = [a for _, a in pares]
    print(f"   {len(archivos):,} archivos encontrados ({mb(sum(a.tamano for a in archivos))})")

    print("[2/4] Buscando duplicados exactos (SHA-256)...")
    marcar_duplicados(archivos)
    print(f"   {sum(1 for a in archivos if a.duplicado_de):,} duplicados")

    print("[3/4] Clasificando por categoría, año y tipo...")
    for i, (base, a) in enumerate(pares, 1):
        a.tipo = tipo_de(a.ruta)
        clasificar(a, base, leer=not args.sin_contenido and not a.duplicado_de)
        if i % 1000 == 0:
            print(f"   {i:,}/{len(pares):,}", flush=True)
    planificar(pares, destino)

    print("[4/4] Generando reportes...")
    carpeta_rep.mkdir(parents=True, exist_ok=True)
    if args.ejecutar:
        log = mover(archivos, carpeta_rep, sello)
        print("   Log para deshacer:", log)
        if args.limpiar_vacias:
            print(f"   Carpetas vacías eliminadas: {borrar_carpetas_vacias(origenes)}")
    csv_path, html_path = escribir_reportes(archivos, carpeta_rep, sello, simulacion=not args.ejecutar)
    print("   Inventario (Excel):", csv_path)
    print("   Resumen (navegador):", html_path)

    if args.ejecutar and args.borrar_duplicados:
        cuarentena = destino / "_DUPLICADOS"
        if cuarentena.exists():
            resp = input(f"\n¿Eliminar DEFINITIVAMENTE {cuarentena}? Escriba BORRAR para confirmar: ")
            if resp.strip() == "BORRAR":
                shutil.rmtree(cuarentena, ignore_errors=True)
                print("   Duplicados eliminados.")
            else:
                print("   Cancelado: los duplicados siguen en _DUPLICADOS.")

    if not args.ejecutar:
        print("\nRevise el resumen HTML y el inventario. Si todo está bien, ejecute de nuevo con --ejecutar")
    return 0


if __name__ == "__main__":
    sys.exit(main())
