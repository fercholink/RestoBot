import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Mail, CheckCircle, XCircle, Clock, AlertCircle,
    ExternalLink, Calendar, Users, DollarSign, RefreshCw,
    MapPin, Phone, ChevronRight, Inbox, Globe, Zap, Copy,
    BedDouble, Info, ArrowRight
} from 'lucide-react';
import { sileo } from 'sileo';

const CHANNEL_CONFIG = {
    booking: { label: 'Booking.com', color: 'bg-blue-600', textColor: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    airbnb: { label: 'Airbnb', color: 'bg-rose-500', textColor: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' },
    expedia: { label: 'Expedia', color: 'bg-yellow-500', textColor: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    direct: { label: 'Directo', color: 'bg-emerald-500', textColor: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    manual: { label: 'Manual', color: 'bg-gray-500', textColor: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
};

const STATUS_CONFIG = {
    pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    confirmada: { label: 'Confirmada', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    cancelada: { label: 'Cancelada', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
    ignorada: { label: 'Ignorada', icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
};

// -------------------------------------------------------
// Card de una reserva del canal
// -------------------------------------------------------
const ChannelBookingCard = ({ cb, rooms, onConfirm, onIgnore, onCancel }) => {
    const [selectedRoom, setSelectedRoom] = useState('');
    const [expanded, setExpanded] = useState(false);

    const channel = CHANNEL_CONFIG[cb.channel] || CHANNEL_CONFIG.manual;
    const statusCfg = STATUS_CONFIG[cb.status] || STATUS_CONFIG.pendiente;
    const StatusIcon = statusCfg.icon;

    const nights = cb.nights || Math.max(
        1,
        Math.ceil((new Date(cb.check_out) - new Date(cb.check_in)) / (1000 * 60 * 60 * 24))
    );

    const availableRooms = rooms.filter(r => r.status === 'disponible');

    return (
        <div className={`bg-white rounded-2xl border ${cb.status === 'pendiente' ? 'border-amber-200 shadow-md shadow-amber-50' : 'border-gray-100 opacity-70'} overflow-hidden transition-all`}>
            {/* Header Strip */}
            <div className={`h-1 w-full ${channel.color}`} />

            <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Channel Badge */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-2xl ${channel.bg} ${channel.border} border flex items-center justify-center`}>
                            <Globe size={20} className={channel.textColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${channel.textColor}`}>{channel.label}</span>
                                {cb.external_id && (
                                    <span className="text-[10px] font-mono text-gray-400">#{cb.external_id}</span>
                                )}
                                <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                                    <StatusIcon size={10} />{statusCfg.label}
                                </span>
                            </div>
                            <p className="text-base font-black text-secondary mt-1 truncate">{cb.guest_name}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {cb.guest_email && (
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                        <Mail size={10} />{cb.guest_email}
                                    </span>
                                )}
                                {cb.guest_phone && (
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                        <Phone size={10} />{cb.guest_phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Dates + Amount */}
                    <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-secondary">
                            {cb.total_amount ? `$${Number(cb.total_amount).toLocaleString('es-CO')}` : '—'}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase">{cb.currency}</p>
                        {cb.commission_amount && (
                            <p className="text-[10px] text-red-400 font-bold mt-0.5">Comisión: ${Number(cb.commission_amount).toLocaleString('es-CO')}</p>
                        )}
                    </div>
                </div>

                {/* Dates row */}
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold text-secondary">
                        <Calendar size={13} className="text-blue-400" />
                        <span>{new Date(cb.check_in + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                        <ArrowRight size={12} className="text-gray-400" />
                        <span>{new Date(cb.check_out + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                        <span className="text-gray-400">({nights} noche{nights !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                        <Users size={13} className="text-purple-400" />
                        {cb.adults || 1} adulto{(cb.adults || 1) > 1 ? 's' : ''}
                        {cb.children > 0 && `, ${cb.children} niño${cb.children > 1 ? 's' : ''}`}
                    </div>
                    {cb.room_type_requested && (
                        <div className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                            <BedDouble size={13} className="text-emerald-400" />
                            {cb.room_type_requested}
                        </div>
                    )}
                </div>

                {/* Expand Notes */}
                {cb.notes && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="mt-3 flex items-center gap-1 text-[10px] text-gray-400 hover:text-secondary transition-colors"
                    >
                        <Info size={11} /> Notas del canal <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                )}
                {expanded && cb.notes && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-medium border border-gray-100">
                        {cb.notes}
                    </div>
                )}

                {/* Actions (only for pending) */}
                {cb.status === 'pendiente' && (
                    <div className="mt-4 flex items-center gap-3 flex-wrap border-t border-gray-50 pt-4">
                        {/* Assign room + confirm */}
                        <select
                            value={selectedRoom}
                            onChange={e => setSelectedRoom(e.target.value)}
                            className={`flex-1 bg-gray-50 border text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 transition-all ${selectedRoom ? 'border-emerald-300 text-secondary' : 'border-gray-200 text-gray-400'}`}
                        >
                            <option value="">— Asignar habitación —</option>
                            {availableRooms.map(r => (
                                <option key={r.id} value={r.id}>
                                    Hab. {r.number} {r.name ? `(${r.name})` : ''} {r.type ? `· ${r.type}` : ''}
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => onConfirm(cb, selectedRoom)}
                            disabled={!selectedRoom}
                            className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            <CheckCircle size={14} /> Confirmar
                        </button>

                        <button
                            onClick={() => onCancel(cb)}
                            className="flex items-center gap-2 bg-red-50 text-red-500 border border-red-200 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95"
                        >
                            <XCircle size={14} /> Cancelar
                        </button>

                        <button
                            onClick={() => onIgnore(cb)}
                            className="text-xs text-gray-400 hover:text-gray-600 font-black uppercase tracking-widest transition-colors"
                        >
                            Ignorar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// -------------------------------------------------------
// Panel de Configuración n8n
// -------------------------------------------------------
const N8nConfigPanel = () => {
    const [copied, setCopied] = useState(false);
    const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/channel_bookings`;

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center">
                    <Zap size={20} className="text-purple-500" />
                </div>
                <div>
                    <h3 className="font-black text-secondary">Configuración n8n ↔ Booking.com</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Flujo: Email de Booking → n8n parsea → inserta en Supabase</p>
                </div>
            </div>

            {/* Step 1 */}
            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 1 — Ejecutar migración SQL en Supabase</h4>
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs text-emerald-400 relative overflow-auto whitespace-nowrap">
                    <code>migration_channel_bookings.sql</code>
                    <span className="text-gray-500 ml-2">← ya lo tienes en la carpeta dashboard/</span>
                </div>
                <p className="text-xs text-gray-500">Pega el contenido de ese archivo en el SQL Editor de Supabase y dale Run.</p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 2 — URL del endpoint para n8n</h4>
                <div className="flex items-center gap-2">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-xs text-secondary flex-1 overflow-auto whitespace-nowrap">
                        {webhookUrl}
                    </div>
                    <button
                        onClick={() => handleCopy(webhookUrl)}
                        className={`flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                        {copied ? '¡Copiado!' : 'Copiar'}
                    </button>
                </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 3 — Headers para el nodo HTTP en n8n</h4>
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs text-gray-300 space-y-1">
                    <div><span className="text-blue-400">apikey:</span> <span className="text-amber-300">{`{{ $env.SUPABASE_SERVICE_ROLE_KEY }}`}</span></div>
                    <div><span className="text-blue-400">Authorization:</span> <span className="text-amber-300">{`Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`}</span></div>
                    <div><span className="text-blue-400">Content-Type:</span> <span className="text-emerald-400">application/json</span></div>
                </div>
                <p className="text-xs text-gray-500">⚠️ Usa la <strong>service_role key</strong> en n8n (no la anon key) para que el insert no falle por RLS.</p>
            </div>

            {/* Step 4 - JSON example */}
            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 4 — Body JSON a insertar desde n8n</h4>
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs text-gray-300 space-y-1 overflow-auto">
                    <pre className="text-xs">{`{
  "channel": "booking",
  "external_id": "{{ $json.booking_number }}",
  "guest_name": "{{ $json.guest_name }}",
  "guest_email": "{{ $json.guest_email }}",
  "guest_phone": "{{ $json.guest_phone }}",
  "check_in": "{{ $json.check_in }}",
  "check_out": "{{ $json.check_out }}",
  "adults": {{ $json.adults }},
  "room_type_requested": "{{ $json.room_type }}",
  "total_amount": {{ $json.total_amount }},
  "currency": "COP",
  "notes": "{{ $json.special_requests }}",
  "status": "pendiente"
}`}</pre>
                </div>
            </div>
        </div>
    );
};

// -------------------------------------------------------
// Componente Principal
// -------------------------------------------------------
const ChannelInbox = ({ rooms = [], branches = [], selectedBranchId }) => {
    const [channelBookings, setChannelBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pendiente');
    const [showConfig, setShowConfig] = useState(false);

    useEffect(() => {
        fetchChannelBookings();
    }, [filterStatus]);

    const fetchChannelBookings = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('channel_bookings')
                .select('*')
                .order('created_at', { ascending: false });

            if (filterStatus !== 'todas') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;
            setChannelBookings(data || []);
        } catch (error) {
            console.error('Error fetching channel bookings:', error);
            sileo.error({ title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (cb, roomId) => {
        if (!roomId) {
            sileo.error({ title: 'Selecciona una habitación', description: 'Debes asignar una habitación antes de confirmar.' });
            return;
        }
        try {
            // 1. Crear booking real
            const { data: newBooking, error: bError } = await supabase
                .from('bookings')
                .insert([{
                    room_id: roomId,
                    branch_id: selectedBranchId,
                    check_in: cb.check_in,
                    check_out: cb.check_out,
                    status: 'reservada',
                    total_price: cb.total_amount || 0,
                    price_per_night: cb.nights ? (cb.total_amount / cb.nights) : 0,
                    notes: `[${CHANNEL_CONFIG[cb.channel]?.label || cb.channel}] ${cb.notes || ''}`.trim(),
                }])
                .select()
                .single();

            if (bError) throw bError;

            // Si hay datos del huésped, crear/actualizar el guest
            if (cb.guest_name) {
                const { data: guest } = await supabase
                    .from('guests')
                    .insert([{
                        full_name: cb.guest_name,
                        email: cb.guest_email || null,
                        phone: cb.guest_phone || null,
                    }])
                    .select()
                    .single();

                if (guest) {
                    await supabase.from('bookings').update({ guest_id: guest.id }).eq('id', newBooking.id);
                }
            }

            // 2. Actualizar channel_booking
            await supabase
                .from('channel_bookings')
                .update({ status: 'confirmada', booking_id: newBooking.id })
                .eq('id', cb.id);

            sileo.success({ title: '✅ Reserva Confirmada', description: `${cb.guest_name} asignado/a correctamente.` });
            fetchChannelBookings();
        } catch (error) {
            sileo.error({ title: 'Error al confirmar', description: error.message });
        }
    };

    const handleIgnore = async (cb) => {
        await supabase.from('channel_bookings').update({ status: 'ignorada' }).eq('id', cb.id);
        sileo.success({ title: 'Marcada como ignorada' });
        fetchChannelBookings();
    };

    const handleCancel = async (cb) => {
        await supabase.from('channel_bookings').update({ status: 'cancelada' }).eq('id', cb.id);
        sileo.success({ title: 'Marcada como cancelada' });
        fetchChannelBookings();
    };

    const pendingCount = channelBookings.filter(cb => cb.status === 'pendiente').length;

    return (
        <div className="flex-1 flex flex-col h-full fade-in space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-secondary flex items-center gap-3">
                        <Inbox className="text-blue-500" size={22} />
                        Bandeja de Canales OTA
                        {pendingCount > 0 && (
                            <span className="text-xs font-black bg-amber-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                                {pendingCount} nueva{pendingCount !== 1 ? 's' : ''}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-gray-400 font-medium mt-1">
                        Reservas entrantes desde Booking.com, Airbnb y otros canales vía n8n.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchChannelBookings}
                        className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-secondary hover:border-secondary transition-all"
                    >
                        <RefreshCw size={15} />
                    </button>
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${showConfig ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:border-purple-300 hover:text-purple-600'}`}
                    >
                        <Zap size={13} />
                        Configurar n8n
                    </button>
                </div>
            </div>

            {/* Config Panel */}
            {showConfig && <N8nConfigPanel />}

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-100 p-1 shadow-sm w-fit">
                {['pendiente', 'confirmada', 'cancelada', 'todas'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                    >
                        {s === 'pendiente' ? 'Pendientes' : s === 'confirmada' ? 'Confirmadas' : s === 'cancelada' ? 'Canceladas' : 'Todas'}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center py-20 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : channelBookings.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                        <Inbox size={48} className="text-gray-200 mx-auto" />
                        <div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Bandeja vacía</p>
                            <p className="text-xs text-gray-300 mt-1 font-medium">
                                {filterStatus === 'pendiente'
                                    ? 'Cuando llegue un email de Booking.com, n8n lo procesará y aparecerá aquí.'
                                    : 'No hay reservas con este estado.'}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowConfig(true)}
                            className="mx-auto flex items-center gap-2 text-xs font-black text-purple-500 uppercase tracking-widest border border-purple-200 px-4 py-2 rounded-xl hover:bg-purple-50 transition-all"
                        >
                            <Zap size={12} /> Configurar flujo n8n
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {channelBookings.map(cb => (
                            <ChannelBookingCard
                                key={cb.id}
                                cb={cb}
                                rooms={rooms}
                                onConfirm={handleConfirm}
                                onIgnore={handleIgnore}
                                onCancel={handleCancel}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChannelInbox;
