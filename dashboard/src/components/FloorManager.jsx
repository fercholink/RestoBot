import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';

const FloorManager = ({ branchId, onFloorUpdated }) => {
    const [floors, setFloors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newFloorNumber, setNewFloorNumber] = useState('');
    const [newFloorName, setNewFloorName] = useState('');
    const [shouldCopyConfig, setShouldCopyConfig] = useState(false);

    useEffect(() => {
        fetchFloors();
    }, [branchId]);

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
            const { data: newFloor, error } = await supabase
                .from('floors')
                .insert([{ floor_number: parseInt(newFloorNumber), name: newFloorName || `Piso ${newFloorNumber}`, branch_id: branchId }])
                .select()
                .single();

            if (error) throw error;

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
            sileo.error({ title: "Error al agregar piso", description: msg });
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
            sileo.success({ title: "Piso eliminado", description: "Se ha eliminado el piso correctamente." });
        } catch (error) {
            console.error('Error deleting floor:', error);
            sileo.error({ title: "Error al eliminar piso", description: error.message });
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

    return (
        <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-secondary mb-6">Administrar Pisos y Zonas</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Add New Floor Form */}
                <div>
                    <form onSubmit={handleAddFloor} className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <h4 className="text-sm font-black uppercase text-gray-400 mb-4 block">Nuevo Piso / Zona</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Número de Nivel</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    placeholder="#"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={newFloorNumber}
                                    onChange={e => setNewFloorNumber(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Terraza, Piso 1"
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={newFloorName}
                                    onChange={e => setNewFloorName(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="copyConfig"
                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                    checked={shouldCopyConfig}
                                    onChange={e => setShouldCopyConfig(e.target.checked)}
                                />
                                <label htmlFor="copyConfig" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
                                    Copiar habitaciones del Piso 1
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !newFloorNumber}
                                className="w-full mt-2 bg-primary text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Guardando...' : <><Plus size={16} /> Agregar Piso</>}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Floor List */}
                <div>
                    <h4 className="text-sm font-black uppercase text-gray-400 mb-4 block">Pisos Existentes</h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {floors.map(floor => (
                            <div key={floor.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-all">
                                {editingId === floor.id ? (
                                    <div className="flex-1 flex gap-2 mr-2">
                                        <input
                                            type="text"
                                            className="flex-1 border border-primary rounded-lg px-3 py-1 text-sm font-bold"
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
                                        <p className="font-black text-secondary text-base">{floor.name || `Piso ${floor.floor_number}`}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Nivel {floor.floor_number}</p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingId(floor.id)}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                        title="Editar Nombre"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFloor(floor)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Eliminar Piso"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {floors.length === 0 && !loading && (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-400 font-medium text-sm">No hay pisos registrados.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FloorManager;
