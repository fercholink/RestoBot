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
    if (points >= 500) return { label: 'Oro',    color: 'text-amber-600', bg: 'bg-amber-500/10',   border: 'border-amber-200/20', icon: '🥇' };
    if (points >= 100) return { label: 'Plata',  color: 'text-slate-500',  bg: 'bg-slate-500/10',    border: 'border-slate-200/20',  icon: '🥈' };
    return               { label: 'Bronce', color: 'text-orange-700',  bg: 'bg-orange-500/10',    border: 'border-orange-200/20',  icon: '🥉' };
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-canvas rounded-[24px] shadow-airbnb w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-hairline">

                {/* Header del modal */}
                <div className="p-8 flex justify-between items-start bg-secondary text-white shrink-0 relative overflow-hidden">
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-20 h-20 rounded-[20px] bg-white/10 flex items-center justify-center font-bold text-3xl overflow-hidden border border-white/10 backdrop-blur-md">
                            {guest.identification_photo_url
                                ? <img src={guest.identification_photo_url} alt="" className="w-full h-full object-cover" />
                                : getInitials(guest.full_name)
                            }
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{guest.full_name}</h2>
                            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                                <Globe size={12} /> {guest.nationality || 'Sin nacionalidad'} · {guest.birth_date ? fmtDate(guest.birth_date) : 'Sin fecha de nacimiento'}
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${tier.bg} ${tier.color} border ${tier.border} backdrop-blur-sm`}>
                                    {tier.icon} {tier.label} · {(guest.loyalty_points || 0) + loyaltyDelta} pts
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-full transition-all group relative z-10">
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                    <Award className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48 pointer-events-none" />
                </div>

                {/* Contenido scrollable */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

                    {/* Contacto */}
                    <div className="grid grid-cols-2 gap-4">
                        {guest.email && (
                            <div className="flex items-center gap-3 p-4 bg-surface-soft border border-hairline rounded-[16px] hover:shadow-sm transition-all group">
                                <Mail size={16} className="text-accent group-hover:text-primary transition-colors" />
                                <span className="text-[13px] font-bold text-secondary truncate">{guest.email}</span>
                            </div>
                        )}
                        {guest.phone && (
                            <div className="flex items-center gap-3 p-4 bg-surface-soft border border-hairline rounded-[16px] hover:shadow-sm transition-all group">
                                <Phone size={16} className="text-accent group-hover:text-primary transition-colors" />
                                <span className="text-[13px] font-bold text-secondary">{guest.phone}</span>
                            </div>
                        )}
                    </div>

                    {/* Firma digital */}
                    {guest.signature_url && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Firma Digital</p>
                            </div>
                            <div className="border border-hairline rounded-[20px] p-5 bg-surface-soft/30 flex items-center justify-center">
                                <img
                                    src={guest.signature_url}
                                    alt="Firma"
                                    className="max-h-24 object-contain contrast-125 grayscale brightness-90"
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Puntos de lealtad */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Estatus de Fidelidad</p>
                        </div>
                        <div className="flex items-center gap-6 p-6 bg-canvas border border-hairline rounded-[24px] shadow-sm">
                            <button
                                onClick={() => setLoyaltyDelta(d => Math.max(d - 10, -(guest.loyalty_points || 0)))}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-soft text-accent hover:text-danger hover:bg-danger/5 transition-all border border-hairline shadow-sm active:scale-95"
                            >
                                <Minus size={20} />
                            </button>
                            <div className="flex-1 text-center">
                                <p className="text-4xl font-bold text-secondary tracking-tight">{(guest.loyalty_points || 0) + loyaltyDelta}</p>
                                <p className="text-[10px] text-accent uppercase tracking-widest font-bold mt-1">puntos acumulados</p>
                                {loyaltyDelta !== 0 && (
                                    <div className={`text-[10px] font-bold mt-2 px-3 py-1 rounded-full inline-block ${loyaltyDelta > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                        {loyaltyDelta > 0 ? '+' : ''}{loyaltyDelta} cambios pendientes
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setLoyaltyDelta(d => d + 10)}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-soft text-accent hover:text-primary hover:bg-primary/5 transition-all border border-hairline shadow-sm active:scale-95"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className={`flex items-center justify-between px-5 py-3 rounded-full border ${tier.border} ${tier.bg}`}>
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${tier.color}`}>{tier.icon} Miembro {tier.label}</span>
                            {tier.label === 'Bronce' && <span className="text-[10px] text-accent font-bold">Faltan {100 - ((guest.loyalty_points || 0) + loyaltyDelta)} pts para Plata</span>}
                            {tier.label === 'Plata'  && <span className="text-[10px] text-accent font-bold">Faltan {500 - ((guest.loyalty_points || 0) + loyaltyDelta)} pts para Oro</span>}
                            {tier.label === 'Oro'    && <span className="text-[10px] text-success font-bold uppercase tracking-widest">Nivel Élite Alcanzado</span>}
                        </div>
                    </div>

                    {/* Preferencias */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Preferencia de Huésped</p>
                            </div>
                            <button
                                onClick={() => setEditingPrefs(p => !p)}
                                className="text-[10px] font-bold text-primary uppercase tracking-widest hover:bg-primary/5 px-3 py-1.5 rounded-full transition-all border border-primary/10"
                            >
                                {editingPrefs ? 'Finalizar Edición' : 'Gestionar'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            {Object.entries(preferences).map(([k, v]) => (
                                <span
                                    key={k}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-soft text-secondary text-[12px] font-bold border border-hairline shadow-sm group hover:border-primary/30 transition-all"
                                >
                                    <span className="text-accent/60 font-bold uppercase text-[9px] tracking-widest">{k}</span>
                                    <span className="w-1 h-1 rounded-full bg-accent/20" />
                                    <span>{v || 'Confirmado'}</span>
                                    {editingPrefs && (
                                        <button onClick={() => removePreference(k)} className="ml-1 text-accent hover:text-danger p-1 rounded-full hover:bg-danger/5 transition-all">
                                            <X size={12} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {Object.keys(preferences).length === 0 && (
                                <div className="w-full py-6 px-8 bg-surface-soft/50 rounded-[20px] border border-hairline border-dashed text-center">
                                    <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Sin preferencias registradas</p>
                                </div>
                            )}
                        </div>
                        {editingPrefs && (
                            <div className="mt-4 flex gap-3 p-4 bg-surface-soft rounded-[20px] border border-hairline">
                                <input
                                    value={newPrefKey}
                                    onChange={e => setNewPrefKey(e.target.value)}
                                    placeholder="Clave (ej: almohada)"
                                    className="flex-1 bg-canvas border border-hairline rounded-full px-5 py-2.5 text-[12px] font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                                <input
                                    value={newPrefVal}
                                    onChange={e => setNewPrefVal(e.target.value)}
                                    placeholder="Valor (ej: extra suave)"
                                    className="flex-1 bg-canvas border border-hairline rounded-full px-5 py-2.5 text-[12px] font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                                <button
                                    onClick={addPreference}
                                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary text-white hover:shadow-airbnb transition-all active:scale-90"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Historial de estadías */}
                    <div className="space-y-4 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <p className="text-[11px] font-bold text-accent uppercase tracking-widest">Bitácora de Estadías</p>
                        </div>
                        {loadingStays ? (
                            <div className="py-12 text-center"><RefreshCw className="animate-spin mx-auto text-accent/20" size={32} /></div>
                        ) : stays.length === 0 ? (
                            <div className="w-full py-8 bg-surface-soft/50 rounded-[20px] border border-hairline border-dashed text-center">
                                <p className="text-[11px] font-bold text-accent uppercase tracking-widest">No registra historial de reservas</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {stays.map(s => (
                                    <div key={s.id} className="flex items-center gap-4 p-5 bg-canvas border border-hairline rounded-[20px] shadow-sm hover:shadow-airbnb hover:border-primary/20 transition-all group">
                                        <div className="w-10 h-10 rounded-full bg-surface-soft flex items-center justify-center text-accent group-hover:text-primary transition-colors border border-hairline">
                                            <Bed size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-[13px] font-bold text-secondary">Habitación {s.room?.number}</p>
                                                <span className="text-[10px] font-bold text-accent uppercase tracking-widest">({s.room?.type || 'estándar'})</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-accent mt-1 uppercase tracking-wider">
                                                {fmtDate(s.check_in)} — {fmtDate(s.check_out)} <span className="mx-1.5 opacity-30">|</span> {nights(s.check_in, s.check_out)} NOCHES
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
                                                s.status === 'checkout' ? 'bg-surface-soft text-accent border-hairline' :
                                                s.status === 'ocupada'  ? 'bg-success/10 text-success border-success/20' :
                                                'bg-primary/5 text-primary border-primary/10'
                                            }`}>{s.status}</span>
                                            {s.source && s.source !== 'directo' && (
                                                <p className="text-[9px] font-bold text-accent/40 mt-1.5 uppercase tracking-widest">{s.source}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-canvas border-t border-hairline flex gap-4 shrink-0">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-4 rounded-full border border-hairline text-accent text-[11px] font-bold uppercase tracking-widest hover:bg-surface-soft transition-all"
                    >
                        Cerrar Perfil
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-4 rounded-full bg-secondary text-white text-[11px] font-bold uppercase tracking-widest hover:shadow-airbnb transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        Sincronizar Datos
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
        <div className="flex-1 flex flex-col h-full space-y-6">
            {/* Header y Stats */}
            <div className="bg-canvas rounded-[24px] border border-hairline p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Users className="text-primary" size={18} />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-accent">CRM de Huéspedes</span>
                        </div>
                        <h2 className="text-2xl font-bold text-secondary">Base de Datos</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportSIRE}
                            title="Exportar huéspedes extranjeros — SIRE (Migración Colombia)"
                            className="flex items-center gap-2 px-6 py-3.5 bg-surface-soft text-secondary rounded-full hover:bg-gray-100 transition-all text-[11px] font-bold uppercase tracking-widest border border-hairline shadow-sm"
                        >
                            <FileDown size={16} />
                            SIRE
                        </button>
                        <button onClick={fetchGuests} className="p-3.5 bg-surface-soft text-accent rounded-full hover:text-primary transition-all border border-hairline shadow-sm">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                {/* Stats de lealtad */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-5 bg-surface-soft rounded-[20px] border border-hairline">
                        <p className="text-2xl font-bold text-secondary">{guests.length}</p>
                        <p className="text-[11px] font-bold text-accent uppercase tracking-widest mt-1">Total Huéspedes</p>
                    </div>
                    {[
                        { label: 'Oro',    count: tierStats['Oro']    || 0, cls: 'bg-amber-500/5 border-amber-200/20 text-amber-600', icon: '🥇' },
                        { label: 'Plata',  count: tierStats['Plata']  || 0, cls: 'bg-slate-500/5 border-slate-200/20 text-slate-500',     icon: '🥈' },
                        { label: 'Bronce', count: tierStats['Bronce'] || 0, cls: 'bg-orange-500/5 border-orange-200/20 text-orange-700',     icon: '🥉' },
                    ].map(({ label, count, cls, icon }) => (
                        <div key={label} className={`p-5 rounded-[20px] border ${cls}`}>
                            <p className="text-2xl font-bold">{count}</p>
                            <p className="text-[11px] font-bold uppercase tracking-widest mt-1">{icon} Nivel {label}</p>
                        </div>
                    ))}
                </div>

                {/* Buscador */}
                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-accent group-focus-within:text-primary transition-colors" size={18} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, email, teléfono o país..."
                        className="w-full pl-14 pr-12 py-4 bg-surface-soft border border-hairline rounded-[16px] text-[13px] font-bold text-secondary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all placeholder:text-accent/50"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-accent hover:text-danger p-1">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Lista de huéspedes */}
            <div className="flex-1 overflow-y-auto pb-8 custom-scrollbar">
                {loading ? (
                    <div className="py-24 text-center"><RefreshCw className="animate-spin mx-auto text-accent/20" size={48} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-32 bg-canvas rounded-[32px] border border-hairline border-dashed">
                        <Users size={64} className="mx-auto text-accent/10 mb-6" />
                        <p className="text-[13px] font-bold text-accent uppercase tracking-widest">
                            {search ? 'Sin resultados para tu búsqueda' : 'No hay huéspedes registrados aún'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filtered.map(guest => {
                            const tier = getLoyaltyTier(guest.loyalty_points || 0);
                            const prefCount = Object.keys(guest.preferences || {}).length;
                            return (
                                <button
                                    key={guest.id}
                                    onClick={() => setSelectedGuest(guest)}
                                    className="text-left bg-canvas rounded-[24px] border border-hairline p-6 shadow-sm hover:shadow-airbnb hover:border-primary/30 transition-all duration-300 group relative overflow-hidden"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="w-16 h-16 rounded-[20px] bg-primary/5 text-primary flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden border border-hairline">
                                            {guest.identification_photo_url
                                                ? <img src={guest.identification_photo_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={e => { e.target.style.display='none'; e.target.parentElement.textContent = getInitials(guest.full_name); }} />
                                                : getInitials(guest.full_name)
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <p className="text-[15px] font-bold text-secondary truncate group-hover:text-primary transition-colors">{guest.full_name}</p>
                                            <div className="flex flex-col gap-1 mt-2">
                                                {guest.nationality && (
                                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-widest">
                                                        <Globe size={12} className="text-accent/40" /> {guest.nationality}
                                                    </span>
                                                )}
                                                {guest.birth_date && (
                                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-widest">
                                                        <Calendar size={12} className="text-accent/40" /> {new Date(guest.birth_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            <ChevronRight size={18} className="text-accent group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-hairline">
                                        <span className={`text-[9px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full border ${tier.bg} ${tier.color} ${tier.border}`}>
                                            {tier.icon} {tier.label} · {guest.loyalty_points || 0} pts
                                        </span>
                                        {prefCount > 0 && (
                                            <span className="flex items-center gap-1.5 text-[10px] text-primary font-bold uppercase tracking-widest">
                                                <Tag size={12} /> {prefCount} preferencias
                                            </span>
                                        )}
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
