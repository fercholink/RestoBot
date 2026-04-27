import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Mail, CheckCircle, XCircle, Clock, AlertCircle,
    ExternalLink, Calendar, Users, DollarSign, RefreshCw,
    MapPin, Phone, ChevronRight, Inbox, Globe, Zap, Copy,
    BedDouble, Info, ArrowRight, Plus, X, CreditCard, FileText
} from 'lucide-react';
import { sileo } from 'sileo';

// ─────────────────────────────────────────────
// Configuración de canales y estados
// ─────────────────────────────────────────────
const CHANNEL_CONFIG = {
    booking: { label: 'Booking.com', color: 'bg-blue-600',   textColor: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200' },
    airbnb:  { label: 'Airbnb',      color: 'bg-rose-500',   textColor: 'text-rose-500',  bg: 'bg-rose-50',  border: 'border-rose-200' },
    expedia: { label: 'Expedia',     color: 'bg-yellow-500', textColor: 'text-yellow-600',bg: 'bg-yellow-50',border: 'border-yellow-200' },
    direct:  { label: 'Directo',     color: 'bg-emerald-500',textColor: 'text-emerald-600',bg:'bg-emerald-50',border: 'border-emerald-200' },
    manual:  { label: 'Manual',      color: 'bg-gray-500',   textColor: 'text-gray-600',  bg: 'bg-gray-100', border: 'border-gray-200' },
};

const STATUS_CONFIG = {
    pendiente:  { label: 'Pendiente',   icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    confirmada: { label: 'Confirmada',  icon: CheckCircle,   color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
    cancelada:  { label: 'Cancelada',   icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200' },
    ignorada:   { label: 'Ignorada',    icon: AlertCircle,   color: 'text-gray-400',   bg: 'bg-gray-50',   border: 'border-gray-200' },
};

const PAYMENT_STATUS_CONFIG = {
    pendiente:       { label: 'Pago pendiente',    cls: 'bg-amber-50 text-amber-600 border-amber-200' },
    pagado_canal:    { label: 'Pagado al canal',   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    pagado_hotel:    { label: 'Pagado en hotel',   cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
};

// ─────────────────────────────────────────────
// Tarjeta de reserva OTA
// ─────────────────────────────────────────────
const ChannelBookingCard = ({ cb, rooms, onConfirm, onIgnore, onCancel }) => {
    const [selectedRoom, setSelectedRoom] = useState('');
    const [expanded, setExpanded]         = useState(false);
    const [showRaw, setShowRaw]           = useState(false);

    const channel   = CHANNEL_CONFIG[cb.channel] || CHANNEL_CONFIG.manual;
    const statusCfg = STATUS_CONFIG[cb.status]   || STATUS_CONFIG.pendiente;
    const payCfg    = PAYMENT_STATUS_CONFIG[cb.payment_status] || PAYMENT_STATUS_CONFIG.pendiente;
    const StatusIcon = statusCfg.icon;

    const nights = cb.nights || Math.max(
        1,
        Math.ceil((new Date(cb.check_out) - new Date(cb.check_in)) / (1000 * 60 * 60 * 24))
    );

    const availableRooms = rooms.filter(r => r.status === 'disponible');

    return (
        <div className={`bg-white rounded-2xl border ${cb.status === 'pendiente' ? 'border-amber-200 shadow-md shadow-amber-50' : 'border-gray-100 opacity-80'} overflow-hidden transition-all`}>
            {/* Franja de color del canal */}
            <div className={`h-1 w-full ${channel.color}`} />

            <div className="p-5">
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`shrink-0 w-12 h-12 rounded-2xl ${channel.bg} ${channel.border} border flex items-center justify-center`}>
                            <Globe size={20} className={channel.textColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${channel.textColor}`}>{channel.label}</span>
                                {cb.external_id && (
                                    <span className="text-[10px] font-mono text-gray-400">#{cb.external_id}</span>
                                )}
                                <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                                    <StatusIcon size={10} />{statusCfg.label}
                                </span>
                            </div>
                            <p className="text-base font-black text-secondary mt-1 truncate">{cb.guest_name}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
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
                                {cb.guest_country && (
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                        <MapPin size={10} />{cb.guest_country}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Monto + comisión */}
                    <div className="text-right shrink-0">
                        <p className="text-lg font-black text-secondary">
                            {cb.total_amount ? `$${Number(cb.total_amount).toLocaleString('es-CO')}` : '—'}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase">{cb.currency || 'COP'}</p>
                        {cb.commission_amount > 0 && (
                            <p className="text-[10px] text-red-400 font-bold mt-0.5">
                                Comisión: ${Number(cb.commission_amount).toLocaleString('es-CO')}
                            </p>
                        )}
                        {/* Payment status */}
                        <span className={`mt-1 inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${payCfg.cls}`}>
                            <CreditCard size={9} className="inline mr-0.5" />{payCfg.label}
                        </span>
                    </div>
                </div>

                {/* Fechas y ocupantes */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
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

                {/* Notas expandibles */}
                {cb.notes && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="mt-3 flex items-center gap-1 text-[10px] text-gray-400 hover:text-secondary transition-colors"
                    >
                        <Info size={11} /> Notas del canal
                        <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                )}
                {expanded && cb.notes && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-medium border border-gray-100">
                        {cb.notes}
                    </div>
                )}

                {/* Raw email (debug) */}
                {cb.raw_email_body && (
                    <button
                        onClick={() => setShowRaw(r => !r)}
                        className="mt-1 flex items-center gap-1 text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
                    >
                        <FileText size={11} /> Email original
                        <ChevronRight size={11} className={`transition-transform ${showRaw ? 'rotate-90' : ''}`} />
                    </button>
                )}
                {showRaw && cb.raw_email_body && (
                    <pre className="mt-2 p-3 bg-gray-900 text-emerald-400 rounded-xl text-[10px] overflow-auto max-h-40 font-mono whitespace-pre-wrap border border-gray-700">
                        {cb.raw_email_body}
                    </pre>
                )}

                {/* Acciones (solo pendientes) */}
                {cb.status === 'pendiente' && (
                    <div className="mt-4 flex items-center gap-2 flex-wrap border-t border-gray-50 pt-4">
                        <select
                            value={selectedRoom}
                            onChange={e => setSelectedRoom(e.target.value)}
                            className={`flex-1 min-w-0 bg-gray-50 border text-sm font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 transition-all ${selectedRoom ? 'border-emerald-300 text-secondary' : 'border-gray-200 text-gray-400'}`}
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
                            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            <CheckCircle size={14} /> Confirmar
                        </button>
                        <button
                            onClick={() => onCancel(cb)}
                            className="flex items-center gap-2 bg-red-50 text-red-500 border border-red-200 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all active:scale-95"
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

// ─────────────────────────────────────────────
// Formulario de entrada manual
// ─────────────────────────────────────────────
const ManualEntryModal = ({ selectedBranchId, onClose, onSaved }) => {
    const EMPTY = {
        channel: 'manual', external_id: '', guest_name: '', guest_email: '',
        guest_phone: '', guest_country: '', check_in: '', check_out: '',
        adults: 1, children: 0, room_type_requested: '',
        total_amount: '', currency: 'COP', commission_amount: '',
        notes: '', payment_status: 'pendiente',
    };
    const [form, setForm]     = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                adults:           parseInt(form.adults) || 1,
                children:         parseInt(form.children) || 0,
                total_amount:     form.total_amount     ? parseFloat(form.total_amount)     : null,
                commission_amount:form.commission_amount? parseFloat(form.commission_amount): null,
                status:           'pendiente',
            };
            if (selectedBranchId) payload.branch_id = Number(selectedBranchId);
            if (!payload.external_id) delete payload.external_id;

            const { error } = await supabase.from('channel_bookings').insert([payload]);
            if (error) throw error;
            sileo.success({ title: 'Reserva registrada', description: `${form.guest_name} agregado a la bandeja.` });
            onSaved();
        } catch (err) {
            sileo.error({ title: 'Error', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20';
    const labelCls = 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-secondary text-white flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="font-black text-lg">Nueva reserva manual</h3>
                        <p className="text-white/60 text-xs mt-0.5">Registrar reserva recibida por teléfono, WhatsApp u otro canal</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Formulario scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

                    {/* Canal y ID externo */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Canal</label>
                            <select value={form.channel} onChange={e => set('channel', e.target.value)} className={inputCls}>
                                {Object.entries(CHANNEL_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>ID externo (opcional)</label>
                            <input value={form.external_id} onChange={e => set('external_id', e.target.value)} placeholder="Nro. de reserva del canal" className={inputCls} />
                        </div>
                    </div>

                    {/* Datos del huésped */}
                    <div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">Huésped</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Nombre completo *</label>
                                <input required value={form.guest_name} onChange={e => set('guest_name', e.target.value)} placeholder="Juan García" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>País</label>
                                <input value={form.guest_country} onChange={e => set('guest_country', e.target.value)} placeholder="Colombia" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input type="email" value={form.guest_email} onChange={e => set('guest_email', e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Teléfono</label>
                                <input value={form.guest_phone} onChange={e => set('guest_phone', e.target.value)} placeholder="+57 300 000 0000" className={inputCls} />
                            </div>
                        </div>
                    </div>

                    {/* Estadía */}
                    <div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">Estadía</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className={labelCls}>Check-in *</label>
                                <input required type="date" value={form.check_in} onChange={e => set('check_in', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Check-out *</label>
                                <input required type="date" value={form.check_out} onChange={e => set('check_out', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Adultos</label>
                                <input type="number" min="1" value={form.adults} onChange={e => set('adults', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Niños</label>
                                <input type="number" min="0" value={form.children} onChange={e => set('children', e.target.value)} className={inputCls} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className={labelCls}>Tipo de habitación solicitada</label>
                            <input value={form.room_type_requested} onChange={e => set('room_type_requested', e.target.value)} placeholder="Doble, Suite, Individual..." className={inputCls} />
                        </div>
                    </div>

                    {/* Financiero */}
                    <div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3">Financiero</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                                <label className={labelCls}>Valor total</label>
                                <input type="number" min="0" step="0.01" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} placeholder="0.00" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Comisión canal</label>
                                <input type="number" min="0" step="0.01" value={form.commission_amount} onChange={e => set('commission_amount', e.target.value)} placeholder="0.00" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Estado de pago</label>
                                <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} className={inputCls}>
                                    <option value="pendiente">Pago pendiente</option>
                                    <option value="pagado_canal">Pagado al canal</option>
                                    <option value="pagado_hotel">Pagado en hotel</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className={labelCls}>Notas / Solicitudes especiales</label>
                        <textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            rows={3}
                            placeholder="Cama extra, llegada tardía, alergias..."
                            className={`${inputCls} resize-none`}
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-black uppercase hover:bg-gray-50 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        Registrar reserva
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Panel de configuración n8n
// ─────────────────────────────────────────────
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
                    <h3 className="font-black text-secondary">Configuración n8n ↔ OTA</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Flujo: Email de canal → n8n parsea → inserta en Supabase</p>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 1 — Migración SQL</h4>
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs text-emerald-400">
                    <code>migration_channel_bookings.sql</code>
                    <span className="text-gray-500 ml-2">← ejecutar en Supabase SQL Editor</span>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 2 — URL del endpoint</h4>
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

            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 3 — Headers para n8n</h4>
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs text-gray-300 space-y-1">
                    <div><span className="text-blue-400">apikey:</span> <span className="text-amber-300">{`{{ $env.SUPABASE_SERVICE_ROLE_KEY }}`}</span></div>
                    <div><span className="text-blue-400">Authorization:</span> <span className="text-amber-300">{`Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`}</span></div>
                    <div><span className="text-blue-400">Content-Type:</span> <span className="text-emerald-400">application/json</span></div>
                </div>
                <p className="text-xs text-gray-500">⚠️ Usa la <strong>service_role key</strong> en n8n para que el insert no falle por RLS.</p>
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paso 4 — Body JSON desde n8n</h4>
                <div className="bg-gray-900 rounded-2xl p-4 font-mono text-xs text-gray-300 overflow-auto">
                    <pre>{`{
  "channel": "booking",
  "external_id": "{{ $json.booking_number }}",
  "guest_name": "{{ $json.guest_name }}",
  "guest_email": "{{ $json.guest_email }}",
  "guest_phone": "{{ $json.guest_phone }}",
  "guest_country": "{{ $json.guest_country }}",
  "check_in": "{{ $json.check_in }}",
  "check_out": "{{ $json.check_out }}",
  "adults": {{ $json.adults }},
  "room_type_requested": "{{ $json.room_type }}",
  "total_amount": {{ $json.total_amount }},
  "commission_amount": {{ $json.commission }},
  "currency": "COP",
  "payment_status": "pagado_canal",
  "notes": "{{ $json.special_requests }}",
  "status": "pendiente"
}`}</pre>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
const ChannelInbox = ({ rooms = [], branches = [], selectedBranchId }) => {
    const [allBookings, setAllBookings]   = useState([]);
    const [loading, setLoading]           = useState(true);
    const [filterStatus, setFilterStatus] = useState('pendiente');
    const [showConfig, setShowConfig]     = useState(false);
    const [showManual, setShowManual]     = useState(false);

    // ── Fetch con filtro por branch ──
    const fetchChannelBookings = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('channel_bookings')
                .select('*')
                .order('created_at', { ascending: false });

            if (selectedBranchId) {
                query = query.or(`branch_id.eq.${selectedBranchId},branch_id.is.null`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setAllBookings(data || []);
        } catch (err) {
            console.error('Error fetching channel bookings:', err);
            sileo.error({ title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    // ── Realtime subscription ──
    useEffect(() => {
        fetchChannelBookings();

        const channel = supabase
            .channel('channel_bookings_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_bookings' }, (payload) => {
                if (payload.eventType === 'INSERT' && payload.new?.status === 'pendiente') {
                    sileo.success({
                        title: '📩 Nueva reserva OTA',
                        description: `${payload.new.guest_name} (${CHANNEL_CONFIG[payload.new.channel]?.label || payload.new.channel})`,
                    });
                }
                fetchChannelBookings();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [fetchChannelBookings]);

    // ── Conteos por estado (derivados, sin re-fetch) ──
    const statusCounts = useMemo(() =>
        allBookings.reduce((acc, cb) => {
            acc[cb.status] = (acc[cb.status] || 0) + 1;
            return acc;
        }, {}),
    [allBookings]);

    // ── Filtrado local ──
    const displayedBookings = useMemo(() =>
        filterStatus === 'todas'
            ? allBookings
            : allBookings.filter(cb => cb.status === filterStatus),
    [allBookings, filterStatus]);

    // ── Confirmar reserva OTA → crear booking real ──
    const handleConfirm = async (cb, roomId) => {
        if (!roomId) {
            sileo.error({ title: 'Selecciona una habitación', description: 'Debes asignar una habitación antes de confirmar.' });
            return;
        }
        try {
            const nights = cb.nights || Math.max(
                1,
                Math.ceil((new Date(cb.check_out) - new Date(cb.check_in)) / (1000 * 60 * 60 * 24))
            );

            // 1. Crear booking real con campos PMS Pro
            const bookingPayload = {
                room_id:            Number(roomId),
                check_in:           cb.check_in,
                check_out:          cb.check_out,
                status:             'reservada',
                total_price:        cb.total_amount || 0,
                price_per_night:    nights > 0 ? Math.round((cb.total_amount || 0) / nights) : 0,
                source:             cb.channel,                    // ← nuevo campo PMS Pro
                ota_reservation_id: cb.external_id || null,        // ← nuevo campo PMS Pro
                metadata:           {                              // ← nuevo campo PMS Pro
                    channel_booking_id: cb.id,
                    commission_amount:  cb.commission_amount || null,
                    payment_status:     cb.payment_status || null,
                    parsed_data:        cb.parsed_data || null,
            };

            const { data: newBooking, error: bError } = await supabase
                .from('bookings')
                .insert([bookingPayload])
                .select()
                .single();

            if (bError) throw new Error(`Error creando reserva: ${bError.message}`);

            // 2. Deduplicar huésped (lookup por email, luego por nombre)
            try {
                let guestId = null;

                if (cb.guest_email) {
                    const { data: existing } = await supabase
                        .from('guests')
                        .select('id')
                        .eq('email', cb.guest_email)
                        .maybeSingle();
                    if (existing) guestId = existing.id;
                }

                if (!guestId && cb.guest_name) {
                    const { data: newGuest, error: gErr } = await supabase
                        .from('guests')
                        .insert([{
                            full_name:   cb.guest_name,
                            email:       cb.guest_email   || null,
                            phone:       cb.guest_phone   || null,
                            nationality: cb.guest_country || null,
                        }])
                        .select()
                        .single();

                    if (!gErr && newGuest) guestId = newGuest.id;
                    else if (gErr) console.warn('[ChannelInbox] guest insert skipped:', gErr.message);
                }

                if (guestId) {
                    await supabase.from('bookings').update({ guest_id: guestId }).eq('id', newBooking.id);
                }
            } catch (guestErr) {
                console.warn('[ChannelInbox] guest creation failed (non-blocking):', guestErr.message);
            }

            // 3. Marcar channel_booking como confirmada y asignarla a la sucursal
            await supabase
                .from('channel_bookings')
                .update({ 
                    status: 'confirmada', 
                    booking_id: Number(newBooking.id),
                    branch_id: selectedBranchId ? Number(selectedBranchId) : null
                })
                .eq('id', cb.id);

            sileo.success({ title: '✅ Reserva Confirmada', description: `${cb.guest_name} asignado correctamente.` });
            fetchChannelBookings();
        } catch (err) {
            console.error('[ChannelInbox] handleConfirm error:', err);
            sileo.error({ title: 'Error al confirmar', description: err.message });
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

    const pendingCount = statusCounts['pendiente'] || 0;

    const filterTabs = [
        { key: 'pendiente',  label: 'Pendientes' },
        { key: 'confirmada', label: 'Confirmadas' },
        { key: 'cancelada',  label: 'Canceladas' },
        { key: 'todas',      label: 'Todas' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
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
                        Booking.com, Airbnb, Expedia y otros canales vía n8n.
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
                        onClick={() => setShowManual(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-sm"
                    >
                        <Plus size={13} /> Manual
                    </button>
                    <button
                        onClick={() => setShowConfig(c => !c)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${showConfig ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-purple-300 hover:text-purple-600'}`}
                    >
                        <Zap size={13} /> n8n
                    </button>
                </div>
            </div>

            {/* Panel n8n */}
            {showConfig && <N8nConfigPanel />}

            {/* Tabs de filtro con conteos */}
            <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-100 p-1 shadow-sm w-fit flex-wrap">
                {filterTabs.map(({ key, label }) => {
                    const count = key === 'todas' ? allBookings.length : (statusCounts[key] || 0);
                    return (
                        <button
                            key={key}
                            onClick={() => setFilterStatus(key)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterStatus === key ? 'bg-secondary text-white shadow-sm' : 'text-gray-400 hover:text-secondary'}`}
                        >
                            {label}
                            {count > 0 && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${filterStatus === key ? 'bg-white/20 text-white' : key === 'pendiente' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center py-20 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : displayedBookings.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                        <Inbox size={48} className="text-gray-200 mx-auto" />
                        <div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Bandeja vacía</p>
                            <p className="text-xs text-gray-300 mt-1 font-medium">
                                {filterStatus === 'pendiente'
                                    ? 'Las reservas de n8n aparecerán aquí. También puedes agregar una manualmente.'
                                    : 'No hay reservas con este estado.'}
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setShowManual(true)}
                                className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest border border-primary/20 px-4 py-2 rounded-xl hover:bg-primary/5 transition-all"
                            >
                                <Plus size={12} /> Entrada manual
                            </button>
                            <button
                                onClick={() => setShowConfig(true)}
                                className="flex items-center gap-2 text-xs font-black text-purple-500 uppercase tracking-widest border border-purple-200 px-4 py-2 rounded-xl hover:bg-purple-50 transition-all"
                            >
                                <Zap size={12} /> Configurar n8n
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayedBookings.map(cb => (
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

            {/* Modal entrada manual */}
            {showManual && (
                <ManualEntryModal
                    selectedBranchId={selectedBranchId}
                    onClose={() => setShowManual(false)}
                    onSaved={() => { setShowManual(false); fetchChannelBookings(); }}
                />
            )}
        </div>
    );
};

export default ChannelInbox;
