import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Check, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';

const FloorManagerModal = ({ isOpen, onClose, onFloorUpdated, branchId }) => {
    const [floors, setFloors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newFloorNumber, setNewFloorNumber] = useState('');
    const [newFloorName, setNewFloorName] = useState('');
    const [shouldCopyConfig, setShouldCopyConfig] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchFloors();
        }
    }, [isOpen]);

    const fetchFloors = async () => {
        setLoading(true);
        try {
            if (!branchId) return;
            const { data, error } = await supabase
                .from('floors')
                .select('*')
                .eq('branch_id', branchId)
                .order('floor_number', { ascending: true });

            if (error) throw error;
            setFloors(data || []);
        } catch (error) {
            console.error('Error fetching floors:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyFloorConfig = async (sourceFloorNumber, targetFloorId, targetFloorNumber) => {
        // 1. Find source floor ID
        const { data: sourceFloor, error: floorError } = await supabase
            .from('floors')
            .select('id')
            .eq('branch_id', branchId)
            .eq('floor_number', sourceFloorNumber)
            .single();

        if (floorError || !sourceFloor) {
            console.warn("Source floor not found for copying config");
            return;
        }

        // 2. Fetch source rooms
        const { data: sourceRooms, error: fetchError } = await supabase
            .from('rooms')
            .select('*')
            .eq('floor_id', sourceFloor.id)
            .eq('branch_id', branchId);

        if (fetchError) throw fetchError;

        if (!sourceRooms || sourceRooms.length === 0) return;

        // 3. Prepare new rooms
        const newRooms = sourceRooms.map(room => {
            let newNumber = room.number;
            const numberString = String(room.number);

            // Heuristic: If number starts with sourceFloorNumber, replace it.
            if (numberString.startsWith(String(sourceFloorNumber))) {
                newNumber = String(targetFloorNumber) + numberString.substring(String(sourceFloorNumber).length);
            } else {
                // Fallback: targetFloor * 100 + original index? 
                newNumber = `${targetFloorNumber}${numberString.slice(-2)}`;
            }

            return {
                number: newNumber,
                floor_id: targetFloorId, // Link to new floor UUID
                type: room.type,
                base_price: room.base_price,
                features: room.features,
                status: 'disponible',
                branch_id: branchId
            };
        });

        // 4. Batch Insert
        const { error: insertError } = await supabase
            .from('rooms')
            .insert(newRooms);

        if (insertError) throw insertError;
    };

    const handleAddFloor = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Create Floor Record
            const { data: newFloor, error } = await supabase
                .from('floors')
                .insert([{ floor_number: parseInt(newFloorNumber), name: newFloorName || `Piso ${newFloorNumber}`, branch_id: branchId }])
                .select()
                .single();

            if (error) throw error;

            // 2. Opt: Copy Config from Floor 1
            if (shouldCopyConfig && newFloor) {
                await handleCopyFloorConfig(1, newFloor.id, parseInt(newFloorNumber));
            }

            setNewFloorNumber('');
            setNewFloorName('');
            setShouldCopyConfig(false);
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
        } catch (error) {
            console.error('Detailed Error adding floor:', error);
            const msg = error?.message || error?.error_description || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            alert('Error al agregar piso: ' + msg);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFloor = async (floor) => {
        if (!window.confirm(`¿Estás seguro de eliminar el ${floor.name}? Esto NO eliminará las habitaciones automáticamente, pero quedarán huérfanas o necesitarán reasignación.`)) return;

        try {
            const { error } = await supabase
                .from('floors')
                .delete()
                .eq('id', floor.id);

            if (error) throw error;
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
        } catch (error) {
            console.error('Error deleting floor:', error);
            alert('Error al eliminar piso: ' + error.message);
        }
    };

    const handleUpdateFloor = async (id, newName) => {
        try {
            const { error } = await supabase
                .from('floors')
                .update({ name: newName })
                .eq('id', id);

            if (error) throw error;
            setEditingId(null);
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
        } catch (error) {
            console.error('Error updating floor:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-secondary p-6 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        Gestionar Pisos
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    {/* Add New Floor Form */}
                    <form onSubmit={handleAddFloor} className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h4 className="text-xs font-black uppercase text-gray-400 mb-3 block">Nuevo Piso</h4>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Número</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="#"
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={newFloorNumber}
                                        onChange={e => setNewFloorNumber(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Nombre (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Terraza"
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={newFloorName}
                                        onChange={e => setNewFloorName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="copyConfig"
                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                    checked={shouldCopyConfig}
                                    onChange={e => setShouldCopyConfig(e.target.checked)}
                                />
                                <label htmlFor="copyConfig" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                                    Copiar habitaciones y configuración del Piso 1
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !newFloorNumber}
                                className="w-full bg-primary text-white py-2 rounded-lg font-black text-xs uppercase hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Guardando...' : <><Plus size={14} /> Agregar Piso</>}
                            </button>
                        </div>
                    </form>

                    {/* Floor List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {floors.map(floor => (
                            <div key={floor.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                                {editingId === floor.id ? (
                                    <div className="flex-1 flex gap-2 mr-2">
                                        <input
                                            type="text"
                                            className="flex-1 border border-primary rounded px-2 py-1 text-sm font-bold"
                                            defaultValue={floor.name}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateFloor(floor.id, e.target.value);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            onBlur={(e) => handleUpdateFloor(floor.id, e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-black text-secondary text-sm">{floor.name || `Piso ${floor.floor_number}`}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Nivel {floor.floor_number}</p>
                                    </div>
                                )}

                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setEditingId(floor.id)}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFloor(floor)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {floors.length === 0 && !loading && (
                            <p className="text-center text-gray-400 text-xs py-4">No hay pisos registrados. Agrega uno arriba.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FloorManagerModal;
