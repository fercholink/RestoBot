import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Edit2, Trash2, ChevronUp, ChevronDown,
    Check, X, Copy, Layers, Bed, AlertTriangle, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';

// ─────────────────────────────────────────────
// Modal de confirmación de eliminación
// ─────────────────────────────────────────────
const DeleteFloorModal = ({ floor, roomCount, onConfirm, onClose }) => {
    const [cascade, setCascade] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const handleConfirm = async () => {
        setConfirming(true);
        await onConfirm(floor, cascade);
        setConfirming(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 bg-red-500 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg">Eliminar piso</h3>
                            <p className="text-white/70 text-xs">Esta acción no se puede deshacer</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm font-bold text-secondary">
                        ¿Eliminar <span className="text-primary">{floor.name}</span>?
                    </p>

                    {roomCount > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                            <p className="text-xs font-black text-amber-700 mb-3">
                                Este piso tiene <strong>{roomCount} habitación(es)</strong> registradas.
                            </p>
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div
                                    onClick={() => setCascade(c => !c)}
                                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${cascade ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white group-hover:border-red-300'}`}
                                >
                                    {cascade && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-secondary">Eliminar también las {roomCount} habitaciones</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Si no marcas esta opción, las habitaciones quedarán sin piso asignado.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-black uppercase hover:bg-gray-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={confirming}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-black uppercase hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {confirming
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <Trash2 size={14} />}
                            {cascade ? 'Eliminar todo' : 'Solo el piso'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
const FloorManager = ({ branchId, onFloorUpdated }) => {
    const [floors, setFloors]         = useState([]);
    const [floorRooms, setFloorRooms] = useState({}); // { [floorId]: { count, disponible, ocupada, reservada, limpieza, mantenimiento, sucio } }
    const [loading, setLoading]       = useState(false);

    // Edición inline
    const [editingId, setEditingId]   = useState(null);
    const [editName, setEditName]     = useState('');

    // Formulario de nuevo piso
    const [newFloorNumber, setNewFloorNumber]       = useState('');
    const [newFloorName, setNewFloorName]           = useState('');
    const [shouldCopyConfig, setShouldCopyConfig]   = useState(false);
    const [sourceCopyFloorId, setSourceCopyFloorId] = useState('');

    // Modal de eliminación
    const [deleteModal, setDeleteModal] = useState(null); // floor object

    // Reordenamiento
    const [reordering, setReordering] = useState(false);

    const fetchFloors = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            // 1. Pisos del branch
            const { data: floorsData, error } = await supabase
                .from('floors')
                .select('*')
                .eq('branch_id', branchId)
                .order('floor_number', { ascending: true });
            if (error) throw error;

            const loaded = floorsData || [];
            setFloors(loaded);

            // Piso fuente por defecto: el primero disponible
            if (loaded.length > 0) {
                setSourceCopyFloorId(prev => prev || loaded[0].id);
            }

            // 2. Stats de habitaciones agrupadas por piso
            if (loaded.length > 0) {
                const floorIds = loaded.map(f => f.id);
                const { data: roomsData } = await supabase
                    .from('rooms')
                    .select('id, floor_id, status, housekeeping_status')
                    .in('floor_id', floorIds);

                const grouped = {};
                (roomsData || []).forEach(r => {
                    if (!grouped[r.floor_id]) {
                        grouped[r.floor_id] = { count: 0, disponible: 0, ocupada: 0, reservada: 0, limpieza: 0, mantenimiento: 0, sucio: 0 };
                    }
                    const s = grouped[r.floor_id];
                    s.count++;
                    if (s[r.status] !== undefined) s[r.status]++;
                    if (r.housekeeping_status === 'sucio') s.sucio++;
                });
                setFloorRooms(grouped);
            }
        } catch (err) {
            console.error('Error fetching floors:', err);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { fetchFloors(); }, [fetchFloors]);

    // ── Copiar habitaciones de un piso fuente ──
    const handleCopyFloorConfig = async (sourceFloorId, targetFloorId, targetFloorNumber) => {
        const sourceFloor = floors.find(f => f.id === sourceFloorId);
        if (!sourceFloor) return;

        const { data: sourceRooms, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('floor_id', sourceFloorId)
            .eq('branch_id', branchId);
        if (error) throw error;
        if (!sourceRooms || sourceRooms.length === 0) return;

        const newRooms = sourceRooms.map(room => {
            const numStr  = String(room.number);
            const srcStr  = String(sourceFloor.floor_number);
            const tgtStr  = String(targetFloorNumber);
            const newNumber = numStr.startsWith(srcStr)
                ? tgtStr + numStr.substring(srcStr.length)
                : `${tgtStr}${numStr.slice(-2)}`;
            return {
                number:     newNumber,
                floor_id:   targetFloorId,
                type:       room.type,
                base_price: room.base_price,
                features:   room.features,
                status:     'disponible',
                branch_id:  branchId,
            };
        });

        const { error: insertError } = await supabase.from('rooms').insert(newRooms);
        if (insertError) throw insertError;
    };

    // ── Agregar piso ──
    const handleAddFloor = async (e) => {
        e.preventDefault();
        const num = parseInt(newFloorNumber);

        // Validar duplicado
        if (floors.some(f => f.floor_number === num)) {
            sileo.error({ title: 'Número duplicado', description: `Ya existe un piso con el nivel ${num}.` });
            return;
        }

        setLoading(true);
        try {
            const { data: newFloor, error } = await supabase
                .from('floors')
                .insert([{ floor_number: num, name: newFloorName || `Piso ${num}`, branch_id: branchId }])
                .select()
                .single();
            if (error) throw error;

            if (shouldCopyConfig && newFloor && sourceCopyFloorId) {
                await handleCopyFloorConfig(sourceCopyFloorId, newFloor.id, num);
            }

            setNewFloorNumber('');
            setNewFloorName('');
            setShouldCopyConfig(false);
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
            sileo.success({ title: 'Piso creado', description: `${newFloor.name} agregado correctamente.` });
        } catch (err) {
            const msg = err?.message || JSON.stringify(err);
            sileo.error({ title: 'Error al agregar piso', description: msg });
        } finally {
            setLoading(false);
        }
    };

    // ── Editar nombre ──
    const startEdit = (floor) => {
        setEditingId(floor.id);
        setEditName(floor.name || `Piso ${floor.floor_number}`);
    };

    const handleUpdateFloor = async (id) => {
        if (!editName.trim()) { setEditingId(null); return; }
        try {
            const { error } = await supabase.from('floors').update({ name: editName.trim() }).eq('id', id);
            if (error) throw error;
            setEditingId(null);
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
            sileo.success({ title: 'Nombre actualizado' });
        } catch (err) {
            sileo.error({ title: 'Error', description: err.message });
        }
    };

    // ── Eliminar piso (con opción cascada) ──
    const handleDeleteFloor = async (floor, cascade) => {
        try {
            if (cascade) {
                // Eliminar habitaciones primero
                await supabase.from('rooms').delete().eq('floor_id', floor.id);
            }
            const { error } = await supabase.from('floors').delete().eq('id', floor.id);
            if (error) throw error;
            setDeleteModal(null);
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
            sileo.success({ title: 'Piso eliminado', description: cascade ? 'Piso y habitaciones eliminados.' : 'Piso eliminado. Las habitaciones quedan sin piso.' });
        } catch (err) {
            sileo.error({ title: 'Error al eliminar', description: err.message });
        }
    };

    // ── Reordenar ──
    const handleReorder = async (floor, direction) => {
        const sorted = [...floors];
        const idx    = sorted.findIndex(f => f.id === floor.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        const swap = sorted[swapIdx];
        setReordering(true);
        try {
            // Usar valor temporal para evitar conflicto de unicidad
            const tempNum = -99;
            await supabase.from('floors').update({ floor_number: tempNum }).eq('id', floor.id);
            await supabase.from('floors').update({ floor_number: floor.floor_number }).eq('id', swap.id);
            await supabase.from('floors').update({ floor_number: swap.floor_number }).eq('id', floor.id);
            fetchFloors();
            if (onFloorUpdated) onFloorUpdated();
        } catch (err) {
            sileo.error({ title: 'Error al reordenar', description: err.message });
        } finally {
            setReordering(false);
        }
    };

    const sortedFloors = [...floors].sort((a, b) => a.floor_number - b.floor_number);

    return (
        <div className="p-6 bg-canvas rounded-[24px] border border-hairline shadow-airbnb max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <Layers size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-secondary">Pisos y Zonas</h2>
                        <p className="text-xs text-accent font-semibold">{floors.length} piso(s) configurado(s)</p>
                    </div>
                </div>
                <button
                    onClick={fetchFloors}
                    disabled={loading}
                    className="p-2 bg-surface-soft text-secondary border border-hairline rounded-full hover:bg-canvas shadow-sm transition-all"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* ── Formulario de nuevo piso ── */}
                <form onSubmit={handleAddFloor} className="bg-surface-soft p-6 rounded-[18px] border border-hairline space-y-4">
                    <h4 className="text-sm font-black uppercase text-gray-400">Agregar piso / zona</h4>

                    <div>
                        <label className="text-xs font-bold text-accent uppercase mb-1 block">Número de nivel</label>
                        <input
                            type="number"
                            required
                            min="1"
                            placeholder="Ej: 2"
                            className={`w-full bg-canvas border rounded-full px-4 py-2.5 text-[13px] font-semibold text-secondary shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors ${
                                newFloorNumber && floors.some(f => f.floor_number === parseInt(newFloorNumber))
                                    ? 'border-danger/50 bg-danger/5'
                                    : 'border-hairline'
                            }`}
                            value={newFloorNumber}
                            onChange={e => setNewFloorNumber(e.target.value)}
                        />
                        {newFloorNumber && floors.some(f => f.floor_number === parseInt(newFloorNumber)) && (
                            <p className="text-[10px] text-red-500 font-black mt-1 flex items-center gap-1">
                                <AlertTriangle size={10} /> El nivel {newFloorNumber} ya existe
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-accent uppercase mb-1 block">Nombre (opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Terraza VIP, Piso 2"
                            className="w-full bg-canvas border border-hairline rounded-full shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors"
                            value={newFloorName}
                            onChange={e => setNewFloorName(e.target.value)}
                        />
                    </div>

                    {/* Copiar configuración */}
                    <div className="pt-1 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div
                                onClick={() => setShouldCopyConfig(c => !c)}
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${shouldCopyConfig ? 'bg-primary border-primary' : 'border-gray-300 bg-white group-hover:border-primary/50'}`}
                            >
                                {shouldCopyConfig && <Check size={12} className="text-white" strokeWidth={3} />}
                            </div>
                            <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                                <Copy size={12} className="text-gray-400" /> Copiar habitaciones de un piso existente
                            </span>
                        </label>

                        {shouldCopyConfig && floors.length > 0 && (
                            <div className="ml-8 mt-2">
                                <label className="text-[10px] font-bold text-accent uppercase mb-1 block">Piso fuente</label>
                                <select
                                    value={sourceCopyFloorId}
                                    onChange={e => setSourceCopyFloorId(e.target.value)}
                                    className="w-full bg-canvas border border-hairline rounded-full shadow-sm px-4 py-2.5 text-[13px] font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors"
                                >
                                    {sortedFloors.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.name} (Nivel {f.floor_number}) — {floorRooms[f.id]?.count || 0} hab.
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !newFloorNumber || floors.some(f => f.floor_number === parseInt(newFloorNumber))}
                        className="w-full mt-4 bg-primary text-white py-3 rounded-full font-bold text-xs uppercase hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <RefreshCw size={14} className="animate-spin" />
                            : <><Plus size={16} /> Agregar Piso</>}
                    </button>
                </form>

                {/* ── Lista de pisos ── */}
                <div className="space-y-3">
                    <h4 className="text-sm font-black uppercase text-gray-400">Pisos existentes</h4>

                    <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                        {sortedFloors.map((floor, idx) => {
                            const rs = floorRooms[floor.id] || { count: 0, disponible: 0, ocupada: 0, reservada: 0, limpieza: 0, mantenimiento: 0, sucio: 0 };
                            const isFirst = idx === 0;
                            const isLast  = idx === sortedFloors.length - 1;

                            return (
                                <div key={floor.id} className="bg-canvas border border-hairline rounded-[18px] p-4 shadow-sm hover:shadow-airbnb transition-all">

                                    {/* Fila principal */}
                                    <div className="flex items-start gap-2">

                                        {/* Flechas de reordenamiento */}
                                        <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                                            <button
                                                onClick={() => handleReorder(floor, 'up')}
                                                disabled={isFirst || reordering}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                                title="Subir"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleReorder(floor, 'down')}
                                                disabled={isLast || reordering}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                                title="Bajar"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>

                                        {/* Nombre / edición */}
                                        <div className="flex-1 min-w-0">
                                            {editingId === floor.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdateFloor(floor.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        className="flex-1 border border-primary rounded-full px-4 py-2 text-[13px] font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateFloor(floor.id)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 shadow-sm transition-all"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-soft border border-hairline text-accent hover:text-secondary hover:bg-canvas transition-all"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="font-black text-secondary text-sm leading-tight truncate">
                                                        {floor.name || `Piso ${floor.floor_number}`}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Nivel {floor.floor_number}</p>
                                                </div>
                                            )}

                                            {/* Stats de habitaciones */}
                                            {editingId !== floor.id && (
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                                                        <Bed size={10} /> {rs.count} hab.
                                                    </span>
                                                    {rs.disponible > 0 && (
                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                                            {rs.disponible} libre{rs.disponible > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {rs.ocupada > 0 && (
                                                        <span className="text-[10px] font-black text-primary bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                                                            {rs.ocupada} ocup.
                                                        </span>
                                                    )}
                                                    {rs.reservada > 0 && (
                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                                                            {rs.reservada} reserv.
                                                        </span>
                                                    )}
                                                    {rs.limpieza > 0 && (
                                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                                            {rs.limpieza} limp.
                                                        </span>
                                                    )}
                                                    {rs.mantenimiento > 0 && (
                                                        <span className="text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                                                            {rs.mantenimiento} mant.
                                                        </span>
                                                    )}
                                                    {rs.sucio > 0 && (
                                                        <span className="text-[10px] font-black text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">
                                                            🔴 {rs.sucio} sucia{rs.sucio > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {rs.count === 0 && (
                                                        <span className="text-[10px] font-bold text-gray-300 italic">Sin habitaciones</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Acciones */}
                                        {editingId !== floor.id && (
                                            <div className="flex gap-1.5 shrink-0 items-center">
                                                <button
                                                    onClick={() => startEdit(floor)}
                                                    className="p-2 text-accent hover:text-primary hover:bg-primary/10 rounded-full transition-all border border-transparent hover:border-primary/20"
                                                    title="Editar nombre"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal(floor)}
                                                    className="p-2 text-accent hover:text-danger hover:bg-danger/10 rounded-full transition-all border border-transparent hover:border-danger/20"
                                                    title="Eliminar piso"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {floors.length === 0 && !loading && (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Layers size={32} className="mx-auto text-gray-200 mb-2" />
                                <p className="text-gray-400 font-bold text-sm">No hay pisos registrados</p>
                                <p className="text-xs text-gray-300 mt-1">Agrega el primero con el formulario</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de eliminación */}
            {deleteModal && (
                <DeleteFloorModal
                    floor={deleteModal}
                    roomCount={floorRooms[deleteModal.id]?.count || 0}
                    onConfirm={handleDeleteFloor}
                    onClose={() => setDeleteModal(null)}
                />
            )}
        </div>
    );
};

export default FloorManager;
