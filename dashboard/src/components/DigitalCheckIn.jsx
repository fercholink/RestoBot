import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
    User, IdCard, Camera, CheckCircle, Save,
    ArrowRight, MapPin, Calendar, Smartphone, Globe, PenTool
} from 'lucide-react';
import { sileo } from 'sileo';

const DigitalCheckIn = () => {
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // 1: Welcome/Info, 2: Document, 3: Signature, 4: Done
    const [formData, setFormData] = useState({
        full_name: '',
        identification: '',
        email: '',
        phone: '',
        nationality: '',
        preferences: ''
    });

    const [idPhoto, setIdPhoto] = useState(null);
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // 1. Detectar ID de reserva en la URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const bookingId = urlParams.get('id');

        if (bookingId) {
            fetchBooking(bookingId);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchBooking = async (id) => {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    room:rooms(number, type, name),
                    guest:guests(*),
                    branch:branches(name)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setBooking(data);

            if (data.guest) {
                setFormData({
                    full_name: data.guest.full_name || '',
                    identification: data.guest.identification || '',
                    email: data.guest.email || '',
                    phone: data.guest.phone || '',
                    nationality: data.guest.nationality || '',
                    preferences: data.guest.preferences || ''
                });
            }
        } catch (error) {
            console.error("Error fetching booking for check-in:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. Lógica de Firma (Canvas)
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(
            (e.clientX || e.touches[0].clientX) - rect.left,
            (e.clientY || e.touches[0].clientY) - rect.top
        );
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        ctx.lineTo(
            (e.clientX || e.touches[0].clientX) - rect.left,
            (e.clientY || e.touches[0].clientY) - rect.top
        );
        ctx.stroke();
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // 3. Submit final
    const handleSubmit = async () => {
        setLoading(true);
        try {
            // A. Guardar Firma como DataURL (simplificado, idealmente a Storage)
            const signatureData = canvasRef.current.toDataURL();

            // B. Actualizar o Crear Guest
            let guestId = booking.guest_id;
            const guestPayload = {
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone,
                nationality: formData.nationality,
                preferences: formData.preferences,
                signature_url: signatureData, // En una app real, subiríamos a Supabase Storage
            };

            if (guestId) {
                await supabase.from('guests').update(guestPayload).eq('id', guestId);
            } else {
                const { data: newGuest } = await supabase.from('guests').insert([guestPayload]).select().single();
                guestId = newGuest.id;
            }

            // C. Actualizar Booking
            await supabase.from('bookings').update({
                guest_id: guestId,
                status: 'pre_checkin' // Estado intermedio indicando que ya llenó sus datos
            }).eq('id', booking.id);

            setStep(4);
            sileo.success({ title: 'Check-in Completado', description: 'Tus datos han sido registrados con éxito.' });
        } catch (error) {
            sileo.error({ title: 'Error', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (loading && step !== 4) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 text-center">
            <Smartphone className="animate-bounce text-primary mb-4" size={48} />
            <p className="text-secondary font-black animate-pulse">Cargando tu experiencia de bienvenida...</p>
        </div>
    );

    if (!booking && !loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 text-center">
            <Globe className="text-gray-300 mb-4" size={64} />
            <h2 className="text-xl font-black text-secondary">Link Inválido</h2>
            <p className="text-sm text-gray-400 mt-2">No pudimos encontrar tu reserva. Por favor contacta al hotel por WhatsApp.</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 md:py-10 flex items-center justify-center">
            <div className="w-full max-w-lg bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col min-h-screen md:min-h-0">

                {/* Header Contextual */}
                <div className="bg-secondary p-8 text-white relative">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Check-in Digital Express</p>
                        <h1 className="text-3xl font-black tracking-tighter">Bienvenido/a a {booking.branch?.name || 'Nuestro Hotel'}</h1>
                        <div className="flex items-center gap-4 mt-4 opacity-80">
                            <div className="flex items-center gap-1.5"><Calendar size={14} /> <span className="text-xs font-bold">{booking.check_in}</span></div>
                            <div className="flex items-center gap-1.5"><MapPin size={14} /> <span className="text-xs font-bold">Hab. {booking.room?.number}</span></div>
                        </div>
                    </div>
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                </div>

                <div className="flex-1 p-8">
                    {/* Stepper Visual */}
                    <div className="flex gap-2 mb-8">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-primary' : 'bg-gray-100'}`}></div>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="space-y-4">
                                <h3 className="text-lg font-black text-secondary">Confirma tus datos obligatorios</h3>
                                <div className="space-y-3">
                                    <div className="relative flex items-center">
                                        <User className="absolute left-4 text-gray-400" size={18} />
                                        <input
                                            placeholder="Nombre Completo"
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-secondary focus:ring-2 focus:ring-primary/20 transition-all"
                                            value={formData.full_name}
                                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="relative flex items-center">
                                        <IdCard className="absolute left-4 text-gray-400" size={18} />
                                        <input
                                            placeholder="DNI / Pasaporte"
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-secondary"
                                            value={formData.identification}
                                            onChange={e => setFormData({ ...formData, identification: e.target.value })}
                                        />
                                    </div>
                                    <div className="relative flex items-center">
                                        <Globe className="absolute left-4 text-gray-400" size={18} />
                                        <input
                                            placeholder="Nacionalidad"
                                            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-secondary"
                                            value={formData.nationality}
                                            onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                Siguiente Paso <ArrowRight size={18} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <h3 className="text-lg font-black text-secondary">Documento de Identidad</h3>
                            <p className="text-sm text-gray-400 font-medium">Por favor, toma una foto de tu documento oficial para validar tu estadía.</p>

                            <div className="border-2 border-dashed border-gray-100 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 bg-gray-50 hover:bg-white hover:border-primary/20 transition-all group cursor-pointer h-56 relative overflow-hidden">
                                {idPhoto ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-50 text-emerald-600">
                                        <CheckCircle size={48} className="mb-2" />
                                        <p className="font-black text-xs uppercase tracking-widest">Documento Capturado</p>
                                        <button onClick={() => setIdPhoto(null)} className="mt-4 text-[10px] font-bold underline">Eliminar y volver a tomar</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-4 bg-white rounded-2xl shadow-sm text-gray-300 group-hover:text-primary group-hover:shadow-md transition-all">
                                            <Camera size={32} />
                                        </div>
                                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Toque para Capturar</p>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={() => setIdPhoto(true)}
                                />
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 py-4 text-gray-400 font-black text-xs uppercase tracking-widest">Volver</button>
                                <button
                                    onClick={() => setStep(3)}
                                    disabled={!idPhoto}
                                    className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all text-xs uppercase tracking-widest disabled:opacity-30"
                                >
                                    Siguiente Paso
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <h3 className="text-lg font-black text-secondary">Firma Digital</h3>
                            <p className="text-sm text-gray-400 font-medium">Para finalizar, por favor firma en el recuadro de abajo. Solo usaremos tu firma para el registro legal.</p>

                            <div className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden relative group">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={200}
                                    className="w-full cursor-crosshair touch-none"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={() => setIsDrawing(false)}
                                    onMouseLeave={() => setIsDrawing(false)}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={() => setIsDrawing(false)}
                                />
                                <button
                                    onClick={clearSignature}
                                    className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-xl text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    Limpiar
                                </button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-20 group-hover:hidden transition-opacity">
                                    <PenTool size={32} />
                                </div>
                            </div>

                            <button
                                onClick={handleSubmit}
                                className="w-full bg-secondary text-white py-4 rounded-2xl font-black shadow-xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> Finalizar Check-in
                            </button>
                            <button onClick={() => setStep(2)} className="w-full py-2 text-gray-400 font-bold text-xs uppercase tracking-widest">Volver</button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="flex flex-col items-center justify-center text-center space-y-6 py-10 animate-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-50">
                                <CheckCircle size={64} />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-secondary tracking-tight">¡Todo Listo!</h2>
                                <p className="text-gray-400 text-sm font-medium">Te esperamos con gusto. Tu llave digital estará lista en recepción a tu llegada.</p>
                            </div>
                            <div className="bg-gray-50 p-6 rounded-3xl w-full text-left space-y-4">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                    <span className="text-[10px] font-black uppercase text-gray-400">Reserva</span>
                                    <span className="text-xs font-black text-secondary">#{booking.id.slice(0, 8)}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                    <span className="text-[10px] font-black uppercase text-gray-400">WiFi Red</span>
                                    <span className="text-xs font-black text-primary">RestoBot_Hotel</span>
                                </div>
                                <div className="flex justify-between items-center pb-1">
                                    <span className="text-[10px] font-black uppercase text-gray-400">WiFi Pass</span>
                                    <span className="text-xs font-black text-secondary">Guest2024*</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Puedes cerrar esta ventana ahora.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DigitalCheckIn;
