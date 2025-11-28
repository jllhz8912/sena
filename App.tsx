import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MaterialForm } from './components/MaterialForm';
import { RequestList } from './components/RequestList';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { TrainingRequest, Material } from './types';
import { AlertTriangle } from 'lucide-react';

const STORAGE_KEY = 'sena_material_requests_v1';

function App() {
  const [view, setView] = useState<'dashboard' | 'form' | 'analytics'>('dashboard');
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [editingRequest, setEditingRequest] = useState<TrainingRequest | null>(null);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Eliminar',
    onConfirm: () => {}
  });

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setRequests(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing local storage", e);
      }
    }
  }, []);

  // Save to local storage whenever requests change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  const handleSubmit = (request: TrainingRequest) => {
    if (editingRequest) {
      // Update existing
      setRequests(prev => prev.map(r => r.id === request.id ? request : r));
      setEditingRequest(null);
    } else {
      // Create new
      setRequests(prev => [request, ...prev]);
    }
    setView('dashboard');
  };

  const handleBulkSubmit = (newRequests: TrainingRequest[]) => {
    setRequests(prev => [...newRequests, ...prev]);
    setView('dashboard');
  };

  const handleEditGroup = (request: TrainingRequest) => {
    setEditingRequest(request);
    setView('form');
  };

  // --- ACTIONS WITH CUSTOM CONFIRMATION MODAL ---

  const handleDeleteRequest = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Grupo Completo',
      message: '¿Está seguro de eliminar este registro y TODOS sus materiales? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar Grupo',
      onConfirm: () => {
        setRequests(prev => prev.filter(r => r.id !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteMaterial = (requestId: string, materialId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Material',
      message: '¿Está seguro de eliminar este ítem específico de la lista?',
      confirmText: 'Eliminar Ítem',
      onConfirm: () => {
        setRequests(prev => prev.map(req => {
          if (req.id === requestId) {
            return {
              ...req,
              materials: req.materials.filter(m => m.id !== materialId)
            };
          }
          return req;
        }).filter(req => req.materials.length > 0)); 
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClearAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Borrar Base de Datos',
      message: 'ADVERTENCIA: ¿Está seguro de borrar TODOS los datos almacenados localmente? Perderá toda la información no exportada.',
      confirmText: 'BORRAR TODO',
      onConfirm: () => {
        setRequests([]);
        localStorage.removeItem(STORAGE_KEY);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleUpdateMaterial = (requestId: string, updatedMaterial: Material) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          materials: req.materials.map(m => m.id === updatedMaterial.id ? updatedMaterial : m)
        };
      }
      return req;
    }));
  };

  const handleNavigate = (target: 'dashboard' | 'form' | 'analytics') => {
    if (target === 'dashboard' || target === 'analytics') {
      setEditingRequest(null);
    } else if (target === 'form') {
      setEditingRequest(null); // Reset if manually clicking New Record
    }
    setView(target);
  };

  return (
    <Layout currentView={view} onNavigate={handleNavigate}>
      {view === 'dashboard' && (
        <RequestList 
          requests={requests} 
          onDelete={handleDeleteRequest}
          onDeleteMaterial={handleDeleteMaterial}
          onUpdateMaterial={handleUpdateMaterial}
          onEditGroup={handleEditGroup}
          onClearAll={handleClearAll}
          onConsolidate={handleBulkSubmit}
        />
      )}
      
      {view === 'analytics' && (
        <AnalyticsDashboard requests={requests} />
      )}

      {view === 'form' && (
        <MaterialForm 
          onSubmit={handleSubmit} 
          onBulkSubmit={handleBulkSubmit}
          existingRequests={requests}
          initialData={editingRequest || undefined}
          onCancel={() => {
            setEditingRequest(null);
            setView('dashboard');
          }}
        />
      )}

      {/* GLOBAL CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden transform scale-100">
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                 <div className="bg-red-100 p-2 rounded-full">
                    <AlertTriangle className="text-red-600" size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-red-900">{confirmModal.title}</h3>
              </div>
              
              <div className="p-6">
                 <p className="text-slate-700">{confirmModal.message}</p>
              </div>

              <div className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-200">
                 <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-white font-medium transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={confirmModal.onConfirm}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-md font-bold transition-transform transform active:scale-95"
                 >
                    {confirmModal.confirmText}
                 </button>
              </div>
           </div>
        </div>
      )}
    </Layout>
  );
}

export default App;