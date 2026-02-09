import React, { useState, useEffect } from 'react';
import { X, Save, Bed, Tv, Wifi, Wind, Speaker, Coffee, Bath, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AMENITIES_CONFIG = [
    { key: 'tv', label: 'TV', icon: Tv },
    { key: 'hot_water', label: 'Agua Caliente', icon: Bath },
    { key: 'ac', label: 'Aire Acondicionado', icon: Wind },
    { key: 'wifi', label: 'WiFi', icon: Wifi },
    { key: 'fridge', label: 'Nevera', icon: Coffee }, // Using Coffee as placeholder for Fridge
    { key: 'intercom', label: 'Citófono', icon: Speaker },
    { key: 'nightstand', label: 'Mesa de Noche', icon: Bed },
];

const RoomModal = ({ isOpen, onClose, onRoomSaved, roomToEdit = null, branchId, existingFloors = [] }) => {
    if (!isOpen) return null;

    const [formData, setFormData] = useState({
        number: '',
        type: 'Sencilla',
        base_price: 0,
        status: 'disponible',
        beds: 1,
        bathrooms: 1,
        beds: 1,
        bathrooms: 1,
        floor_id: '', // Will hold the UID of the floor
        features: {}
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (roomToEdit) {
            setFormData({
                number: roomToEdit.number,
                type: roomToEdit.type,
                base_price: roomToEdit.base_price,
                status: roomToEdit.status,
                beds: roomToEdit.features?.beds || 1,
                bathrooms: roomToEdit.features?.bathrooms || 1,
                floor_id: roomToEdit.floor_id || '',
                branch_id: roomToEdit.branch_id,
                features: roomToEdit.features || {}
            });
        } else {
            // Reset for new room
            const defaultFloorId = existingFloors.length > 0 ? existingFloors[0].id : '';

            setFormData({
                number: '',
                type: 'Sencilla',
                base_price: 0,
                status: 'disponible',
                beds: 1,
                bathrooms: 1,
                floor_id: defaultFloorId,
                branch_id: branchId,
                features: {}
            });
        }
    }, [roomToEdit, existingFloors]);

    const handleFeatureToggle = (key) => {
        setFormData(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [key]: !prev.features[key]
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Prepare payload
            const payload = {
                number: formData.number,
                type: formData.type,
                base_price: formData.base_price,
                status: formData.status,
                floor_id: formData.floor_id ? parseInt(formData.floor_id) : null, // Send floor_id
                branch_id: roomToEdit ? roomToEdit.branch_id : branchId, // Keep existing branch on edit, use prop for new
                features: {
                    ...formData.features,
                    beds: formData.beds,
                    bathrooms: formData.bathrooms
                }
            };

            let error;
            if (roomToEdit) {
                // Update
                const { error: updateError } = await supabase
                    .from('rooms')
                    .update(payload)
                    .eq('id', roomToEdit.id);
                error = updateError;
            } else {
                // Create
                const { error: insertError } = await supabase
                    .from('rooms')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

            onRoomSaved();
            onClose();
        } catch (error) {
            console.error('Error saving room:', error);
            alert('Error al guardar la habitación: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-secondary p-6 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        {roomToEdit ? 'Editar Habitación' : 'Nueva Habitación'}
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Número</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.number}
                                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                                    placeholder="Ej: 101"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="Sencilla">Sencilla</option>
                                    <option value="Doble">Doble</option>
                                    <option value="Matrimonial">Matrimonial</option>
                                    <option value="Suite">Suite</option>
                                    <option value="Familiar">Familiar</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-gray-500">Piso / Zona</label>
                            </div>

                            {existingFloors && existingFloors.length > 0 ? (
                                <select
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.floor_id}
                                    onChange={e => setFormData({ ...formData, floor_id: e.target.value })}
                                >
                                    {existingFloors.map(floor => (
                                        <option key={floor.id} value={floor.id}>
                                            {floor.name || `Piso ${floor.floor_number}`}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded-xl border border-yellow-200">
                                    ⚠️ No hay pisos creados. Debes crear un piso primero en "Configurar Pisos".
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Precio Base (Noche)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.base_price}
                                    onChange={e => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* Capacity Stats */}
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 text-center">Camas</label>
                                <div className="flex items-center justify-center gap-3">
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, beds: Math.max(1, prev.beds - 1) }))} className="w-8 h-8 rounded-full bg-white shadow-sm font-black text-secondary hover:bg-gray-100">-</button>
                                    <span className="font-black text-xl text-secondary">{formData.beds}</span>
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, beds: prev.beds + 1 }))} className="w-8 h-8 rounded-full bg-white shadow-sm font-black text-secondary hover:bg-gray-100">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 text-center">Baños</label>
                                <div className="flex items-center justify-center gap-3">
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, bathrooms: Math.max(1, prev.bathrooms - 1) }))} className="w-8 h-8 rounded-full bg-white shadow-sm font-black text-secondary hover:bg-gray-100">-</button>
                                    <span className="font-black text-xl text-secondary">{formData.bathrooms}</span>
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, bathrooms: prev.bathrooms + 1 }))} className="w-8 h-8 rounded-full bg-white shadow-sm font-black text-secondary hover:bg-gray-100">+</button>
                                </div>
                            </div>
                        </div>

                        {/* Amenities */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-3">Comodidades</label>
                            <div className="grid grid-cols-2 gap-3">
                                {AMENITIES_CONFIG.map(({ key, label, icon: Icon }) => (
                                    <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.features[key] ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={!!formData.features[key]}
                                            onChange={() => handleFeatureToggle(key)}
                                        />
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.features[key] ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            <Icon size={16} />
                                        </div>
                                        <span className={`text-xs font-bold ${formData.features[key] ? 'text-primary' : 'text-gray-500'}`}>{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-secondary hover:bg-gray-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-premium hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Guardando...' : <><Save size={16} /> Guardar</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoomModal;
