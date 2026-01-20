import React from 'react';
import { Bed, Calendar, Key, Users, History, Settings, Bell, Star, MapPin, Search } from 'lucide-react';

const HotelManagement = () => {
    // Datos simulados para previsualización
    const rooms = [
        { id: '101', type: 'Sencilla', status: 'ocupada', client: 'Carlos Ruiz', rating: 4 },
        { id: '102', type: 'Doble', status: 'disponible', client: '-', rating: 0 },
        { id: '103', type: 'Suite', status: 'limpieza', client: '-', rating: 0 },
        { id: '201', type: 'Doble', status: 'ocupada', client: 'Maria Gomez', rating: 5 },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/50">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-secondary tracking-tight">Administración de Hotel</h2>
                    <p className="text-sm font-medium text-accent">Gestión de reservas, habitaciones y huéspedes</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar habitación o huésped..."
                            className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-64 shadow-sm"
                        />
                    </div>
                    <button className="bg-secondary text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-premium hover:scale-[1.02] transition-all">
                        Nueva Reserva
                    </button>
                </div>
            </div>

            {/* Status Legend */}
            <div className="flex gap-4 mb-8">
                <div className="bg-success/10 text-success px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-success/10 flex items-center gap-2">
                    <div className="w-2 h-2 bg-success rounded-full" /> Disponible
                </div>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-primary/10 flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full" /> Ocupada
                </div>
                <div className="bg-warning/10 text-warning px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-warning/10 flex items-center gap-2">
                    <div className="w-2 h-2 bg-warning rounded-full" /> Limpieza
                </div>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {rooms.map((room) => (
                    <div key={room.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-2xl ${room.status === 'ocupada' ? 'bg-primary/10 text-primary' : room.status === 'disponible' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                <Bed size={24} />
                            </div>
                            <span className="text-lg font-black text-secondary">#{room.id}</span>
                        </div>
                        <h3 className="text-sm font-black text-secondary uppercase tracking-tight mb-1">{room.type}</h3>
                        <p className="text-xs text-accent font-medium mb-4 flex items-center gap-1">
                            <Users size={12} /> {room.client}
                        </p>

                        <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${room.status === 'ocupada' ? 'bg-primary/10 text-primary' : room.status === 'disponible' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                {room.status}
                            </span>
                            {room.status === 'ocupada' && (
                                <div className="flex gap-0.5 text-warning">
                                    {[...Array(room.rating)].map((_, i) => <Star key={i} size={10} fill="currentColor" />)}
                                </div>
                            )}
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-secondary/95 p-4 translate-y-full group-hover:translate-y-0 transition-transform flex gap-2">
                            <button className="flex-1 bg-primary text-white text-[9px] font-black uppercase rounded-lg py-2">Check-in</button>
                            <button className="flex-1 bg-white/10 text-white text-[9px] font-black uppercase rounded-lg py-2 border border-white/10">Detalles</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Module under development banner */}
            <div className="bg-secondary rounded-3xl p-12 text-center relative overflow-hidden shadow-premium">
                <div className="relative z-10 max-w-lg mx-auto">
                    <div className="inline-flex p-4 rounded-full bg-white/5 mb-6">
                        <Calendar className="text-primary" size={48} />
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4">Módulo en Desarrollo</h3>
                    <p className="text-white/60 mb-8 leading-relaxed">
                        Estamos adaptando la arquitectura de RestoBot para ofrecer soluciones avanzadas al sector hotelero. Pronto podrás gestionar Check-ins, Check-outs, Servicio al cuarto e integración con canales de reserva.
                    </p>
                    <div className="flex justify-center gap-4">
                        <div className="px-6 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest">v2.0 Roadmap</div>
                        <div className="px-6 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest">Solicitar Beta</div>
                    </div>
                </div>
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Key size={300} />
                </div>
            </div>
        </div>
    );
};

export default HotelManagement;
