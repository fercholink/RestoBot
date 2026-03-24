import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Search, Star, X, ChevronRight,
    Award, Globe, Calendar, Phone, Mail,
    RefreshCw, Plus, Minus, Tag, History,
    PenLine, Save, Bed, FileDown
} from 'lucide-react';
import { sileo } from 'sileo';

// ─────────────────────────────────────────────
// Helpers de lealtad
// ─────────────────────────────────────────────
const getLoyaltyTier = (points) => {
    if (points >= 500) return { label: 'Oro',    color: 'text-yellow-600', bg: 'bg-yellow-50',   border: 'border-yellow-200', icon: '🥇' };
    if (points >= 100) return { label: 'Plata',  color: 'text-slate-500',  bg: 'bg-slate-50',    border: 'border-slate-200',  icon: '🥈' };
    return               { label: 'Bronce', color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-200',  icon: '🥉' };
};

const getInitials = (name = '') =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// ─────────────────────────────────────────────
// Modal de detalle del huésped
// ─────────────────────────────────────────────
const GuestDetailModal = ({ guest, onClose, onSave }) => {
    const [stays, setStays]           = useState([]);
    const [loadingStays, setLoadingStays] = useState(true);
    const [editingPrefs, setEditingPrefs] = useState(false);
    const [preferences, setPreferences]   = useState(guest.preferences || {});
    const [newPrefKey, setNewPrefKey]     = useState('');
    const [newPrefVal, setNewPrefVal]     = useState('');
    const [loyaltyDelta, setLoyaltyDelta] = useState(0);
    const [saving, setSaving]             = useState(false);

    const tier = getLoyaltyTier((guest.loyalty_points || 0) + loyaltyDelta);

    useEffect(() => {
        fetchStays();
    }, [guest.id]);

    const fetchStays = async () => {
        setLoadingStays(true);
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('id, check_in, check_out, status, source, room:rooms(number, type)')
                .eq('guest_id', guest.id)
                .order('check_in', { ascending: false })
                .limit(20);
            if (error) throw error;
            setStays(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingStays(false);
        }
    };

    const addPreference = () => {
        if (!newPrefKey.trim()) return;
        setPreferences(prev => ({ ...prev, [newPrefKey.trim()]: newPrefVal.trim() }));
        setNewPrefKey('');
        setNewPrefVal('');
    };

    const removePreference = (key) => {
        setPreferences(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const newPoints = Math.max(0, (guest.loyalty_points || 0) + loyaltyDelta);
            const { error } = await supabase
                .from('guests')
                .update({ preferences, loyalty_points: newPoints })
                .eq('id', guest.id);
            if (error) throw error;
            sileo.success({ title: 'Huésped actualizado', description: `${guest.full_name} guardado.` });
            onSave({ ...guest, preferences, loyalty_points: newPoints });
        } catch (err) {
            sileo.error({ title: 'Error', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const nights = (ci, co) => {
        const d = Math.round((new Date(co) - new Date(ci)) / 86400000);
        return d > 0 ? d : '-';
    };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header del modal */}
                <div className="p-6 flex justify-between items-start bg-secondary text-white shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-2xl">
                            {guest.identification_photo_url
                                ? <img src={guest.identification_photo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                                : getInitials(guest.full_name)
                            }
                        </div>
                        <div>
                            <h2 className="text-lg font-black leading-tight">{guest.full_name}</h2>
                            <p className="text-white/60 text-xs font-medium mt-0.5">
                                {guest.nationality || 'Sin nacionalidad'} · {guest.birth_date ? fmtDate(guest.birth_date) : 'Sin fecha de nacimiento'}
                            </p>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block ${tier.bg} ${tier.color}`}>
                                {tier.icon} {tier.label} · {(guest.loyalty_points || 0) + loyaltyDelta} pts
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Contacto */}
                    <div className="grid grid-cols-2 gap-3">
                        {guest.email && (
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                                <Mail size={14} className="text-gray-400 shrink-0" />
                                <span className="text-xs font-bold text-secondary truncate">{guest.email}</span>
                            </div>
                        )}
                        {guest.phone && (
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                                <Phone size={14} className="text-gray-400 shrink-0" />
                                <span className="text-xs font-bold text-secondary">{guest.phone}</span>
                            </div>
                        )}
                    </div>

                    {/* Firma digital */}
                    {guest.signature_url && (
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <PenLine size={12} /> Firma Digital
                            </p>
                            <div className="border border-gray-100 rounded-2xl p-3 bg-gray-50">
                                <img
                                    src={guest.signature_url}
                                    alt="Firma"
                                    className="max-h-20 object-contain"
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Puntos de lealtad */}
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Award size={12} /> Puntos de Lealtad
                        </p>
                        <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                            <button
                                onClick={() => setLoyaltyDelta(d => Math.max(d - 10, -(guest.loyalty_points || 0)))}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all font-black"
                            >
                                <Minus size={14} />
                            </button>
                            <div className="flex-1 text-center">
                                <p className="text-2xl font-black text-secondary">{(guest.loyalty_points || 0) + loyaltyDelta}</p>
                                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black">puntos totales</p>
                                {loyaltyDelta !== 0 && (
                                    <p className={`text-[10px] font-black ${loyaltyDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {loyaltyDelta > 0 ? '+' : ''}{loyaltyDelta} pendiente de guardar
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setLoyaltyDelta(d => d + 10)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all font-black"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className={`flex items-center justify-between px-4 py-2 rounded-xl mt-2 border ${tier.border} ${tier.bg}`}>
                            <span className={`text-xs font-black ${tier.color}`}>{tier.icon} Nivel {tier.label}</span>
                            {tier.label === 'Bronce' && <span className="text-[10px] text-gray-400">Faltan {100 - ((guest.loyalty_points || 0) + loyaltyDelta)} pts para Plata</span>}
                            {tier.label === 'Plata'  && <span className="text-[10px] text-gray-400">Faltan {500 - ((guest.loyalty_points || 0) + loyaltyDelta)} pts para Oro</span>}
                            {tier.label === 'Oro'    && <span className="text-[10px] text-emerald-600 font-black">Nivel máximo</span>}
                        </div>
                    </div>

                    {/* Preferencias */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <Tag size={12} /> Preferencias
                            </p>
                            <button
                                onClick={() => setEditingPrefs(p => !p)}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:opacity-70 transition-all"
                            >
                                {editingPrefs ? 'Cerrar' : 'Editar'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(preferences).map(([k, v]) => (
                                <span
                                    key={k}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/5 text-primary text-[11px] font-black border border-primary/10"
                                >
                                    <span className="text-gray-400">{k}:</span> {v || '✓'}
                                    {editingPrefs && (
                                        <button onClick={() => removePreference(k)} className="ml-1 hover:text-red-500">
                                            <X size={10} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {Object.keys(preferences).length === 0 && (
                                <p className="text-xs text-gray-400">Sin preferencias registradas.</p>
                            )}
                        </div>
                        {editingPrefs && (
                            <div className="mt-3 flex gap-2">
                                <input
                                    value={newPrefKey}
                                    onChange={e => setNewPrefKey(e.target.value)}
                                    placeholder="ej: almohada"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <input
                                    value={newPrefVal}
                                    onChange={e => setNewPrefVal(e.target.value)}
                                    placeholder="ej: dura"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button
                                    onClick={addPreference}
                                    className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase hover:bg-primary/90 transition-all"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Historial de estadías */}
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <History size={12} /> Historial de Estadías
                        </p>
                        {loadingStays ? (
                            <div className="py-6 text-center"><RefreshCw className="animate-spin mx-auto text-gray-200" size={20} /></div>
                        ) : stays.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">Sin estadías registradas.</p>
                        ) : (
                            <div className="space-y-2">
                                {stays.map(s => (
                                    <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <Bed size={16} className="text-gray-300 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-secondary">
                                                Hab. {s.room?.number} <span className="text-gray-400 font-medium">({s.room?.type || 'estándar'})</span>
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {fmtDate(s.check_in)} → {fmtDate(s.check_out)} · {nights(s.check_in, s.check_out)} noche(s)
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                s.status === 'checkout' ? 'bg-gray-100 text-gray-500' :
                                                s.status === 'ocupada'  ? 'bg-primary/10 text-primary' :
                                                'bg-blue-50 text-blue-600'
                                            }`}>{s.status}</span>
                                            {s.source && s.source !== 'directo' && (
                                                <p className="text-[9px] text-gray-400 mt-0.5 uppercase">{s.source}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-black uppercase hover:bg-gray-50 transition-all">
                        Cerrar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Componente principal GuestCRM
// ─────────────────────────────────────────────
const GuestCRM = ({ selectedBranchId }) => {
    const [guests, setGuests]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [selectedGuest, setSelectedGuest] = useState(null);

    const fetchGuests = useCallback(async () => {
        if (!selectedBranchId) return;
        setLoading(true);
        try {
            // 1. Obtener IDs de habitaciones del branch
            const { data: roomsData, error: rErr } = await supabase
                .from('rooms')
                .select('id')
                .eq('branch_id', selectedBranchId);
            if (rErr) throw rErr;

            const roomIds = (roomsData || []).map(r => r.id);
            if (roomIds.length === 0) { setGuests([]); return; }

            // 2. Obtener guest_ids únicos de reservas de esas habitaciones
            const { data: bkData, error: bErr } = await supabase
                .from('bookings')
                .select('guest_id')
                .in('room_id', roomIds)
                .not('guest_id', 'is', null);
            if (bErr) throw bErr;

            const guestIds = [...new Set((bkData || []).map(b => b.guest_id))];
            if (guestIds.length === 0) { setGuests([]); return; }

            // 3. Obtener datos completos de los huéspedes
            const { data: gData, error: gErr } = await supabase
                .from('guests')
                .select('*')
                .in('id', guestIds)
                .order('full_name', { ascending: true });
            if (gErr) throw gErr;

            setGuests(gData || []);
        } catch (err) {
            console.error('Error fetching guests:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => { fetchGuests(); }, [fetchGuests]);

    const filtered = guests.filter(g => {
        const q = search.toLowerCase();
        return (
            g.full_name?.toLowerCase().includes(q) ||
            g.email?.toLowerCase().includes(q) ||
            g.phone?.includes(q) ||
            g.nationality?.toLowerCase().includes(q)
        );
    });

    // Estadísticas de lealtad
    const tierStats = guests.reduce((acc, g) => {
        const t = getLoyaltyTier(g.loyalty_points || 0).label;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
    }, {});

    const handleExportSIRE = async () => {
        const foreignGuests = guests.filter(g => {
            const nat = (g.nationality || '').toLowerCase().trim();
            return nat && !['colombia', 'colombiana', 'colombiano'].includes(nat);
        });

        if (foreignGuests.length === 0) {
            sileo.info({ title: 'Sin Extranjeros', description: 'No hay huéspedes con nacionalidad extranjera registrada.' });
            return;
        }

        try {
            const { data: bks, error } = await supabase
                .from('bookings')
                .select('guest_id, check_in, check_out, source, room:rooms(number, type)')
                .in('guest_id', foreignGuests.map(g => g.id))
                .order('check_in', { ascending: false });

            if (error) throw error;

            const headers = ['NOMBRES_Y_APELLIDOS', 'NACIONALIDAD', 'FECHA_NACIMIENTO', 'TIPO_DOCUMENTO', 'NUMERO_DOCUMENTO', 'FECHA_INGRESO', 'FECHA_SALIDA', 'NO_HABITACION', 'FUENTE'];
            const rows = [];
            for (const guest of foreignGuests) {
                const guestBks = (bks || []).filter(b => b.guest_id === guest.id);
                const bkList = guestBks.length > 0 ? guestBks : [null];
                for (const bk of bkList) {
                    rows.push([
                        guest.full_name || '',
                        guest.nationality || '',
                        guest.birth_date ? guest.birth_date.split('T')[0] : '',
                        '',
                        '',
                        bk?.check_in ? bk.check_in.split('T')[0] : '',
                        bk?.check_out ? bk.check_out.split('T')[0] : '',
                        bk?.room?.number || '',
                        bk?.source || ''
                    ]);
                }
            }

            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                .join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `SIRE_Extranjeros_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            sileo.success({ title: 'SIRE Exportado', description: `${foreignGuests.length} extranjeros — ${rows.length} registros.` });
        } catch (err) {
            sileo.error({ title: 'Error SIRE', description: err.message });
        }
    };

    const handleGuestSaved = (updatedGuest) => {
        setGuests(prev => prev.map(g => g.id === updatedGuest.id ? updatedGuest : g));
        setSelectedGuest(updatedGuest);
    };

    return (
        <div className="flex-1 flex flex-col h-full space-y-4">

            {/* Header */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-black text-secondary flex items-center gap-3">
                            <Users className="text-primary" size={24} />
                            CRM de Huéspedes
                        </h2>
                        <p className="text-xs text-gray-400 font-medium mt-1">Perfiles, preferencias y lealtad</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportSIRE}
                            title="Exportar huéspedes extranjeros — SIRE (Migración Colombia)"
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            <FileDown size={14} />
                            SIRE
                        </button>
                        <button onClick={fetchGuests} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:text-primary transition-all">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Stats de lealtad */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="p-3 bg-gray-50 rounded-2xl text-center border border-gray-100">
                        <p className="text-xl font-black text-secondary">{guests.length}</p>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total</p>
                    </div>
                    {[
                        { label: 'Oro',    count: tierStats['Oro']    || 0, cls: 'bg-yellow-50 border-yellow-100 text-yellow-600', icon: '🥇' },
                        { label: 'Plata',  count: tierStats['Plata']  || 0, cls: 'bg-slate-50 border-slate-100 text-slate-500',     icon: '🥈' },
                        { label: 'Bronce', count: tierStats['Bronce'] || 0, cls: 'bg-amber-50 border-amber-100 text-amber-700',     icon: '🥉' },
                    ].map(({ label, count, cls, icon }) => (
                        <div key={label} className={`p-3 rounded-2xl text-center border ${cls}`}>
                            <p className="text-xl font-black">{count}</p>
                            <p className="text-[9px] font-black uppercase tracking-widest">{icon} {label}</p>
                        </div>
                    ))}
                </div>

                {/* Buscador */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <Search size={16} className="text-gray-400 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, email, teléfono o país..."
                        className="bg-transparent border-none text-sm font-bold text-secondary focus:outline-none flex-1 placeholder-gray-400"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Lista de huéspedes */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-6 custom-scrollbar">
                {loading ? (
                    <div className="py-20 text-center"><RefreshCw className="animate-spin mx-auto text-gray-200" size={32} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Users size={40} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-xs font-black text-gray-400 uppercase">
                            {search ? 'Sin resultados' : 'Sin huéspedes registrados'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered.map(guest => {
                            const tier = getLoyaltyTier(guest.loyalty_points || 0);
                            const prefCount = Object.keys(guest.preferences || {}).length;
                            return (
                                <button
                                    key={guest.id}
                                    onClick={() => setSelectedGuest(guest)}
                                    className="text-left bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg shrink-0 overflow-hidden">
                                            {guest.identification_photo_url
                                                ? <img src={guest.identification_photo_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; e.target.parentElement.textContent = getInitials(guest.full_name); }} />
                                                : getInitials(guest.full_name)
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-secondary truncate">{guest.full_name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {guest.nationality && (
                                                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                                        <Globe size={10} /> {guest.nationality}
                                                    </span>
                                                )}
                                                {guest.birth_date && (
                                                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                                        <Calendar size={10} /> {new Date(guest.birth_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tier.bg} ${tier.color} ${tier.border}`}>
                                                    {tier.icon} {tier.label} · {guest.loyalty_points || 0} pts
                                                </span>
                                                {prefCount > 0 && (
                                                    <span className="flex items-center gap-1 text-[10px] text-primary font-black">
                                                        <Tag size={10} /> {prefCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-200 group-hover:text-primary transition-all shrink-0 mt-1" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de detalle */}
            {selectedGuest && (
                <GuestDetailModal
                    guest={selectedGuest}
                    onClose={() => setSelectedGuest(null)}
                    onSave={handleGuestSaved}
                />
            )}
        </div>
    );
};

export default GuestCRM;
