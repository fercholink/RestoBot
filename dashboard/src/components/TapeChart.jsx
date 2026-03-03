import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Users, Bed, Info, MoreVertical, RefreshCw } from 'lucide-react';
import { format, addDays, startOfDay, isSameDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

const TapeChart = ({ rooms = [], bookings = [], onBookingClick, onDateChange }) => {
    const [viewStartDate, setViewStartDate] = useState(startOfDay(new Date()));
    const daysInView = 21; // Muestra 3 semanas para que sea legible

    // Generar array de días para la cabecera
    const days = useMemo(() => {
        return Array.from({ length: daysInView }, (_, i) => addDays(viewStartDate, i));
    }, [viewStartDate]);

    // Navegación
    const nextPeriod = () => setViewStartDate(prev => addDays(prev, 7));
    const prevPeriod = () => setViewStartDate(prev => addDays(prev, -7));
    const goToToday = () => setViewStartDate(startOfDay(new Date()));

    // Helpers de posicionamiento
    const getBookingStyle = (booking, roomIndex) => {
        const checkIn = startOfDay(new Date(booking.check_in));
        const checkOut = startOfDay(new Date(booking.check_out));

        // Calcular offset desde el inicio de la vista
        const startOffset = differenceInDays(checkIn, viewStartDate);
        const duration = differenceInDays(checkOut, checkIn);

        // Si la reserva está fuera de la vista, no la mostramos o la recortamos
        if (startOffset + duration < 0 || startOffset >= daysInView) return { display: 'none' };

        const visibleOffset = Math.max(0, startOffset);
        const visibleDuration = Math.min(duration, daysInView - visibleOffset + (startOffset < 0 ? startOffset : 0));

        return {
            gridColumn: `${visibleOffset + 2} / span ${visibleDuration}`,
            gridRow: `${roomIndex + 2}`
        };
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden fade-in">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                    <h3 className="font-black text-secondary flex items-center gap-2">
                        <Calendar size={18} className="text-primary" />
                        Cinta de Reservas
                    </h3>
                    <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                        <button onClick={prevPeriod} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={goToToday} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-gray-50 rounded-lg transition-colors">
                            Hoy
                        </button>
                        <button onClick={nextPeriod} className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <span className="text-xs font-bold text-gray-400">
                        {format(viewStartDate, 'd MMMM', { locale: es })} — {format(addDays(viewStartDate, daysInView - 1), 'd MMMM yyyy', { locale: es })}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Ocupada</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Reservada</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Limpieza</div>
                    </div>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <div
                    className="grid min-w-[1200px]"
                    style={{
                        gridTemplateColumns: `160px repeat(${daysInView}, 1fr)`,
                        gridAutoRows: '56px'
                    }}
                >
                    {/* Header Row: Days */}
                    <div className="sticky top-0 left-0 z-30 bg-gray-50 border-b border-r border-gray-200 flex items-center justify-center font-black text-[10px] text-gray-400 uppercase tracking-widest">
                        Habitación
                    </div>
                    {days.map((day, i) => (
                        <div
                            key={i}
                            className={`sticky top-0 z-20 border-b border-r border-gray-100 flex flex-col items-center justify-center p-1 ${isSameDay(day, new Date()) ? 'bg-primary/5' : 'bg-gray-50'}`}
                        >
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{format(day, 'EEE', { locale: es })}</span>
                            <span className={`text-xs font-black ${isSameDay(day, new Date()) ? 'text-primary' : 'text-secondary'}`}>{format(day, 'd')}</span>
                        </div>
                    ))}

                    {/* Room Rows */}
                    {rooms.map((room, rowIndex) => (
                        <React.Fragment key={room.id}>
                            {/* Room Header */}
                            <div className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-4 flex flex-col justify-center shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-secondary">H. {room.number}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${room.status === 'limpieza' ? 'bg-amber-100 text-amber-600' :
                                            room.status === 'mantenimiento' ? 'bg-red-100 text-red-600' :
                                                'bg-gray-100 text-gray-400'
                                        }`}>
                                        {room.status === 'limpieza' ? 'LIM' : room.status === 'mantenimiento' ? 'MANT' : room.type || 'EST'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium truncate">{room.name}</span>
                            </div>

                            {/* Cells (Background Grid) */}
                            {days.map((day, i) => (
                                <div
                                    key={i}
                                    className={`border-b border-r border-gray-50 group hover:bg-gray-50/50 transition-colors relative ${isSameDay(day, new Date()) ? 'bg-primary/[0.02]' : ''}`}
                                >
                                    {/* Overlay para click en celda vacía para nueva reserva */}
                                    <button
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                        title="Nueva reserva"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                            <span className="text-lg font-bold">+</span>
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </React.Fragment>
                    ))}

                    {/* Bookings Overlay */}
                    {bookings.map((booking) => {
                        // No mostrar reservas ya finalizadas (checkout) ni canceladas
                        if (booking.status === 'checkout' || booking.status === 'cancelada') return null;

                        const roomIndex = rooms.findIndex(r => r.id === booking.room_id);
                        if (roomIndex === -1) return null;

                        const style = getBookingStyle(booking, roomIndex);
                        if (style.display === 'none') return null;

                        const isOccupied = booking.status === 'ocupada';
                        const isCheckout = false; // nunca se muestra checkout aquí

                        return (
                            <div
                                key={booking.id}
                                style={style}
                                onClick={() => onBookingClick(booking)}
                                className={`m-1.5 rounded-xl p-2 cursor-pointer shadow-sm transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-center overflow-hidden z-10 ${isOccupied
                                        ? 'bg-emerald-500 text-white shadow-emerald-200'
                                        : isCheckout
                                            ? 'bg-gray-200 text-gray-500 line-through'
                                            : 'bg-blue-500 text-white shadow-blue-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                    <span className="text-[10px] font-black truncate uppercase tracking-tighter">
                                        {booking.guest?.full_name || 'Huésped'}
                                    </span>
                                    {isOccupied && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5 opacity-80">
                                    <Users size={8} />
                                    <span className="text-[8px] font-bold">{booking.adults || 1} pax</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Vertical Indicator: Today Line */}
                <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                        left: `calc(160px + ${differenceInDays(new Date(), viewStartDate) * (100 / daysInView)}%)`,
                        width: '2px',
                        backgroundColor: 'rgba(255, 107, 107, 0.4)'
                    }}
                />
            </div>
        </div>
    );
};

export default TapeChart;
