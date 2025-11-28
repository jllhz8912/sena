import React, { useState, useRef } from 'react';
import { TrainingRequest, LOT_TYPES, Material, UNIT_TYPES, PROGRAM_TYPES } from '../types';
import { Download, Search, Trash2, Database, ChevronDown, ChevronUp, Edit, X, Filter, Save, Image as ImageIcon, BookOpen, FileJson, UploadCloud, FileCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface RequestListProps {
  requests: TrainingRequest[];
  onDelete: (id: string) => void;
  onDeleteMaterial: (requestId: string, materialId: string) => void;
  onUpdateMaterial: (requestId: string, material: Material) => void;
  onEditGroup: (request: TrainingRequest) => void;
  onClearAll: () => void;
  onConsolidate: (requests: TrainingRequest[]) => void;
}

interface ConsolidationStats {
  filesCount: number;
  requestsCount: number;
  materialsCount: number;
  data: TrainingRequest[];
}

export const RequestList: React.FC<RequestListProps> = ({ requests, onDelete, onDeleteMaterial, onUpdateMaterial, onEditGroup, onClearAll, onConsolidate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLot, setSelectedLot] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Inline Editing State
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Material | null>(null);
  
  // Consolidation Preview State
  const [consolidationPreview, setConsolidationPreview] = useState<ConsolidationStats | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Merge predefined lots with any custom lots found in requests to ensure filter list is complete
  const availableLots = Array.from(new Set([
    ...LOT_TYPES, 
    ...requests.map(r => r.lotType)
  ])).sort();

  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.instructorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.trainingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.lotType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLot = selectedLot === '' || r.lotType === selectedLot;
    const matchesProgram = selectedProgram === '' || r.programType === selectedProgram;

    return matchesSearch && matchesLot && matchesProgram;
  });

  const totalMaterials = filteredRequests.reduce((acc, curr) => acc + curr.materials.length, 0);

  const startEdit = (material: Material) => {
    setEditingMaterialId(material.id);
    setEditValues({ ...material });
  };

  const cancelEdit = () => {
    setEditingMaterialId(null);
    setEditValues(null);
  };

  const saveEdit = (requestId: string) => {
    if (editValues) {
      if (!editValues.codeName || !editValues.unitOfMeasure || !editValues.technicalDescription) {
        alert("El nombre, unidad y descripción son obligatorios.");
        return;
      }
      onUpdateMaterial(requestId, editValues);
      setEditingMaterialId(null);
      setEditValues(null);
    }
  };

  const handleEditChange = (field: keyof Material, value: string) => {
    if (editValues) {
      setEditValues({ ...editValues, [field]: value });
    }
  };

  const handleEditImageUpload = (file: File | null) => {
    if (!file || !editValues) return;
    if (file.size > 1024 * 1024) {
       alert("La imagen es muy grande (Max 1MB)");
       return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditValues({ ...editValues, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // --- EXPORT JSON (Instructor sends to Coordinator) ---
  const handleExportJSON = () => {
    if (requests.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    const dataStr = JSON.stringify(requests, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    // Filename convention helps identifying the file
    link.download = `SENA_Envio_Materiales_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- IMPORT JSON (Coordinator consolidates files) ---
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Explicitly type 'file' as File
    const promises = Array.from(files).map((file: File) => new Promise<TrainingRequest[]>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (Array.isArray(json)) {
                    // Basic validation check
                    const validItems = json.filter((r: any) => r.id && r.materials);
                    resolve(validItems);
                } else {
                    resolve([]);
                }
            } catch (err) {
                console.error("Error leyendo JSON", err);
                resolve([]);
            }
        };
        reader.readAsText(file);
    }));

    Promise.all(promises).then((results) => {
        // Flatten results
        const rawRequests = results.flat();
        
        // CRITICAL: Regenerate IDs to prevent collisions when importing the same file multiple times
        // This ensures every import is treated as a unique set of records that can be edited independently.
        const allNewRequests = rawRequests.map(req => ({
            ...req,
            id: crypto.randomUUID(), // New Request ID
            materials: req.materials.map((m: Material) => ({
                ...m,
                id: crypto.randomUUID() // New Material ID
            }))
        }));
        
        if (allNewRequests.length > 0) {
            // Calculate Stats for Validation Modal
            const totalMats = allNewRequests.reduce((acc, req) => acc + req.materials.length, 0);
            
            setConsolidationPreview({
                filesCount: files.length,
                requestsCount: allNewRequests.length,
                materialsCount: totalMats,
                data: allNewRequests
            });
        } else {
            alert("⚠️ No se encontraron registros válidos en los archivos seleccionados. Asegúrese de que sean archivos JSON generados por esta herramienta.");
        }
        if (jsonInputRef.current) jsonInputRef.current.value = '';
    });
  };

  const confirmConsolidation = () => {
    if (consolidationPreview) {
        onConsolidate(consolidationPreview.data);
        alert(`✅ Proceso Completado.\n\nSe han integrado ${consolidationPreview.materialsCount} materiales al consolidado general. Ahora puede editarlos o eliminarlos individualmente si es necesario.`);
        setConsolidationPreview(null);
    }
  };

  const downloadCSV = () => {
    // Flatten data logic based on filtered requests
    const headers = [
      'Fecha',
      'Instructor',
      'Programa',
      'Lote',
      'Formación',
      'Código UNSPSC',
      'Nombre Material',
      'Descripción Técnica',
      'Unidad Medida',
      'ID Material',
      'Imagen (Data/URL)'
    ];

    const rows = filteredRequests.flatMap(req => 
      req.materials.map(mat => [
        new Date(req.createdAt).toLocaleDateString(),
        `"${req.instructorName}"`,
        `"${req.programType}"`,
        `"${req.lotType}"`,
        `"${req.trainingName}"`,
        `"${mat.unspscCode || ''}"`,
        `"${mat.codeName}"`,
        `"${mat.technicalDescription.replace(/"/g, '""')}"`, // Escape quotes
        `"${mat.unitOfMeasure}"`,
        mat.id,
        `"${mat.imageUrl || ''}"` // Include image data
      ].join(','))
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Consolidado_Materiales_SENA_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-slate-200 relative">
        <Database size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900">Base de Datos Vacía</h3>
        <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">
          Los instructores pueden comenzar a diligenciar sus requerimientos desde "Nuevo Registro". 
          <br/>
          Si eres el <b>Coordinador</b>, carga aquí los archivos recibidos.
        </p>
        
        <input 
            type="file" 
            ref={jsonInputRef}
            onChange={handleImportJSON}
            accept=".json" 
            multiple
            className="hidden" 
        />
        <button 
            onClick={() => jsonInputRef.current?.click()}
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-lg transition-transform transform hover:scale-105"
        >
            <UploadCloud size={20} className="mr-2"/>
            Consolidar Archivos (JSON)
        </button>

        {/* Validation Modal inside Empty State too */}
        {consolidationPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileCheck size={24} className="text-purple-600"/>
                        Validar Consolidación
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-purple-700 font-medium">Archivos Seleccionados:</span>
                            <span className="bg-white px-2 py-1 rounded border border-purple-200 font-bold text-slate-800">{consolidationPreview.filesCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-purple-700 font-medium">Registros a Importar:</span>
                            <span className="bg-white px-2 py-1 rounded border border-purple-200 font-bold text-slate-800">{consolidationPreview.requestsCount}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-purple-200 mt-2">
                            <span className="font-bold text-purple-900">Total Materiales Nuevos:</span>
                            <span className="text-lg font-black text-[#39A900]">{consolidationPreview.materialsCount}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 flex items-start gap-2 bg-slate-50 p-2 rounded">
                         <AlertCircle size={14} className="mt-0.5"/>
                         Los datos se agregarán como nuevos registros independientes, permitiendo su edición posterior.
                    </p>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={() => setConsolidationPreview(null)}
                        className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-white text-sm font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmConsolidation}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm text-sm font-medium flex items-center"
                    >
                        <UploadCloud size={16} className="mr-2"/>
                        Confirmar y Consolidar
                    </button>
                </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={32} />
            </button>
            <img 
              src={previewImage} 
              alt="Vista previa" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* CONSOLIDATION VALIDATION MODAL */}
      {consolidationPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileCheck size={24} className="text-purple-600"/>
                        Validar Consolidación
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-slate-600 text-sm">
                        Está a punto de agregar nuevos datos al consolidado existente.
                    </p>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-purple-700 font-medium">Archivos Seleccionados:</span>
                            <span className="bg-white px-2 py-1 rounded border border-purple-200 font-bold text-slate-800">{consolidationPreview.filesCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-purple-700 font-medium">Registros a Importar:</span>
                            <span className="bg-white px-2 py-1 rounded border border-purple-200 font-bold text-slate-800">{consolidationPreview.requestsCount}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-purple-200 mt-2">
                            <span className="font-bold text-purple-900">Total Materiales Nuevos:</span>
                            <span className="text-lg font-black text-[#39A900]">{consolidationPreview.materialsCount}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={() => setConsolidationPreview(null)}
                        className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-white text-sm font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmConsolidation}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm text-sm font-medium flex items-center"
                    >
                        <UploadCloud size={16} className="mr-2"/>
                        Confirmar y Consolidar
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* Stats and MAIN ACTIONS TOOLBAR */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        
        {/* Top Row: Stats & Primary Actions */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-2">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">{totalMaterials}</h2>
                <p className="text-sm text-slate-500 font-medium">Materiales totales en base de datos</p>
            </div>

            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                 {/* Hidden Input for Import */}
                <input 
                    type="file" 
                    ref={jsonInputRef}
                    onChange={handleImportJSON}
                    accept=".json" 
                    multiple
                    className="hidden" 
                />

                {/* 1. Send / Export */}
                <button
                    onClick={handleExportJSON}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium shadow-sm"
                >
                    <FileJson size={20} className="mr-2" />
                    <div className="text-left">
                        <span className="block text-xs uppercase font-bold opacity-70">Instructor</span>
                        Guardar Archivo
                    </div>
                </button>

                {/* 2. Consolidate / Import */}
                <button
                    onClick={() => jsonInputRef.current?.click()}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-3 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium shadow-sm"
                >
                    <UploadCloud size={20} className="mr-2" />
                    <div className="text-left">
                        <span className="block text-xs uppercase font-bold opacity-70">Coordinador</span>
                        Consolidar
                    </div>
                </button>

                {/* 3. CSV Download */}
                <button
                    onClick={downloadCSV}
                    className="flex-1 lg:flex-none flex items-center justify-center px-4 py-3 bg-[#39A900] text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                    <Download size={20} className="mr-2" />
                     <div className="text-left">
                        <span className="block text-xs uppercase font-bold opacity-70">Reporte</span>
                        Descargar CSV
                    </div>
                </button>
            </div>
        </div>

        {/* Bottom Row: Reset */}
        <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
             <button
                onClick={onClearAll}
                className="text-xs text-red-500 hover:text-red-700 flex items-center hover:bg-red-50 px-2 py-1 rounded transition-colors"
             >
                <Trash2 size={14} className="mr-1"/>
                Limpiar Base de Datos Local
             </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
        <div className="sm:col-span-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-[#39A900] focus:border-[#39A900] sm:text-sm"
            placeholder="Buscar por instructor, formación, lote..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="sm:col-span-3 relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <BookOpen className="h-4 w-4 text-slate-400" />
            </div>
             <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#39A900] focus:border-[#39A900] sm:text-sm appearance-none"
             >
                 <option value="">Todos los Programas</option>
                 {PROGRAM_TYPES.map(prog => (
                     <option key={prog} value={prog}>{prog}</option>
                 ))}
             </select>
             <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
        </div>

        <div className="sm:col-span-3 relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-slate-400" />
            </div>
             <select
                value={selectedLot}
                onChange={(e) => setSelectedLot(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#39A900] focus:border-[#39A900] sm:text-sm appearance-none"
             >
                 <option value="">Todos los Lotes</option>
                 {availableLots.map(lot => (
                     <option key={lot} value={lot}>{lot}</option>
                 ))}
             </select>
             <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
        {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
                No se encontraron registros que coincidan con los filtros.
            </div>
        ) : (
        <ul className="divide-y divide-slate-200">
          {filteredRequests.map((request) => (
            <li key={request.id} className="bg-white">
              <div className="px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setExpandedRow(expandedRow === request.id ? null : request.id)}
                >
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div>
                        <p className="text-sm font-medium text-[#39A900] truncate">{request.instructorName}</p>
                        <p className="text-xs text-slate-500">Instructor</p>
                    </div>
                    <div>
                        <div className="flex flex-col gap-1 items-start">
                             <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${request.programType === selectedProgram ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                                {request.programType}
                             </span>
                             <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${request.lotType === selectedLot ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                {request.lotType}
                             </span>
                        </div>
                    </div>
                    <div>
                         <p className="text-sm text-slate-800">{request.trainingName}</p>
                         <p className="text-xs text-slate-500">Formación</p>
                    </div>
                    <div className="flex items-center justify-between">
                         <div className="text-sm text-slate-500">
                            {request.materials.length} materiales
                         </div>
                         <div className="text-slate-400 flex items-center gap-2">
                             {expandedRow !== request.id && (
                                <span className="text-[10px] uppercase font-bold text-slate-300 group-hover:text-[#39A900] transition-colors">Ver Detalles</span>
                             )}
                             {expandedRow === request.id ? <ChevronUp size={20}/> : <ChevronDown size={20} />}
                         </div>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedRow === request.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4 bg-slate-50 -mx-4 px-4 sm:-mx-6 sm:px-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-3">
                         <div className="flex items-center gap-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Edit size={12} />
                                Edición Habilitada
                            </h4>
                         </div>
                         <div className="flex gap-2">
                             <button 
                                onClick={(e) => { e.stopPropagation(); onEditGroup(request); }}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded border border-blue-200"
                             >
                                 <Edit size={12} className="mr-1"/> Editar Grupo Completo
                             </button>
                             <button 
                                onClick={(e) => { e.stopPropagation(); onDelete(request.id); }}
                                className="text-xs text-red-600 hover:text-red-800 flex items-center bg-red-50 px-2 py-1 rounded border border-red-200"
                             >
                                 <Trash2 size={12} className="mr-1"/> Eliminar Grupo
                             </button>
                         </div>
                    </div>
                    
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase w-24">Acciones</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase w-32">UNSPSC</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase w-48">Nombre</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase w-32">Unidad</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase min-w-[200px]">Descripción</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase w-16">Img</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {request.materials.map(mat => {
                                    const isEditing = editingMaterialId === mat.id;
                                    
                                    return (
                                    <tr key={mat.id} className={`group ${isEditing ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                           {isEditing ? (
                                             <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => saveEdit(request.id)}
                                                  className="text-white bg-green-600 hover:bg-green-700 p-1 rounded shadow-sm transition-colors"
                                                  title="Guardar cambios"
                                                >
                                                  <Save size={14} />
                                                </button>
                                                <button
                                                  onClick={cancelEdit}
                                                  className="text-white bg-red-500 hover:bg-red-600 p-1 rounded shadow-sm transition-colors"
                                                  title="Cancelar edición"
                                                >
                                                  <X size={14} />
                                                </button>
                                             </div>
                                           ) : (
                                              <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startEdit(mat); }}
                                                    className="text-slate-400 hover:text-blue-500 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                                    title="Editar este ítem"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteMaterial(request.id, mat.id); }}
                                                    className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                    title="Eliminar este ítem"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                              </div>
                                           )}
                                        </td>
                                        
                                        {/* Columns */}
                                        <td className="px-3 py-2 font-mono text-slate-600 text-xs align-top">
                                          {isEditing && editValues ? (
                                            <input 
                                                type="text" 
                                                className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={editValues.unspscCode || ''}
                                                onChange={(e) => handleEditChange('unspscCode', e.target.value)}
                                                placeholder="Código"
                                            />
                                          ) : (
                                            mat.unspscCode || <span className="text-slate-300 italic">N/A</span>
                                          )}
                                        </td>

                                        <td className="px-3 py-2 font-medium text-slate-800 align-top">
                                           {isEditing && editValues ? (
                                            <textarea 
                                                className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-y min-h-[2.5rem]"
                                                value={editValues.codeName}
                                                onChange={(e) => handleEditChange('codeName', e.target.value)}
                                                placeholder="Nombre material *"
                                            />
                                          ) : mat.codeName}
                                        </td>

                                        <td className="px-3 py-2 text-slate-600 align-top">
                                           {isEditing && editValues ? (
                                            <select 
                                                className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={editValues.unitOfMeasure}
                                                onChange={(e) => handleEditChange('unitOfMeasure', e.target.value)}
                                            >
                                                {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                          ) : mat.unitOfMeasure}
                                        </td>

                                        <td className="px-3 py-2 text-slate-600 align-top">
                                           {isEditing && editValues ? (
                                            <textarea 
                                                className="w-full border border-blue-300 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-y min-h-[4rem]"
                                                value={editValues.technicalDescription}
                                                onChange={(e) => handleEditChange('technicalDescription', e.target.value)}
                                                placeholder="Descripción técnica detallada *"
                                            />
                                          ) : (
                                            <div className="max-w-md truncate" title={mat.technicalDescription}>{mat.technicalDescription}</div>
                                          )}
                                        </td>

                                        <td className="px-3 py-2 align-top">
                                            {isEditing && editValues ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    {editValues.imageUrl && (
                                                        <img src={editValues.imageUrl} className="h-8 w-8 object-cover rounded border border-blue-200" alt="preview" />
                                                    )}
                                                    <label className="cursor-pointer text-[10px] text-blue-600 underline hover:text-blue-800">
                                                        {editValues.imageUrl ? 'Cambiar' : 'Subir'}
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="image/*"
                                                            onChange={(e) => handleEditImageUpload(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                </div>
                                            ) : (
                                                mat.imageUrl ? (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(mat.imageUrl!); }}
                                                        className="text-[#39A900] hover:text-green-700 transition-colors"
                                                    >
                                                        <img src={mat.imageUrl} alt="mat" className="h-8 w-8 object-cover rounded border border-slate-200" />
                                                    </button>
                                                ) : <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  );
};