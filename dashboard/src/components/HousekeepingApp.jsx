import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Wind, CheckCircle, RefreshCw,
    MessageSquare, Bed, Wrench, Eye, Save
} from 'lucide-react';
import { sileo } from 'sileo';

const STATUS_CONFIG = {
    sucio:         { label: 'Sucia',          bg: 'bg-red-50',    border: 'border-red-100',    text: 'text-red-500',    pill: 'bg-red-100 text-red-600' },
    limpieza:      { label: 'En Limpieza',     bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-600',  pill: 'bg-amber-100 text-amber-700' },
    limpio:        { label: 'Limpia',          bg: 'bg-emerald-50',border: 'border-emerald-100',text: 'text-emerald-500',pill: 'bg-emerald-100 text-emerald-600' },
    inspeccionado: { label: 'Inspeccionada',   bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-600',   pill: 'bg-blue-100 text-blue-700' },
    mantenimiento: { label: 'Mantenimiento',   bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-600', pill: 'bg-violet-100 text-violet-700' },
};

const HousekeepingApp = ({ selectedBranchId }) => {
    const [allRooms, setAllRooms]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [filter, setFilter]       = useState('todo');
    const [roomNotes, setRoomNotes] = useState({});    // { [room.id]: string }
    const [savingNote, setSavingNote] = useState(null); // id de la habitación guardando nota

    const today = new Date().toISOString().slice(0, 10);

    useEffect(() => {
        fetchRooms();
        const channel = supabase
            .channel('housekeeping_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRooms())
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [selectedBranchId]);

    const fetchRooms = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('rooms')
                .select('*, floors(name)')
                .order('number', { ascending: true });
            if (selectedBranchId) query = query.eq('branch_id', selectedBranchId);
            const { data, error } = await query;
            if (error) throw error;
            const rooms = data || [];
            setAllRooms(rooms);
            // Inicializar notas desde BD, preservando ediciones no guardadas
            setRoomNotes(prev => {
                const fromDb = {};
                rooms.forEach(r => { fromDb[r.id] = r.housekeeping_notes || ''; });
                return { ...fromDb, ...prev };
            });
        } catch (error) {
            console.error('Error fetching housekeeping rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    // Estado efectivo de housekeeping para un cuarto
    const getHkStatus = (room) =>
        room.status === 'limpieza' ? 'limpieza' : (room.housekeeping_status || 'limpio');

    const filteredRooms = filter === 'todo'       ? allRooms
        : filter === 'limpiando' ? allRooms.filter(r => r.status === 'limpieza')
        : allRooms.filter(r => r.housekeeping_status === filter);

    const stats = {
        total:         allRooms.length,
        sucio:         allRooms.filter(r => r.housekeeping_status === 'sucio').length,
        limpiando:     allRooms.filter(r => r.status === 'limpieza').length,
        inspeccionado: allRooms.filter(r => r.housekeeping_status === 'inspeccionado').length,
        mantenimiento: allRooms.filter(r => r.housekeeping_status === 'mantenimiento').length,
        limpias_hoy:   allRooms.filter(r => r.last_cleaned_at?.slice(0, 10) === today).length,
    };

    const handleUpdateStatus = async (room, newStatus) => {
        try {
            const updates = {
                housekeeping_status: newStatus,
                last_cleaned_at: new Date().toISOString(),
            };
            if (newStatus === 'limpio' || newStatus === 'inspeccionado') {
                updates.status = 'disponible';
            } else if (newStatus === 'mantenimiento') {
                updates.status = 'mantenimiento';
            }
            const { error } = await supabase.from('rooms').update(updates).eq('id', room.id);
            if (error) throw error;
            sileo.success({ title: 'Estado actualizado', description: `Habitación ${room.number} → ${newStatus}.` });
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
        }
    };

    const handleSaveNote = async (room) => {
        setSavingNote(room.id);
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ housekeeping_notes: roomNotes[room.id] ?? '' })
                .eq('id', room.id);
            if (error) throw error;
            // Actualizar allRooms para sincronizar estado interno
            setAllRooms(prev => prev.map(r => r.id === room.id ? { ...r, housekeeping_notes: roomNotes[room.id] } : r));
            sileo.success({ title: 'Nota guardada', description: `Habitación ${room.number}.` });
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
        } finally {
            setSavingNote(null);
        }
    };

    const filterButtons = [
        { key: 'todo',         label: 'Todo',    count: stats.total,         inactive: 'bg-gray-50 border-gray-100 text-gray-400',       active: 'bg-secondary text-white border-secondary' },
        { key: 'sucio',        label: 'Sucia',   count: stats.sucio,         inactive: 'bg-red-50 border-red-100 text-red-500',           active: 'bg-red-500 text-white border-red-500 shadow-red-200 shadow-lg' },
        { key: 'limpiando',    label: 'Curso',   count: stats.limpiando,     inactive: 'bg-amber-50 border-amber-100 text-amber-600',     active: 'bg-amber-400 text-white border-amber-400 shadow-amber-100 shadow-lg' },
        { key: 'inspeccionado',label: 'Revisa',  count: stats.inspeccionado, inactive: 'bg-blue-50 border-blue-100 text-blue-600',        active: 'bg-blue-500 text-white border-blue-500 shadow-blue-100 shadow-lg' },
        { key: 'mantenimiento',label: 'Mant.',   count: stats.mantenimiento, inactive: 'bg-violet-50 border-violet-100 text-violet-600',  active: 'bg-violet-500 text-white border-violet-500 shadow-violet-100 shadow-lg' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full space-y-4 max-w-md mx-auto md:max-w-none">

            {/* Header + Filtros */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-black text-secondary flex items-center gap-3">
                            <Wind className="text-primary animate-spin-slow" size={24} />
                            Gestión de Limpieza
                        </h2>
                        <p className="text-xs text-gray-400 font-medium mt-1">Control en tiempo real · Amas de Llaves</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Métrica rápida: limpias hoy */}
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Limpias hoy</p>
                            <p className="text-2xl font-black text-emerald-500 leading-none">{stats.limpias_hoy}</p>
                        </div>
                        <button onClick={fetchRooms} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:text-primary transition-all">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Barra de filtros — 5 estados */}
                <div className="grid grid-cols-5 gap-1.5">
                    {filterButtons.map(({ key, label, count, inactive, active }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`p-2 rounded-2xl flex flex-col items-center justify-center border transition-all ${filter === key ? active : inactive}`}
                        >
                            <span className="text-base font-black">{count}</span>
                            <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista de habitaciones */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                {loading && allRooms.length === 0 ? (
                    <div className="py-20 text-center">
                        <RefreshCw className="animate-spin mx-auto text-gray-200" size={32} />
                    </div>
                ) : filteredRooms.map(room => {
                    const hkStatus = getHkStatus(room);
                    const cfg      = STATUS_CONFIG[hkStatus] || STATUS_CONFIG.limpio;
                    const noteVal  = roomNotes[room.id] ?? '';
                    const noteChanged = noteVal !== (room.housekeeping_notes || '');

                    return (
                        <div key={room.id} className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${cfg.border}`}>

                            {/* Cabecera de la tarjeta */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                        {room.number}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-secondary">
                                            H. {room.number}
                                            <span className="text-gray-400 font-medium text-[10px] ml-1 uppercase">{room.floors?.name}</span>
                                        </p>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${cfg.pill}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hab.</p>
                                    <p className={`text-xs font-black uppercase ${room.status === 'ocupada' ? 'text-primary' : room.status === 'mantenimiento' ? 'text-violet-500' : 'text-emerald-500'}`}>
                                        {room.status}
                                    </p>
                                </div>
                            </div>

                            {/* Botones de acción — 3 estados */}
                            <div className="mt-3 grid grid-cols-3 gap-1.5">
                                <button
                                    onClick={() => handleUpdateStatus(room, 'limpio')}
                                    disabled={hkStatus === 'limpio'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-30"
                                >
                                    <CheckCircle size={12} /> Listo
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(room, 'inspeccionado')}
                                    disabled={hkStatus === 'inspeccionado'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all disabled:opacity-30"
                                >
                                    <Eye size={12} /> Revisado
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(room, 'mantenimiento')}
                                    disabled={hkStatus === 'mantenimiento'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-600 text-[9px] font-black uppercase tracking-widest hover:bg-violet-100 transition-all disabled:opacity-30"
                                >
                                    <Wrench size={12} /> Mant.
                                </button>
                            </div>

                            {/* Nota de incidencia */}
                            <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                                <MessageSquare size={12} className="text-gray-400 shrink-0" />
                                <input
                                    type="text"
                                    value={noteVal}
                                    onChange={e => setRoomNotes(prev => ({ ...prev, [room.id]: e.target.value }))}
                                    placeholder="Nota de incidencia..."
                                    className="bg-transparent border-none text-[11px] font-medium text-gray-500 focus:outline-none flex-1 min-w-0"
                                />
                                {noteChanged && (
                                    <button
                                        onClick={() => handleSaveNote(room)}
                                        disabled={savingNote === room.id}
                                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-[9px] font-black uppercase hover:bg-primary/90 transition-all disabled:opacity-50"
                                    >
                                        {savingNote === room.id
                                            ? <RefreshCw size={10} className="animate-spin" />
                                            : <Save size={10} />}
                                        Guardar
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredRooms.length === 0 && !loading && (
                    <div className="text-center py-20">
                        <Bed size={40} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-xs font-black text-gray-400 uppercase">Sin habitaciones en este estado</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HousekeepingApp;
