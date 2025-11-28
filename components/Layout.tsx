import React, { useState } from 'react';
import { BookOpen, Table, PlusCircle, HelpCircle, Share2, X, Printer, QrCode, BarChart3 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'dashboard' | 'form' | 'analytics';
  onNavigate: (view: 'dashboard' | 'form' | 'analytics') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const [showShareModal, setShowShareModal] = useState(false);

  const handleDownloadManual = () => {
    const manualContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Manual de Usuario - Gestión Materiales SENA</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap');
          body { font-family: 'Roboto', sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px; background: #f9f9f9; }
          .container { background: white; padding: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 8px; }
          
          /* Header */
          header { border-bottom: 4px solid #39A900; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; }
          h1 { color: #39A900; font-size: 28px; margin: 0; }
          .subtitle { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          
          /* Typography */
          h2 { color: #2c3e50; margin-top: 40px; border-left: 6px solid #39A900; padding-left: 15px; font-size: 22px; background: #f4f4f4; py: 10px; }
          h3 { color: #2980b9; margin-top: 25px; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          p { margin-bottom: 15px; text-align: justify; }
          
          /* Components */
          .step-box { background: #fff; border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 15px; border-radius: 4px; border-left: 3px solid #ccc; }
          .step-number { font-weight: bold; color: #39A900; margin-right: 10px; }
          
          .btn-ref { display: inline-block; padding: 2px 8px; background: #eee; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85em; font-family: monospace; font-weight: bold; color: #333; }
          .btn-green { background: #e8f5e9; border-color: #a5d6a7; color: #1b5e20; }
          .btn-blue { background: #e3f2fd; border-color: #90caf9; color: #0d47a1; }
          .btn-purple { background: #f3e5f5; border-color: #ce93d8; color: #4a148c; }

          .note { background-color: #fff8e1; border: 1px solid #ffe082; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 0.95em; display: flex; gap: 10px; }
          .note::before { content: '💡'; font-size: 1.2em; }
          
          .warning { background-color: #ffebee; border: 1px solid #ef9a9a; padding: 15px; border-radius: 5px; margin: 20px 0; color: #c62828; }

          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; }
          th { background: #39A900; color: white; padding: 10px; text-align: left; }
          td { border: 1px solid #ddd; padding: 8px; }
          tr:nth-child(even) { background-color: #f2f2f2; }

          @media print {
            .no-print { display: none; }
            body { padding: 0; background: white; }
            .container { box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 100;">
          <button onclick="window.print()" style="padding: 12px 24px; background: #2c3e50; color: white; border: none; cursor: pointer; border-radius: 50px; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">🖨️ Imprimir Manual / Guardar PDF</button>
        </div>

        <div class="container">
          <header>
            <div>
              <h1>Gestión de Materiales de Formación</h1>
              <div class="subtitle">Manual de Usuario v2.0 - Actualizado</div>
            </div>
            <div style="text-align: right;">
              <span style="font-weight: bold; color: #333;">Coordinación Académica</span><br>
              <span style="font-size: 12px; color: #999;">Generado automáticamente</span>
            </div>
          </header>

          <p>Este documento guía a instructores y coordinadores en el uso de la herramienta para la recolección, consolidación y análisis de requerimientos de materiales de formación.</p>

          <div class="note">
            <b>Importante:</b> Esta aplicación guarda los datos en su navegador. Si trabaja desde diferentes computadores, use las funciones de "Exportar JSON" e "Importar JSON" para no perder información.
          </div>

          <h2>1. Rol: Instructor</h2>
          <p>Como instructor, su meta es registrar los materiales necesarios para sus fichas de formación y enviar el archivo digital al coordinador.</p>

          <h3>1.1. Crear Solicitudes de Materiales</h3>
          <div class="step-box">
            <span class="step-number">1.</span> Vaya a la pestaña <span class="btn-ref btn-green">Nuevo Registro</span>.<br>
            <span class="step-number">2.</span> Llene la <b>Información General</b>: Instructor, Programa (Regular, Vulnerable, etc.), Lote y Nombre de la Formación.<br>
            <span class="step-number">3.</span> Si su lote (ej. "Mecánica") no está en la lista, elija "AGREGAR OTRO" y escríbalo manualmente.
          </div>

          <h3>1.2. Cargar Materiales</h3>
          <p>Tiene dos opciones:</p>
          <ul>
            <li><b>Manual:</b> Botón "Agregar Manual". Ideal para pocos ítems.</li>
            <li><b>Masiva (Excel):</b> Botón "Importar CSV". Descargue la plantilla, llénela en Excel y guárdela como <i>CSV delimitado por comas</i>.</li>
          </ul>
          
          <div class="warning">
            <b>Evite Duplicados:</b> El sistema validará que no ingrese el mismo material dos veces en el mismo lote. Si ve una alerta roja, debe corregir el nombre o la descripción.
          </div>

          <h3>1.3. Enviar al Coordinador</h3>
          <p>Al finalizar:</p>
          <div class="step-box">
             <span class="step-number">1.</span> Verifique que su registro aparece en la tabla de "Consolidado".<br>
             <span class="step-number">2.</span> Haga clic en el botón azul <span class="btn-ref btn-blue">Guardar Archivo de Envío</span>.<br>
             <span class="step-number">3.</span> Se descargará un archivo <b>.json</b>. Envíe este archivo a su coordinador.
          </div>

          <h2>2. Rol: Coordinador</h2>
          <p>Su función es unificar la información de múltiples instructores y generar reportes de compras.</p>

          <h3>2.1. Consolidar Archivos</h3>
          <div class="step-box">
             <span class="step-number">1.</span> Recopile los archivos <b>.json</b> de los instructores.<br>
             <span class="step-number">2.</span> En la pestaña "Consolidado", pulse <span class="btn-ref btn-purple">Consolidar Archivos</span>.<br>
             <span class="step-number">3.</span> Seleccione todos los archivos a la vez. El sistema validará la cantidad de registros antes de importar.
          </div>

          <h3>2.2. Editar y Auditar</h3>
          <p>Una vez consolidados los datos, puede:</p>
          <ul>
            <li><b>Filtrar:</b> Use las listas desplegables superiores para filtrar por Programa o Lote.</li>
            <li><b>Editar:</b> Haga clic en una fila para ver los materiales. Use el icono de <b>Lápiz</b> para editar cantidades o descripciones, o la <b>Basura</b> para eliminar ítems innecesarios.</li>
          </ul>

          <h2>3. Análisis y Tablero de Control</h2>
          <p>La herramienta cuenta con un módulo avanzado de inteligencia de negocios en la pestaña <span class="btn-ref">Análisis</span>.</p>

          <h3>3.1. Modos de Visualización</h3>
          <p>Use las pestañas superiores dentro del módulo de análisis para cambiar de vista:</p>
          <ul>
            <li><b>General:</b> Gráficos de barras y torta mostrando totales generales.</li>
            <li><b>Matriz Programa vs Lote:</b> Tabla cruzada que muestra qué programas consumen qué categorías de materiales.</li>
            <li><b>Matriz Ficha vs Lote:</b> Detalle granular por curso.</li>
          </ul>

          <h3>3.2. Exportación de Datos</h3>
          <table>
            <thead>
              <tr>
                <th>Botón</th>
                <th>Función</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Descargar CSV (Verde)</b></td>
                <td>Ubicado en "Consolidado". Descarga el listado plano, ideal para cotizaciones.</td>
              </tr>
              <tr>
                <td><b>Datos Excel Tabla Dinámica</b></td>
                <td>Ubicado en "Análisis". Descarga una base de datos estructurada para crear tablas dinámicas propias en Excel.</td>
              </tr>
              <tr>
                <td><b>Imprimir / PDF</b></td>
                <td>Prepara una vista limpia de los gráficos y matrices para imprimir o guardar como PDF.</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Preguntas Frecuentes</h2>
          
          <h4>¿Por qué no carga mi archivo CSV?</h4>
          <p>Verifique que no haya cambiado los nombres de las columnas de la plantilla. Asegúrese de que el archivo esté guardado como "CSV UTF-8" para que soporte tildes.</p>

          <h4>¿Cómo imprimo los gráficos con colores?</h4>
          <p>Al dar clic en imprimir, busque en la configuración de su navegador la opción <b>"Gráficos de fondo"</b> (Background graphics) y actívela. De lo contrario, las barras saldrán blancas.</p>

        </div>
        <footer style="text-align: center; margin-top: 40px; color: #888; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
          SENA - Servicio Nacional de Aprendizaje
        </footer>
      </body>
      </html>
    `;

    const blob = new Blob([manualContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Enlace copiado al portapapeles.");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print:bg-white">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-[#39A900] p-2 rounded-lg text-white shadow-sm"> {/* SENA Green-ish */}
                <BookOpen size={24} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-slate-800 leading-tight">Gestión de Materiales</h1>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Coordinación Académica</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={handleDownloadManual}
                className="hidden md:flex items-center text-slate-500 hover:text-[#39A900] transition-colors text-xs font-medium px-2 py-1"
                title="Descargar Manual de Usuario"
              >
                <HelpCircle size={18} className="mr-1" />
                Manual
              </button>

              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

              <button
                onClick={() => onNavigate('dashboard')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'dashboard'
                    ? 'bg-green-50 text-[#39A900] ring-1 ring-green-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Table size={18} className="mr-2" />
                <span className="hidden sm:inline">Consolidado</span>
              </button>
              
              <button
                onClick={() => onNavigate('analytics')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'analytics'
                    ? 'bg-green-50 text-[#39A900] ring-1 ring-green-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <BarChart3 size={18} className="mr-2" />
                <span className="hidden sm:inline">Análisis</span>
              </button>

              <button
                onClick={() => onNavigate('form')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  currentView === 'form'
                    ? 'bg-[#39A900] text-white shadow-md transform scale-105'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                }`}
              >
                <PlusCircle size={18} className="mr-2" />
                <span className="hidden sm:inline">Nuevo Registro</span>
              </button>
              
               <button
                onClick={handleShare}
                className="ml-2 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Compartir Aplicación"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 print:p-0 print:max-w-none">
        {children}
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-[#39A900] p-4 flex justify-between items-center text-white">
                 <h3 className="font-bold flex items-center gap-2">
                    <Share2 size={20}/> Compartir Herramienta
                 </h3>
                 <button onClick={() => setShowShareModal(false)} className="hover:text-green-200">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-6 text-center space-y-6">
                 <p className="text-sm text-slate-600">
                    Comparta este enlace con los instructores para que puedan ingresar sus materiales.
                 </p>
                 
                 <div className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center gap-2 border border-slate-200">
                    <QrCode size={64} className="text-slate-800"/>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Escanear para abrir</span>
                 </div>

                 <div className="flex gap-2">
                    <input 
                        type="text" 
                        readOnly 
                        value={window.location.href} 
                        className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-slate-50 text-slate-500"
                    />
                    <button 
                        onClick={copyLink}
                        className="bg-slate-800 text-white text-xs px-3 py-1 rounded hover:bg-slate-700 font-bold"
                    >
                        Copiar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};