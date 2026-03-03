import { useState, useEffect } from 'react';
import { X, Save, Bed, Tv, Wifi, Wind, Speaker, Bath, Trash2, Globe, Car, Waves, Lock, Wine, Sunset, Refrigerator } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';

const AMENITIES_CONFIG = [
    { key: 'tv',          label: 'TV',               icon: Tv },
    { key: 'hot_water',   label: 'Agua Caliente',    icon: Bath },
    { key: 'ac',          label: 'Aire Acond.',      icon: Wind },
    { key: 'wifi',        label: 'WiFi',             icon: Wifi },
    { key: 'fridge',      label: 'Nevera',           icon: Refrigerator },
    { key: 'intercom',    label: 'Citófono',         icon: Speaker },
    { key: 'nightstand',  label: 'Mesa de Noche',    icon: Bed },
    { key: 'parking',     label: 'Parqueadero',      icon: Car },
    { key: 'jacuzzi',     label: 'Jacuzzi',          icon: Waves },
    { key: 'safe',        label: 'Caja Fuerte',      icon: Lock },
    { key: 'minibar',     label: 'Minibar',          icon: Wine },
    { key: 'balcony',     label: 'Balcón',           icon: Sunset },
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
        floor_id: '',
        booking_room_id: '',
        booking_rate_plan_id: '',
        features: {}
    });
    const [loading, setLoading]           = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (roomToEdit) {
            setFormData({
                number:               roomToEdit.number,
                type:                 roomToEdit.type,
                base_price:           roomToEdit.base_price,
                status:               roomToEdit.status,
                beds:                 roomToEdit.features?.beds || 1,
                bathrooms:            roomToEdit.features?.bathrooms || 1,
                floor_id:             roomToEdit.floor_id || '',
                branch_id:            roomToEdit.branch_id,
                booking_room_id:      roomToEdit.booking_room_id || '',
                booking_rate_plan_id: roomToEdit.booking_rate_plan_id || '',
                features:             roomToEdit.features || {}
            });
        } else {
            const defaultFloorId = existingFloors.length > 0 ? existingFloors[0].id : '';
            setFormData({
                number: '', type: 'Sencilla', base_price: 0, status: 'disponible',
                beds: 1, bathrooms: 1, floor_id: defaultFloorId, branch_id: branchId,
                booking_room_id: '', booking_rate_plan_id: '', features: {}
            });
        }
        setShowDeleteConfirm(false);
    }, [roomToEdit, existingFloors]);

    const handleFeatureToggle = (key) => {
        setFormData(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                number:               formData.number,
                type:                 formData.type,
                base_price:           formData.base_price,
                status:               formData.status,
                floor_id:             formData.floor_id || null,   // UUID — NO parseInt
                branch_id:            roomToEdit ? roomToEdit.branch_id : branchId,
                booking_room_id:      formData.booking_room_id,
                booking_rate_plan_id: formData.booking_rate_plan_id,
                features: {
                    ...formData.features,
                    beds:      formData.beds,
                    bathrooms: formData.bathrooms
                }
            };

            let error;
            if (roomToEdit) {
                ({ error } = await supabase.from('rooms').update(payload).eq('id', roomToEdit.id));
            } else {
                ({ error } = await supabase.from('rooms').insert([payload]));
            }

            if (error) throw error;

            sileo.success({ title: roomToEdit ? 'Habitación actualizada' : 'Habitación creada', description: `Hab. ${formData.number} guardada.` });
            onRoomSaved();
            onClose();
        } catch (error) {
            console.error('Error saving room:', error);
            sileo.error({ title: 'Error al guardar', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!roomToEdit) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('rooms').delete().eq('id', roomToEdit.id);
            if (error) throw error;
            sileo.success({ title: 'Habitación eliminada', description: `Hab. ${roomToEdit.number} eliminada.` });
            onRoomSaved();
            onClose();
        } catch (error) {
            console.error('Error deleting room:', error);
            sileo.error({ title: 'No se puede eliminar', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-secondary p-6 flex justify-between items-center">
                    <h3 className="text-xl font-black text-white">
                        {roomToEdit ? `Editar Hab. ${roomToEdit.number}` : 'Nueva Habitación'}
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar space-y-5">

                    {/* Número y Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Número *</label>
                            <input
                                type="text" required placeholder="Ej: 101"
                                className={inputCls}
                                value={formData.number}
                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label>
                            <select className={inputCls} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option>Sencilla</option>
                                <option>Doble</option>
                                <option>Matrimonial</option>
                                <option>Suite</option>
                                <option>Familiar</option>
                                <option>Presidencial</option>
                                <option>Junior Suite</option>
                            </select>
                        </div>
                    </div>

                    {/* Piso */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Piso / Zona</label>
                        {existingFloors.length > 0 ? (
                            <select required className={inputCls} value={formData.floor_id} onChange={e => setFormData({ ...formData, floor_id: e.target.value })}>
                                {existingFloors.map(floor => (
                                    <option key={floor.id} value={floor.id}>
                                        {floor.name || `Piso ${floor.floor_number}`}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded-xl border border-yellow-200">
                                ⚠️ No hay pisos creados. Ve a "Pisos y Zonas" primero.
                            </div>
                        )}
                    </div>

                    {/* Precio */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Precio Base / Noche</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                            <input
                                type="number" required min="0"
                                className={`${inputCls} pl-8`}
                                value={formData.base_price}
                                onChange={e => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    {/* Capacidad */}
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl">
                        {[
                            { label: 'Camas', key: 'beds' },
                            { label: 'Baños', key: 'bathrooms' },
                        ].map(({ label, key }) => (
                            <div key={key}>
                                <label className="block text-xs font-bold text-gray-400 mb-2 text-center">{label}</label>
                                <div className="flex items-center justify-center gap-3">
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, [key]: Math.max(1, prev[key] - 1) }))}
                                        className="w-8 h-8 rounded-full bg-white shadow-sm font-black text-secondary hover:bg-gray-100 flex items-center justify-center">−</button>
                                    <span className="font-black text-xl text-secondary w-6 text-center">{formData[key]}</span>
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, [key]: prev[key] + 1 }))}
                                        className="w-8 h-8 rounded-full bg-white shadow-sm font-black text-secondary hover:bg-gray-100 flex items-center justify-center">+</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Amenidades */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-3">Comodidades</label>
                        <div className="grid grid-cols-3 gap-2">
                            {AMENITIES_CONFIG.map(({ key, label, icon: Icon }) => (
                                <label
                                    key={key}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${formData.features[key] ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'}`}
                                >
                                    <input type="checkbox" className="hidden" checked={!!formData.features[key]} onChange={() => handleFeatureToggle(key)} />
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${formData.features[key] ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <Icon size={14} />
                                    </div>
                                    <span className={`text-[10px] font-bold leading-tight ${formData.features[key] ? 'text-primary' : 'text-gray-500'}`}>{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Mapeo Booking.com */}
                    <div className="pt-4 border-t border-gray-100">
                        <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Globe size={14} className="text-blue-500" /> Mapeo Booking.com
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Room ID</label>
                                <input type="text" className={inputCls} value={formData.booking_room_id}
                                    onChange={e => setFormData({ ...formData, booking_room_id: e.target.value })} placeholder="Booking Room ID" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Rate Plan ID</label>
                                <input type="text" className={inputCls} value={formData.booking_rate_plan_id}
                                    onChange={e => setFormData({ ...formData, booking_rate_plan_id: e.target.value })} placeholder="Rate Plan ID" />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        {roomToEdit ? (
                            showDeleteConfirm ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-red-500">¿Eliminar?</span>
                                    <button type="button" onClick={handleDelete} disabled={loading}
                                        className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-black uppercase hover:bg-red-600 transition-all">
                                        Sí, eliminar
                                    </button>
                                    <button type="button" onClick={() => setShowDeleteConfirm(false)}
                                        className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 text-xs font-black uppercase hover:bg-gray-200 transition-all">
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setShowDeleteConfirm(true)}
                                    className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                                    <Trash2 size={16} /> Eliminar
                                </button>
                            )
                        ) : <div />}

                        <div className="flex gap-3">
                            <button type="button" onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-secondary hover:bg-gray-50 transition-all">
                                Cancelar
                            </button>
                            <button type="submit" disabled={loading}
                                className="bg-primary text-white px-7 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50">
                                {loading ? 'Guardando...' : <><Save size={15} /> Guardar</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoomModal;
