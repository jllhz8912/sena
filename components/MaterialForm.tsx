import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Wand2, Upload, AlertTriangle, Save, PlusCircle, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, Download, X, Eye, HelpCircle, FileQuestion, Layers } from 'lucide-react';
import { TrainingRequest, Material, LOT_TYPES, UNIT_TYPES, ProgramType, PROGRAM_TYPES } from '../types';
import { generateTechnicalDescription, suggestUNSPSC } from '../services/geminiService';

interface MaterialFormProps {
  onSubmit: (request: TrainingRequest) => void;
  onBulkSubmit?: (requests: TrainingRequest[]) => void;
  existingRequests: TrainingRequest[];
  onCancel: () => void;
  initialData?: TrainingRequest;
}

interface ImportGroup {
  header: {
    instructor: string;
    program: ProgramType | '';
    lot: string;
    isCustomLot: boolean;
    customLot: string;
    training: string;
  };
  materials: Material[];
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ onSubmit, onBulkSubmit, existingRequests, onCancel, initialData }) => {
  // General Info State
  const [programType, setProgramType] = useState<ProgramType | ''>('');
  const [lotType, setLotType] = useState<string>('');
  const [customLotType, setCustomLotType] = useState('');
  const [isCustomLot, setIsCustomLot] = useState(false);
  const [trainingName, setTrainingName] = useState('');
  const [instructorName, setInstructorName] = useState('');

  // Materials State
  const [materials, setMaterials] = useState<Material[]>([
    { id: crypto.randomUUID(), unspscCode: '', codeName: '', technicalDescription: '', unitOfMeasure: '' }
  ]);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<string | null>(null);
  
  // Import Preview State - Now supports multiple groups
  const [importPreviewGroups, setImportPreviewGroups] = useState<ImportGroup[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form if editing
  useEffect(() => {
    if (initialData) {
      setInstructorName(initialData.instructorName);
      setProgramType(initialData.programType);
      setTrainingName(initialData.trainingName);
      setMaterials(initialData.materials);
      
      // Auto expand the first one if editing
      if (initialData.materials.length > 0) {
        setExpandedMaterialId(initialData.materials[0].id);
      }

      if (LOT_TYPES.includes(initialData.lotType as any)) {
        setLotType(initialData.lotType);
        setIsCustomLot(false);
      } else {
        setLotType(''); 
        setCustomLotType(initialData.lotType);
        setIsCustomLot(true);
      }
    } else {
        // New form, expand the first empty material
        if (materials.length > 0) {
            setExpandedMaterialId(materials[0].id);
        }
    }
  }, [initialData]);

  // Derived state for existing items in this lot (excluding current editing request)
  const finalLot = isCustomLot ? customLotType : lotType;
  
  const existingItemsInLot = existingRequests
    .filter(r => r.lotType === finalLot && r.id !== initialData?.id)
    .flatMap(r => r.materials);

  // Check for duplicates within current form state AND database
  const isDuplicate = (name: string, desc: string, currentId: string) => {
    const cleanName = name.toLowerCase().trim();
    const cleanDesc = desc.toLowerCase().trim();
    
    if (!cleanName && !cleanDesc) return false;

    // 1. Check against Database (Existing requests in same lot)
    const inDatabase = existingItemsInLot.some(m => 
      (m.codeName.toLowerCase().trim() === cleanName && cleanName !== '') || 
      (m.technicalDescription.toLowerCase().trim() === cleanDesc && cleanDesc !== '')
    );

    // 2. Check against Current Form (prevent adding the same item twice in the current list)
    const inCurrentForm = materials.some(m => 
        m.id !== currentId && // Don't compare with self
        (
            (m.codeName.toLowerCase().trim() === cleanName && cleanName !== '') ||
            (m.technicalDescription.toLowerCase().trim() === cleanDesc && cleanDesc !== '')
        )
    );

    return inDatabase || inCurrentForm;
  };

  const isFormValid = () => {
    if (!instructorName || !trainingName || !programType || !finalLot) return false;
    
    // Check mandatory fields for ALL materials AND ensure no duplicates
    const materialsValid = materials.every(m => 
        m.codeName.trim() !== '' &&
        m.unitOfMeasure.trim() !== '' &&
        m.technicalDescription.trim() !== '' &&
        !isDuplicate(m.codeName, m.technicalDescription, m.id)
    );
    
    return materialsValid && materials.length > 0;
  };

  const handleAddMaterial = () => {
    const newId = crypto.randomUUID();
    setMaterials([
      ...materials,
      { id: newId, unspscCode: '', codeName: '', technicalDescription: '', unitOfMeasure: '' }
    ]);
    setExpandedMaterialId(newId); // Auto expand the new one
  };

  const handleRemoveMaterial = (id: string) => {
    if (materials.length > 0) {
      setMaterials(materials.filter(m => m.id !== id));
    }
  };

  const handleMaterialChange = (id: string, field: keyof Material, value: string) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleImageUpload = (id: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleMaterialChange(id, 'imageUrl', reader.result as string);
    };
    if (file.size > 1024 * 1024) { // 1MB limit check
        alert("La imagen es muy grande. Por favor use imágenes menores a 1MB.");
        return;
    }
    reader.readAsDataURL(file);
  };

  const handleAiAssist = async (id: string, name: string) => {
    if (!name) return;
    setLoadingAi(id);
    const contextLot = isCustomLot ? customLotType : lotType;
    
    // Parallel requests for speed
    const [desc, unspsc] = await Promise.all([
      generateTechnicalDescription(name, contextLot || 'General'),
      suggestUNSPSC(name)
    ]);

    setMaterials(current => current.map(m => {
      if (m.id === id) {
        return {
          ...m,
          technicalDescription: m.technicalDescription || desc,
          unspscCode: m.unspscCode || unspsc.code,
          codeName: m.codeName || unspsc.name
        };
      }
      return m;
    }));
    setLoadingAi(null);
  };

  // --- CSV Import Logic ---

  const downloadTemplate = () => {
    const headers = [
      "Nombre Instructor",
      "Programa Formación",
      "Lote (Categoría)",
      "Nombre Formación",
      "Nombre Material",
      "Unidad Medida",
      "Descripción Técnica",
      "Código UNSPSC"
    ];
    const example = [
      "Juan Pérez",
      "Regular",
      "Mecánica",
      "Técnico en Mantenimiento de Motores",
      "Martillo de Bola 2lb", 
      "Unidad (Und)", 
      "Martillo con cabeza de acero y mango de madera...", 
      "27111600"
    ];
    const csvContent = [headers.join(','), example.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_carga_masiva_sena.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust parser that handles different delimiters and quoted values correctly
  const parseCSVLine = (text: string, delimiter: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let content = evt.target?.result as string;

        // 1. Remove BOM if present (fixes issues with Excel UTF-8 exports)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        const lines = content.split(/\r\n|\n/).filter(line => line.trim() !== '');
        
        // --- DELIMITER DETECTION ---
        if (lines.length === 0) {
            alert("El archivo está vacío.");
            return;
        }

        const firstLine = lines[0];
        const commas = (firstLine.match(/,/g) || []).length;
        const semicolons = (firstLine.match(/;/g) || []).length;
        const delimiter = semicolons > commas ? ';' : ',';

        // --- VALIDATION: Check for at least 1 header row + 1 data row ---
        if (lines.length < 2) {
            alert("El archivo no tiene el formato esperado: Se requiere al menos una fila de cabecera y una fila de datos.");
            return;
        }

        // 3. Parse Headers
        const headers = parseCSVLine(firstLine, delimiter).map(h => h.toLowerCase().trim());
        
        // Find column indices (flexible matching)
        const instructorIdx = headers.findIndex(h => h.includes('instructor'));
        const programIdx = headers.findIndex(h => h.includes('programa'));
        const lotIdx = headers.findIndex(h => h.includes('lote') || h.includes('categoría') || h.includes('categoria'));
        const trainingIdx = headers.findIndex(h => h.includes('nombre formación') || h.includes('formación') || h.includes('formacion'));

        const nameIdx = headers.findIndex(h => h.includes('nombre material') || h.includes('material'));
        const unitIdx = headers.findIndex(h => h.includes('unidad'));
        const descIdx = headers.findIndex(h => h.includes('descripci') || h.includes('técnica') || h.includes('tecnica'));
        const unspscIdx = headers.findIndex(h => h.includes('unspsc') || h.includes('código') || h.includes('codigo'));

        if (nameIdx === -1 || unitIdx === -1 || descIdx === -1) {
          alert(`No se encontraron las columnas obligatorias en el archivo.
                 Columnas encontradas: ${headers.join(', ')}
                 
                 Asegúrese de usar la plantilla y que los nombres de las columnas (Material, Unidad, Descripción) sean correctos.`);
          return;
        }

        // Map to store groups of materials by Context Key
        // Key format: "Instructor|Program|Lot|Training"
        const groups = new Map<string, ImportGroup>();

        // Default context from current form (if user started filling it out)
        let currentInstructor = instructorName;
        let currentProgram = programType;
        let currentLot = lotType;
        let currentCustomLot = customLotType;
        let currentIsCustom = isCustomLot;
        let currentTraining = trainingName;

        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i], delimiter);
          
          if (row.length < 3 || !row.join('').trim()) continue;

          // Update context if provided in row (Excel fill-down logic simulation)
          if (instructorIdx !== -1 && row[instructorIdx]) currentInstructor = row[instructorIdx];
          if (trainingIdx !== -1 && row[trainingIdx]) currentTraining = row[trainingIdx];
          
          if (programIdx !== -1 && row[programIdx]) {
            const csvProg = row[programIdx].toLowerCase().trim();
            const matchedProg = PROGRAM_TYPES.find(p => p.toLowerCase() === csvProg);
            if (matchedProg) currentProgram = matchedProg;
          }

          if (lotIdx !== -1 && row[lotIdx]) {
            const csvLot = row[lotIdx].trim();
            const matchedLot = LOT_TYPES.find(l => l.toLowerCase() === csvLot.toLowerCase());
            if (matchedLot) {
                currentLot = matchedLot;
                currentIsCustom = false;
                currentCustomLot = '';
            } else {
                currentLot = '';
                currentCustomLot = csvLot;
                currentIsCustom = true;
            }
          }

          const name = nameIdx !== -1 ? row[nameIdx] : '';
          const csvUnit = unitIdx !== -1 ? row[unitIdx] : '';
          const matchedUnit = UNIT_TYPES.find(u => u.toLowerCase().includes(csvUnit.toLowerCase())) || csvUnit;
          
          if (!name) continue;

          // Create Key
          const lotKey = currentIsCustom ? currentCustomLot : currentLot;
          const contextKey = `${currentInstructor}|${currentProgram}|${lotKey}|${currentTraining}`;

          if (!groups.has(contextKey)) {
              groups.set(contextKey, {
                  header: {
                      instructor: currentInstructor,
                      program: currentProgram,
                      lot: currentLot,
                      isCustomLot: currentIsCustom,
                      customLot: currentCustomLot,
                      training: currentTraining
                  },
                  materials: []
              });
          }

          groups.get(contextKey)?.materials.push({
            id: crypto.randomUUID(),
            codeName: name,
            unitOfMeasure: matchedUnit,
            technicalDescription: descIdx !== -1 ? row[descIdx] : '',
            unspscCode: unspscIdx !== -1 ? row[unspscIdx] : '',
            imageUrl: ''
          });
        }

        const parsedGroups = Array.from(groups.values());

        if (parsedGroups.length > 0) {
            setImportPreviewGroups(parsedGroups);
        } else {
            alert("No se encontraron datos válidos en las filas del archivo.");
        }

      } catch (err) {
        console.error(err);
        alert("Ocurrió un error inesperado al leer el archivo. Revise que no esté corrupto.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = () => {
    if (!importPreviewGroups || importPreviewGroups.length === 0) return;

    // Logic: 
    // If only 1 group found -> Fill current form
    // If > 1 group found -> Use bulk submit if available (Create Mode), else alert or fill first.
    
    if (importPreviewGroups.length > 1 && onBulkSubmit && !initialData) {
        // BULK CREATE MODE
        const newRequests: TrainingRequest[] = importPreviewGroups.map(group => ({
            id: crypto.randomUUID(),
            instructorName: group.header.instructor,
            programType: group.header.program as ProgramType,
            lotType: group.header.isCustomLot ? group.header.customLot : group.header.lot,
            trainingName: group.header.training,
            materials: group.materials,
            createdAt: Date.now()
        }));

        onBulkSubmit(newRequests);
        alert(`✅ Carga Masiva Exitosa\n\nSe han creado ${newRequests.length} registros diferentes basados en los lotes y programas detectados.`);
    } else {
        // SINGLE GROUP MODE (OR EDIT MODE)
        const group = importPreviewGroups[0];

        // 1. Fill Header
        const { header, materials: newMaterials } = group;
        if (header.instructor) setInstructorName(header.instructor);
        if (header.program) setProgramType(header.program);
        if (header.training) setTrainingName(header.training);
        
        if (header.isCustomLot) {
            setIsCustomLot(true);
            setCustomLotType(header.customLot);
            setLotType('');
        } else if (header.lot) {
            setIsCustomLot(false);
            setLotType(header.lot);
        }

        // 2. Append Materials
        let currentMaterials = [...materials];
        // Clean initial empty row
        if (currentMaterials.length === 1 && !currentMaterials[0].codeName && !currentMaterials[0].technicalDescription) {
            currentMaterials = [];
        }
        
        const updatedMaterials = [...currentMaterials, ...newMaterials];
        setMaterials(updatedMaterials);
        setExpandedMaterialId(newMaterials[0]?.id || updatedMaterials[0]?.id);
        
        alert(`✅ Carga Exitosa\n\nSe han agregado ${newMaterials.length} materiales. Por favor revise si hay duplicados marcados en rojo antes de guardar.`);
    }

    setImportPreviewGroups(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Explicit Validation on Submit
    const duplicates = materials.filter(m => isDuplicate(m.codeName, m.technicalDescription, m.id));
    if (duplicates.length > 0) {
        alert("⚠️ ALERTA: No se puede guardar porque existen materiales DUPLICADOS en este lote.\n\nPor favor elimine o corrija los ítems marcados en rojo.");
        return;
    }

    if (!isFormValid()) {
        alert("Por favor complete todos los campos obligatorios.");
        return;
    }

    const newRequest: TrainingRequest = {
      id: initialData?.id || crypto.randomUUID(),
      instructorName,
      programType: programType as ProgramType,
      lotType: finalLot,
      trainingName,
      materials,
      createdAt: initialData?.createdAt || Date.now()
    };
    onSubmit(newRequest);
  };

  const toggleExpand = (id: string) => {
    if (expandedMaterialId === id) {
      setExpandedMaterialId(null);
    } else {
      setExpandedMaterialId(id);
    }
  };

  // Helper to get total count
  const totalPreviewMaterials = importPreviewGroups ? importPreviewGroups.reduce((acc, g) => acc + g.materials.length, 0) : 0;
  const isMultiGroup = importPreviewGroups && importPreviewGroups.length > 1;

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-8 pb-20 relative">
      {/* Section 1: General Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs">1</span>
          Información General
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Instructor <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#39A900] focus:border-transparent"
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Programa de Formación <span className="text-red-500">*</span></label>
            <select
              required
              value={programType}
              onChange={(e) => setProgramType(e.target.value as ProgramType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#39A900] focus:border-transparent"
            >
              <option value="">Seleccione...</option>
              {PROGRAM_TYPES.map(prog => (
                 <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lote (Categoría) <span className="text-red-500">*</span></label>
            <select
              required={!isCustomLot}
              value={lotType}
              onChange={(e) => {
                if (e.target.value === 'OTRO') {
                  setIsCustomLot(true);
                  setLotType('');
                } else {
                  setIsCustomLot(false);
                  setLotType(e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#39A900] focus:border-transparent"
            >
              <option value="">Seleccione...</option>
              {LOT_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
              <option value="OTRO" className="font-bold text-blue-600">+ Agregar Otro</option>
            </select>
            
            {isCustomLot && (
              <div className="mt-2">
                 <label className="block text-xs text-slate-500 mb-1">Especifique el nombre del nuevo lote:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required={isCustomLot}
                    value={customLotType}
                    onChange={(e) => setCustomLotType(e.target.value)}
                    className="flex-1 px-3 py-2 border border-blue-300 bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del lote nuevo..."
                  />
                  <button 
                    type="button" 
                    onClick={() => { setIsCustomLot(false); setCustomLotType(''); }}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Formación <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={trainingName}
              onChange={(e) => setTrainingName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#39A900] focus:border-transparent"
              placeholder="Ej: Técnico en Sistemas, Curso de Alturas..."
            />
          </div>
        </div>

        {/* Existing Materials Visualization Table */}
        {finalLot && existingItemsInLot.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3 px-1">
              <CheckCircle2 size={16} className="text-[#39A900]" />
              Materiales ya existentes en el lote: <span className="text-[#39A900] font-black uppercase">{finalLot}</span>
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-500 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2">UNSPSC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {existingItemsInLot.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{m.codeName}</td>
                      <td className="px-3 py-2 text-slate-500 truncate max-w-xs" title={m.technicalDescription}>{m.technicalDescription}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{m.unspscCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Materials */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs">2</span>
            Ficha Técnica de Materiales
          </h2>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center px-3 py-2 border border-yellow-300 text-sm font-medium rounded-md text-yellow-800 bg-yellow-50 hover:bg-yellow-100"
              title="Ver instrucciones de carga"
            >
              <HelpCircle size={16} className="mr-2" />
              Instructivo CSV
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-600 bg-white hover:bg-slate-50"
              title="Descargar archivo CSV de ejemplo"
            >
              <Download size={16} className="mr-2" />
              Plantilla
            </button>
            
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".csv"
                className="hidden" 
                onChange={handleCSVUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-3 py-2 border border-blue-200 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
              >
                <FileSpreadsheet size={16} className="mr-2" />
                Importar CSV
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddMaterial}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#39A900] hover:bg-green-700 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              Agregar Manual
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {materials.map((material, index) => {
            const hasDuplicateError = isDuplicate(material.codeName, material.technicalDescription, material.id);
            const isExpanded = expandedMaterialId === material.id;
            const isMissingMandatory = !material.codeName || !material.unitOfMeasure || !material.technicalDescription;

            return (
              <div 
                key={material.id} 
                className={`transition-all rounded-lg border-l-4 ${hasDuplicateError ? 'border-l-red-500 border-red-200 bg-red-50' : 'border-l-[#39A900] border-slate-200 bg-white shadow-sm'} border`}
              >
                {/* Card Header */}
                <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleExpand(material.id)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${hasDuplicateError ? 'bg-red-200 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {index + 1}
                        </div>
                        <div className="flex flex-col">
                            <h3 className={`text-sm font-bold ${material.codeName ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                                {material.codeName || "Nuevo Material (Sin nombre)"}
                            </h3>
                            {hasDuplicateError && <span className="text-xs text-red-600 font-bold">⚠️ Duplicado detectado (Nombre o Descripción)</span>}
                            {!isExpanded && isMissingMandatory && !hasDuplicateError && <span className="text-xs text-amber-600">Faltan campos obligatorios</span>}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                         {materials.length > 1 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveMaterial(material.id); }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="Eliminar este material"
                            >
                                <Trash2 size={18} />
                            </button>
                         )}
                         {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                    </div>
                </div>

                {/* Card Body (Form Fields) */}
                {isExpanded && (
                <div className="p-6 border-t border-slate-100 bg-white rounded-b-lg">
                    {hasDuplicateError && (
                      <div className="mb-4 bg-red-100 text-red-800 px-4 py-2 rounded-md text-sm flex items-center gap-2 border border-red-200">
                        <AlertTriangle size={16} />
                        <b>¡Duplicado detectado!</b> Este material ya existe en el lote "{finalLot}" (Verifique Nombre o Descripción).
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Column 1: Mandatory & Codes */}
                      <div className="lg:col-span-5 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del Material (Código Nombre) <span className="text-red-500">*</span></label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={material.codeName}
                              onChange={(e) => handleMaterialChange(material.id, 'codeName', e.target.value)}
                              className={`flex-1 px-3 py-2 border rounded-md text-sm ${hasDuplicateError ? 'border-red-300 focus:ring-red-500' : 'border-slate-300'}`}
                              placeholder="Ej: Martillo de bola"
                            />
                             <button
                              type="button"
                              onClick={() => handleAiAssist(material.id, material.codeName)}
                              disabled={loadingAi === material.id || !material.codeName}
                              className="bg-indigo-50 text-indigo-600 p-2 rounded-md hover:bg-indigo-100 disabled:opacity-50 border border-indigo-200"
                              title="Autocompletar con IA"
                            >
                               {loadingAi === material.id ? (
                                 <span className="animate-spin text-xs">↻</span>
                               ) : (
                                 <Wand2 size={16} />
                               )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Unidad de Medida <span className="text-red-500">*</span></label>
                          <select
                            required
                            value={material.unitOfMeasure}
                            onChange={(e) => handleMaterialChange(material.id, 'unitOfMeasure', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            <option value="">Seleccione...</option>
                            {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Código UNSPSC (Opcional)</label>
                          <input
                            type="text"
                            value={material.unspscCode}
                            onChange={(e) => handleMaterialChange(material.id, 'unspscCode', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                            placeholder="Ej: 27111600"
                          />
                        </div>
                      </div>

                      {/* Column 2: Description */}
                      <div className="lg:col-span-4">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Descripción Técnica Detallada <span className="text-red-500">*</span></label>
                        <textarea
                          required
                          rows={8}
                          value={material.technicalDescription}
                          onChange={(e) => handleMaterialChange(material.id, 'technicalDescription', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:border-transparent ${hasDuplicateError ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-[#39A900]'}`}
                          placeholder="Describa dimensiones, material, color, voltaje, etc. (Campo ilimitado)"
                        ></textarea>
                      </div>

                      {/* Column 3: Image */}
                      <div className="lg:col-span-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Imagen (Opcional)</label>
                        <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-slate-300 border-dashed rounded-md h-full bg-white relative">
                          {material.imageUrl ? (
                            <div className="relative w-full h-full flex flex-col items-center justify-center">
                               <img src={material.imageUrl} alt="Preview" className="max-h-32 object-contain mb-2 rounded shadow-sm" />
                               <div className="flex gap-2">
                                 <label
                                  htmlFor={`file-replace-${material.id}`}
                                  className="text-xs text-blue-600 cursor-pointer hover:underline"
                                 >
                                   Cambiar
                                   <input 
                                    id={`file-replace-${material.id}`} 
                                    type="file" 
                                    className="sr-only" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(material.id, e.target.files?.[0] || null)}
                                  />
                                 </label>
                                 <button 
                                    type="button" 
                                    onClick={() => handleMaterialChange(material.id, 'imageUrl', '')}
                                    className="text-xs text-red-500 hover:underline"
                                  >
                                    Quitar
                                  </button>
                               </div>
                            </div>
                          ) : (
                            <div className="space-y-1 text-center flex flex-col justify-center w-full">
                              <Upload className="mx-auto h-8 w-8 text-slate-400" />
                              <div className="flex text-sm text-slate-600 justify-center">
                                <label
                                  htmlFor={`file-upload-${material.id}`}
                                  className="relative cursor-pointer bg-white rounded-md font-medium text-[#39A900] hover:text-green-700 focus-within:outline-none"
                                >
                                  <span>Subir archivo</span>
                                  <input 
                                    id={`file-upload-${material.id}`} 
                                    name={`file-upload-${material.id}`} 
                                    type="file" 
                                    className="sr-only" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(material.id, e.target.files?.[0] || null)}
                                  />
                                </label>
                              </div>
                              <p className="text-xs text-slate-500">PNG, JPG hasta 1MB</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                </div>
                )}
              </div>
            );
          })}
          
           <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={handleAddMaterial}
                className="flex items-center text-sm text-[#39A900] font-medium hover:text-green-800 transition-colors bg-green-50 px-4 py-2 rounded-full border border-green-200 shadow-sm"
              >
                <PlusCircle className="mr-1" size={16}/>
                Agregar otro material a la lista
              </button>
           </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-40 flex justify-end gap-4 max-w-7xl mx-auto w-full shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
         <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <div className="relative group">
            <button
            type="submit"
            disabled={!isFormValid()}
            className="flex items-center px-6 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
            <Save size={18} className="mr-2" />
            {initialData ? 'Actualizar Registro' : 'Guardar Nuevo Registro'}
            </button>
            {!isFormValid() && (
                <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg hidden group-hover:block">
                    Complete los campos obligatorios (*) y asegúrese de no tener duplicados.
                </div>
            )}
        </div>
      </div>
    </form>

    {/* HELP MODAL */}
    {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-yellow-800 flex items-center gap-2">
                            <FileQuestion size={24} />
                            Instructivo de Carga Masiva
                        </h3>
                        <p className="text-sm text-yellow-700">Guía para preparar su archivo Excel/CSV correctamente.</p>
                    </div>
                    <button onClick={() => setShowHelp(false)} className="text-yellow-600 hover:text-yellow-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6 text-slate-700">
                    <div>
                        <h4 className="font-bold text-lg mb-2 text-slate-800">1. Pasos Generales</h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <li>Haga clic en el botón <b>"Plantilla"</b> para descargar el archivo base.</li>
                            <li>Abra el archivo en Excel o Google Sheets.</li>
                            <li>Diligencie la información siguiendo las reglas de la tabla inferior.</li>
                            <li>Guarde el archivo con formato <b>CSV (Delimitado por comas)</b>.</li>
                            <li>Use el botón <b>"Importar CSV"</b> para cargar los datos.</li>
                        </ol>
                    </div>

                    <div>
                        <h4 className="font-bold text-lg mb-2 text-slate-800">2. Estructura de Columnas</h4>
                        <p className="text-xs text-slate-500 mb-2">
                            La herramienta tomará la información general (Instructor, Programa, Lote) de la <b>primera fila</b> de datos.
                        </p>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 text-slate-600 font-bold">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Columna</th>
                                        <th className="px-3 py-2 text-left">Obligatorio</th>
                                        <th className="px-3 py-2 text-left">Instrucciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="px-3 py-2 font-medium">Nombre Instructor</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Nombre completo del instructor.</td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="px-3 py-2 font-medium">Programa Formación</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Ej: <i>Regular, Población Vulnerable, Campesena</i>.</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium">Lote (Categoría)</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Ej: <i>Sistemas, Mecánica</i>. Si no existe, se creará uno nuevo.</td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="px-3 py-2 font-medium">Nombre Formación</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Nombre del técnico, curso o ficha.</td>
                                    </tr>
                                    <tr className="border-t-2 border-slate-200">
                                        <td className="px-3 py-2 font-medium">Nombre Material</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Nombre corto del ítem.</td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="px-3 py-2 font-medium">Unidad Medida</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Ej: <i>Unidad (Und), Caja, Metro (m)</i>.</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium">Descripción Técnica</td>
                                        <td className="px-3 py-2 text-green-600 font-bold">Sí</td>
                                        <td className="px-3 py-2 text-slate-500">Detalle completo, dimensiones, voltaje, color, etc.</td>
                                    </tr>
                                    <tr className="bg-slate-50">
                                        <td className="px-3 py-2 font-medium">Código UNSPSC</td>
                                        <td className="px-3 py-2 text-slate-400">Opcional</td>
                                        <td className="px-3 py-2 text-slate-500">Código de 8 dígitos si se conoce.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-blue-800 text-sm mb-1">💡 Consejos Importantes</h4>
                        <ul className="list-disc list-inside text-xs text-blue-700 space-y-1">
                            <li>Al guardar en Excel, seleccione la opción <b>"CSV UTF-8 (delimitado por comas)"</b> para que las tildes y ñ se vean correctamente.</li>
                            <li>Evite dejar filas vacías entre los datos.</li>
                            <li>No cambie el orden de las columnas de la plantilla.</li>
                        </ul>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                     <button 
                        onClick={() => setShowHelp(false)}
                        className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700"
                     >
                        Entendido
                     </button>
                </div>
             </div>
        </div>
    )}

    {/* IMPORT PREVIEW MODAL */}
    {importPreviewGroups && importPreviewGroups.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Modal Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Eye size={24} className="text-[#39A900]"/>
                            Confirmar Importación
                        </h3>
                        <p className="text-sm text-slate-500">
                           {isMultiGroup 
                            ? `Se han detectado ${importPreviewGroups.length} grupos de datos (Lotes/Programas diferentes).` 
                            : 'Revise los datos extraídos antes de cargarlos al formulario.'}
                        </p>
                    </div>
                    <button onClick={() => setImportPreviewGroups(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-8">
                    {importPreviewGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Detected Header Info */}
                        <div className="bg-blue-50 border-b border-blue-100 p-4">
                             <div className="flex items-center gap-2 mb-3">
                                <Layers size={16} className="text-blue-600"/>
                                <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
                                    Grupo {groupIdx + 1}: {group.header.isCustomLot ? group.header.customLot : group.header.lot}
                                </h4>
                             </div>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                 <div>
                                     <span className="block text-blue-500 text-xs">Instructor</span>
                                     <span className="font-medium text-slate-800">{group.header.instructor || <span className="text-slate-400 italic">No detectado</span>}</span>
                                 </div>
                                 <div>
                                     <span className="block text-blue-500 text-xs">Programa</span>
                                     <span className="font-medium text-slate-800">{group.header.program || <span className="text-slate-400 italic">No detectado</span>}</span>
                                 </div>
                                 <div>
                                     <span className="block text-blue-500 text-xs">Lote</span>
                                     <span className="font-medium text-slate-800">
                                         {group.header.isCustomLot ? group.header.customLot : group.header.lot || <span className="text-slate-400 italic">No detectado</span>}
                                     </span>
                                 </div>
                                 <div>
                                     <span className="block text-blue-500 text-xs">Formación</span>
                                     <span className="font-medium text-slate-800">{group.header.training || <span className="text-slate-400 italic">No detectado</span>}</span>
                                 </div>
                             </div>
                        </div>

                        {/* Detected Materials */}
                        <div>
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nombre</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Unidad</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Descripción</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">UNSPSC</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {group.materials.map((mat, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 text-sm text-slate-800 font-medium">{mat.codeName}</td>
                                            <td className="px-3 py-2 text-sm text-slate-600">{mat.unitOfMeasure}</td>
                                            <td className="px-3 py-2 text-sm text-slate-500 truncate max-w-xs">{mat.technicalDescription}</td>
                                            <td className="px-3 py-2 text-sm text-slate-500 font-mono">{mat.unspscCode}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ))}
                </div>

                {/* Modal Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setImportPreviewGroups(null)}
                        className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-white text-sm font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={confirmImport}
                        className="flex items-center px-4 py-2 bg-[#39A900] text-white rounded-md hover:bg-green-700 shadow-sm text-sm font-medium"
                    >
                        <CheckCircle2 size={18} className="mr-2" />
                        {isMultiGroup ? `Crear ${importPreviewGroups.length} Registros` : 'Confirmar e Importar'}
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};