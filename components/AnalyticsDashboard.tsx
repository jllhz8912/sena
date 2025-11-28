import React, { useMemo, useState } from 'react';
import { TrainingRequest, LOT_TYPES, PROGRAM_TYPES } from '../types';
import { BarChart3, Package, Users, FileText, Layers, PieChart, Printer, Download, Table, Grid, ListFilter, AlertCircle } from 'lucide-react';

interface AnalyticsDashboardProps {
  requests: TrainingRequest[];
}

type AnalysisMode = 'general' | 'program-lot' | 'course-lot';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ requests }) => {
  const [mode, setMode] = useState<AnalysisMode>('general');

  const stats = useMemo(() => {
    const totalRequests = requests.length;
    const totalMaterials = requests.reduce((acc, r) => acc + r.materials.length, 0);
    const uniqueInstructors = new Set(requests.map(r => r.instructorName.trim().toLowerCase())).size;

    // 1. Agrupar por Lote
    const materialsByLot: Record<string, number> = {};
    requests.forEach(r => {
      const count = r.materials.length;
      const lotName = r.lotType || 'Sin Lote';
      materialsByLot[lotName] = (materialsByLot[lotName] || 0) + count;
    });

    const sortedLots = Object.entries(materialsByLot)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalMaterials > 0 ? (count / totalMaterials) * 100 : 0
      }));

    // 2. Agrupar por Programa
    const materialsByProgram: Record<string, number> = {};
    requests.forEach(r => {
      const count = r.materials.length;
      const progName = r.programType || 'Sin Programa';
      materialsByProgram[progName] = (materialsByProgram[progName] || 0) + count;
    });

    const sortedPrograms = Object.entries(materialsByProgram)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalMaterials > 0 ? (count / totalMaterials) * 100 : 0
      }));

    return { 
        totalRequests, 
        totalMaterials, 
        uniqueInstructors, 
        sortedLots, 
        sortedPrograms,
    };
  }, [requests]);

  // --- MATRIX GENERATION LOGIC ---
  
  const generateMatrix = (rowKey: 'programType' | 'trainingName') => {
    // 1. Get all unique Lots (Columns)
    const allLots = Array.from(new Set(requests.map(r => r.lotType))).sort();
    
    // 2. Get all unique Rows (Programs or Courses)
    // Explicitly casting to string to avoid 'unknown' inference
    const allRows: string[] = Array.from(new Set(requests.map(r => String(r[rowKey])))).sort();

    // 3. Build Matrix
    // Structure: { "ProgramName": { "LotName": count, "Total": count } }
    const matrix: Record<string, Record<string, number>> = {};

    allRows.forEach(rowName => {
        matrix[rowName] = { total: 0 };
        allLots.forEach(lotName => {
            matrix[rowName][lotName] = 0;
        });
    });

    requests.forEach(req => {
        const rowVal = String(req[rowKey]);
        const colVal = req.lotType;
        const count = req.materials.length;

        if (matrix[rowVal]) {
            matrix[rowVal][colVal] = (matrix[rowVal][colVal] || 0) + count;
            matrix[rowVal].total += count;
        }
    });

    return { allLots, allRows, matrix };
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleDownloadPivotCSV = () => {
    // Generates a granular dataset perfect for Excel Pivot Tables
    const headers = [
        "ID_Solicitud",
        "Instructor",
        "Programa_Formacion",
        "Lote_Categoria",
        "Nombre_Curso_Ficha",
        "Cantidad_Materiales",
        "Fecha_Registro"
    ];

    const rows = requests.map(req => [
        req.id,
        `"${req.instructorName}"`,
        `"${req.programType}"`,
        `"${req.lotType}"`,
        `"${req.trainingName}"`,
        req.materials.length,
        new Date(req.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Datos_Tablas_Dinamicas_SENA_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (requests.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border border-slate-200 shadow-sm text-center p-8">
            <BarChart3 size={48} className="text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-800">Sin datos para analizar</h3>
            <p className="text-slate-500">Agregue registros o consolide archivos para ver las estadísticas.</p>
        </div>
    );
  }

  // Render Matrix Table Helper
  const renderMatrixTable = (title: string, data: { allLots: string[], allRows: string[], matrix: Record<string, Record<string, number>> }, rowLabel: string) => (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden print:border print:shadow-none print:break-inside-avoid">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 print:bg-white flex justify-between items-center">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <Grid size={20} className="text-[#39A900]"/>
                 {title}
             </h3>
             <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded hidden sm:inline-block">
                Valores = Cantidad de Materiales
             </span>
        </div>
        <div className="overflow-x-auto max-h-[70vh] print:max-h-none print:overflow-visible">
            <table className="min-w-full divide-y divide-slate-200 text-sm border-collapse">
                <thead className="bg-slate-50 print:bg-slate-100 sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-300 min-w-[200px] bg-slate-50">
                            {rowLabel}
                        </th>
                        {data.allLots.map(lot => (
                            <th key={lot} className="px-2 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wider border-l border-slate-200 min-w-[100px] bg-slate-50">
                                {lot}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-center font-black text-slate-800 uppercase tracking-wider border-l-2 border-slate-300 bg-slate-100 min-w-[80px]">
                            TOTAL
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {data.allRows.map((rowName, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 print:break-inside-avoid">
                            <td className="px-4 py-2 font-medium text-slate-900 border-r border-slate-200 sticky left-0 bg-white">
                                {rowName}
                            </td>
                            {data.allLots.map(lot => {
                                const val = data.matrix[rowName][lot];
                                return (
                                    <td key={lot} className={`px-2 py-2 text-center border-r border-slate-100 ${val > 0 ? 'bg-green-50 text-green-800 font-bold' : 'text-slate-300'}`}>
                                        {val > 0 ? val : '-'}
                                    </td>
                                );
                            })}
                            <td className="px-4 py-2 text-center font-black text-slate-800 bg-slate-50 border-l border-slate-200">
                                {data.matrix[rowName].total}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 print:static">
                    <tr>
                        <td className="px-4 py-3 text-right text-slate-700 border-t-2 border-slate-300">TOTALES:</td>
                        {data.allLots.map(lot => {
                             const colTotal = data.allRows.reduce((acc, r) => acc + (data.matrix[r][lot] || 0), 0);
                             return (
                                <td key={lot} className="px-2 py-3 text-center text-slate-800 border-t-2 border-slate-300 border-l border-slate-200">
                                    {colTotal}
                                </td>
                             );
                        })}
                        <td className="px-4 py-3 text-center text-white bg-slate-800 border-t-2 border-slate-800">
                             {stats.totalMaterials}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 print:space-y-8">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 print:hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="text-[#39A900]" />
                    Tablero de Gestión Académica
                </h2>
                <p className="text-sm text-slate-500">Seleccione el modo de análisis para visualizar los datos.</p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
                <button 
                    onClick={handleDownloadPivotCSV}
                    className="flex items-center px-4 py-2 bg-green-50 border border-green-200 text-green-800 rounded hover:bg-green-100 text-sm font-medium shadow-sm transition-colors"
                    title="Formato ideal para Tablas Dinámicas"
                >
                    <Table size={16} className="mr-2"/>
                    Datos Excel (Tabla Dinámica)
                </button>
                <button 
                    onClick={handlePrintReport}
                    className="flex items-center px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 text-sm font-medium shadow-sm transition-colors"
                >
                    <Printer size={16} className="mr-2"/>
                    Imprimir / Guardar PDF
                </button>
            </div>
          </div>

          {/* Analysis Mode Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-lg self-start">
             <button
                onClick={() => setMode('general')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${mode === 'general' ? 'bg-white text-[#39A900] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                General
             </button>
             <button
                onClick={() => setMode('program-lot')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${mode === 'program-lot' ? 'bg-white text-[#39A900] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Matriz: Programa vs Lote
             </button>
             <button
                onClick={() => setMode('course-lot')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${mode === 'course-lot' ? 'bg-white text-[#39A900] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Matriz: Ficha/Curso vs Lote
             </button>
          </div>
      </div>

      {/* Print Header (Visible only when printing) */}
      <div className="hidden print:block border-b-2 border-[#39A900] pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Reporte de Análisis de Materiales SENA</h1>
          <p className="text-sm text-slate-500">
             Vista: {mode === 'general' ? 'Resumen General' : mode === 'program-lot' ? 'Matriz Programa vs Lote' : 'Matriz Cursos vs Lote'}
             <span className="mx-2">|</span>
             Generado: {new Date().toLocaleDateString()}
          </p>
      </div>

      {/* CONTENT BASED ON MODE */}
      
      {mode === 'general' && (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center gap-4 print:border print:shadow-none">
                    <div className="p-4 bg-green-100 text-green-700 rounded-full print:bg-white print:text-black print:p-0">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-medium">Total Materiales</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.totalMaterials}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center gap-4 print:border print:shadow-none">
                    <div className="p-4 bg-indigo-100 text-indigo-700 rounded-full print:bg-white print:text-black print:p-0">
                        <FileText size={24} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-medium">Solicitudes/Fichas</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.totalRequests}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center gap-4 print:border print:shadow-none">
                    <div className="p-4 bg-orange-100 text-orange-700 rounded-full print:bg-white print:text-black print:p-0">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-medium">Instructores Activos</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.uniqueInstructors}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Chart 1: Materials by Lot */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 print:shadow-none print:border print:break-inside-avoid">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Layers size={20} className="text-slate-500"/>
                        Distribución por Lote
                    </h3>
                    <div className="space-y-4">
                        {stats.sortedLots.map((lot, idx) => (
                            <div key={idx} className="print:break-inside-avoid">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700 truncate pr-2">{lot.name}</span>
                                    <span className="text-slate-500">{lot.count} ({lot.percent.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden print:border print:border-slate-200">
                                    <div 
                                        className="bg-[#39A900] h-2.5 rounded-full print:bg-black print:text-black" 
                                        style={{ width: `${lot.percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chart 2: Materials by Program */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 print:shadow-none print:border print:break-inside-avoid">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart size={20} className="text-slate-500"/>
                        Distribución por Programa
                    </h3>
                    <div className="space-y-4">
                        {stats.sortedPrograms.map((prog, idx) => (
                            <div key={idx} className="print:break-inside-avoid">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700">{prog.name}</span>
                                    <span className="text-slate-500">{prog.count} ({prog.percent.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden print:border print:border-slate-200">
                                    <div 
                                        className="bg-indigo-600 h-2.5 rounded-full print:bg-black print:text-black" 
                                        style={{ width: `${prog.percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {mode === 'program-lot' && (
         renderMatrixTable("Matriz: Programa de Formación vs Lotes", generateMatrix('programType'), "Programa")
      )}

      {mode === 'course-lot' && (
         renderMatrixTable("Matriz: Curso/Ficha vs Lotes", generateMatrix('trainingName'), "Nombre Curso / Ficha")
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm text-blue-800 print:hidden mt-8">
          <AlertCircle className="shrink-0" size={20}/>
          <div>
              <p className="font-bold">Consejo para impresión:</p>
              <p>Si los colores de fondo de las tablas no aparecen al imprimir, asegúrese de marcar la opción <b>"Gráficos de fondo"</b> (Background graphics) en la ventana de configuración de impresión de su navegador.</p>
          </div>
      </div>
    </div>
  );
};