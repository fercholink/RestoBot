import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Save, Layers, Circle, Square, Maximize, Info, Users, Edit3, Bed, Search
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sileo } from 'sileo';

const HotelMapDesigner = ({ floors = [], rooms = [], bookings = [], onRoomUpdated, selectedBranchId }) => {
    const [activeFloor, setActiveFloor] = useState(null);
    const [localRooms, setLocalRooms] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [containerHeight, setContainerHeight] = useState(600);
    const mapRef = useRef(null);

    // Sync localRooms with rooms prop when not editing
    useEffect(() => {
        if (!isEditing) {
            setLocalRooms(rooms);
        }
    }, [rooms, isEditing]);

    // Select first floor automatically if none selected
    useEffect(() => {
        if (floors.length > 0 && !activeFloor) {
            setActiveFloor(floors[0]);
        }
    }, [floors, activeFloor]);

    const handleResize = (e) => {
        const startY = e.pageY;
        const startHeight = containerHeight;
        
        const onMouseMove = (moveEvent) => {
            const newHeight = startHeight + (moveEvent.pageY - startY);
            setContainerHeight(Math.max(600, newHeight));
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleUpdateRoomPosition = (id, x, y) => {
        setLocalRooms(prev => prev.map(r => {
            if (r.id === id) {
                const currentFeatures = r.features || {};
                const currentMapPosition = currentFeatures.mapPosition || { width: 100, height: 100, shape: 'square' };
                return { 
                    ...r, 
                    features: { 
                        ...currentFeatures, 
                        mapPosition: { ...currentMapPosition, x_pos: x, y_pos: y } 
                    } 
                };
            }
            return r;
        }));
    };

    const handleRoomResize = (e, roomId) => {
        e.stopPropagation();
        const startX = e.pageX;
        const startY = e.pageY;
        const targetRoom = localRooms.find(r => r.id === roomId);
        if (!targetRoom) return;
        
        const mapPos = targetRoom.features?.mapPosition || { width: 100, height: 100 };
        const startWidth = mapPos.width || 100;
        const startHeight = mapPos.height || 100;

        const onMouseMove = (moveEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
            const newHeight = Math.max(50, startHeight + (moveEvent.pageY - startY));
            
            setLocalRooms(prev => prev.map(r => {
                if (r.id === roomId) {
                    const currentFeatures = r.features || {};
                    const currentMapPosition = currentFeatures.mapPosition || { x_pos: 0, y_pos: 0, shape: 'square' };
                    return { 
                        ...r, 
                        features: { 
                            ...currentFeatures, 
                            mapPosition: { ...currentMapPosition, width: newWidth, height: newHeight } 
                        } 
                    };
                }
                return r;
            }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleSaveLayout = async () => {
        try {
            setLoading(true);
            const updates = localRooms.map(r => ({
                id: r.id,
                features: r.features
            }));

            for (const roomUpdate of updates) {
                const { error } = await supabase
                    .from('rooms')
                    .update({ features: roomUpdate.features })
                    .eq('id', roomUpdate.id);
                if (error) throw error;
            }

            setIsEditing(false);
            if (onRoomUpdated) onRoomUpdated();
            sileo.success({ title: 'Diseño guardado', description: 'El mapa de habitaciones se ha actualizado.' });
        } catch (error) {
            console.error('Error saving layout:', error);
            sileo.error({ title: 'Error', description: 'No se pudo guardar el diseño del mapa.' });
        } finally {
            setLoading(false);
        }
    };

    const getBookingForRoom = (roomId) => {
        return bookings.find(b => b.room_id === roomId && (b.status === 'ocupada' || b.status === 'reservada'));
    };

    const activeFloorRooms = localRooms.filter(r => String(r.floor_id) === String(activeFloor?.id));

    // Si una habitación no tiene posición, la ubicamos en una grilla predeterminada
    const initializeMissingPositions = () => {
        let needsInit = false;
        const newLocalRooms = localRooms.map((room, idx) => {
            if (String(room.floor_id) === String(activeFloor?.id)) {
                if (!room.features?.mapPosition || room.features.mapPosition.x_pos === undefined) {
                    needsInit = true;
                    const col = idx % 6;
                    const row = Math.floor(idx / 6);
                    return {
                        ...room,
                        features: {
                            ...room.features,
                            mapPosition: {
                                x_pos: 60 + (col * 140),
                                y_pos: 60 + (row * 140),
                                width: 100,
                                height: 100,
                                shape: 'square'
                            }
                        }
                    };
                }
            }
            return room;
        });

        if (needsInit) {
            setLocalRooms(newLocalRooms);
        }
    };

    // Auto inicializar posiciones si entra a editar y faltan
    useEffect(() => {
        if (isEditing) {
            initializeMissingPositions();
        }
    }, [isEditing, activeFloor]);

    return (
        <div 
            className="flex bg-surface-soft rounded-[24px] overflow-hidden border border-hairline shadow-airbnb relative transition-all duration-300"
            style={{ minHeight: `${containerHeight}px` }}
        >
            {/* Sidebar de Pisos */}
            <div className="w-72 bg-canvas border-r border-hairline flex flex-col">
                <div className="p-5 border-b border-hairline bg-transparent">
                    <h2 className="text-xl font-bold text-secondary tracking-tight flex items-center gap-2">
                        <Bed className="text-primary" size={20} /> Mapa del Hotel
                    </h2>
                    <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mt-1">Gestión de pisos y diseño</p>
                </div>

                <div className="p-4 border-b border-hairline">
                    <div className="relative bg-canvas border border-hairline rounded-full shadow-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={14} />
                        <input 
                            type="text" 
                            placeholder="Buscar hab..." 
                            className="w-full bg-transparent border-none rounded-full py-2 pl-10 pr-4 text-[13px] font-semibold outline-none focus:ring-0 text-secondary transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <span className="text-[11px] font-bold text-accent uppercase tracking-widest">Tus Pisos</span>
                    </div>

                    {floors.map(floor => (
                        <button
                            key={floor.id}
                            onClick={() => setActiveFloor(floor)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${activeFloor?.id === floor.id ? 'bg-surface-soft text-secondary font-bold' : 'hover:bg-surface-soft text-accent hover:text-secondary font-semibold'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${activeFloor?.id === floor.id ? 'bg-canvas shadow-sm text-primary' : 'bg-transparent group-hover:bg-canvas group-hover:shadow-sm text-accent'}`}>
                                    <Layers size={16} />
                                </div>
                                <span className="text-[14px] truncate text-left">{floor.name || `Piso ${floor.floor_number}`}</span>
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeFloor?.id === floor.id ? 'bg-primary/10 text-primary' : 'bg-surface-strong text-accent'}`}>
                                {localRooms.filter(r => r.floor_id === floor.id).length}
                            </span>
                        </button>
                    ))}
                    {floors.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">No hay pisos configurados.</p>
                    )}
                </div>

                <AnimatePresence>
                    {selectedRoom && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-canvas border-t border-hairline p-6 overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-[15px] font-bold text-secondary">Habitación {selectedRoom.number}</h4>
                                    <p className="text-[11px] font-bold text-accent uppercase tracking-widest">{selectedRoom.type}</p>
                                </div>
                            </div>

                            {getBookingForRoom(selectedRoom.id) ? (
                                <div className="space-y-3">
                                    <div className="bg-surface-soft p-4 rounded-[16px] border border-hairline">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black text-gray-400">HUÉSPED</span>
                                        </div>
                                        <p className="text-xs font-bold text-secondary truncate">{getBookingForRoom(selectedRoom.id).guest?.full_name || 'Desconocido'}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] text-gray-400 font-bold italic text-center py-4">Selecciona para ver más detalles.</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Zona de Mapa Principal */}
            <div className="flex-1 flex flex-col relative bg-surface-soft">
                {/* Herramientas del Mapa */}
                <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
                    <div className="flex gap-3 pointer-events-auto">
                        <div className="bg-canvas shadow-airbnb rounded-full p-1.5 flex gap-1 border border-hairline">
                            <button className="p-2.5 hover:bg-surface-soft text-secondary rounded-full transition-all" title="Zoom In"><Maximize size={18} /></button>
                        </div>
                    </div>

                    <div className="flex gap-3 pointer-events-auto">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={() => { setIsEditing(false); setLocalRooms(rooms); }}
                                    className="bg-canvas text-danger font-bold px-6 py-3 rounded-full text-[11px] uppercase tracking-widest border border-danger/20 hover:bg-danger/10 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveLayout}
                                    disabled={loading}
                                    className="bg-secondary text-white font-bold px-6 py-3 rounded-full text-[11px] uppercase tracking-widest shadow-sm hover:brightness-110 transition-all flex items-center gap-2"
                                >
                                    <Save size={16} /> {loading ? 'Guardando...' : 'Guardar Diseño'}
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="bg-canvas border border-hairline shadow-airbnb text-secondary font-bold px-6 py-3 rounded-full text-[11px] uppercase tracking-widest hover:bg-surface-soft transition-all flex items-center gap-2"
                            >
                                <Edit3 size={16} /> Editar Mapa
                            </button>
                        )}
                    </div>
                </div>

                {/* El Canvas del Mapa */}
                <div 
                    ref={mapRef}
                    className="flex-1 overflow-auto relative custom-scrollbar bg-gray-50/50"
                    onClick={() => setSelectedRoom(null)}
                >
                    <div className="absolute inset-0" style={{ 
                        width: '3000px', 
                        height: '3000px',
                        backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
                        backgroundSize: '40px 40px',
                        backgroundPosition: '0 0',
                        opacity: 0.4
                    }} />

                    {activeFloorRooms.map(room => {
                        const booking = getBookingForRoom(room.id);
                        const isSelected = selectedRoom?.id === room.id;
                        
                        // Default position si no tiene
                        const mapPos = room.features?.mapPosition || { x_pos: -1000, y_pos: -1000, width: 100, height: 100, shape: 'square' };
                        // Filter search
                        if (searchTerm && !room.number?.toString().toLowerCase().includes(searchTerm.toLowerCase())) return null;

                        return (
                            <motion.div
                                key={room.id}
                                drag={isEditing}
                                dragMomentum={false}
                                onDragEnd={(e, info) => {
                                    const x = mapPos.x_pos + info.offset.x;
                                    const y = mapPos.y_pos + info.offset.y;
                                    handleUpdateRoomPosition(room.id, x, y);
                                }}
                                style={{ 
                                    x: mapPos.x_pos, 
                                    y: mapPos.y_pos,
                                    width: mapPos.width,
                                    height: mapPos.height,
                                    position: 'absolute'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoom(room);
                                }}
                                className={`
                                    cursor-pointer transition-shadow
                                    flex flex-col items-center justify-center p-2
                                    ${mapPos.shape === 'circle' ? 'rounded-full' : 'rounded-[16px]'}
                                    ${isSelected ? 'ring-2 ring-primary ring-offset-4 z-40 shadow-airbnb' : 'z-20'}
                                    ${booking 
                                        ? 'bg-primary text-white shadow-md' 
                                        : 'bg-canvas text-secondary shadow-sm border border-hairline hover:border-primary/30'}
                                `}
                            >
                                {isEditing && (
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-secondary text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm">Mover</div>
                                    </div>
                                )}

                                <div className="flex flex-col items-center pointer-events-none">
                                    <span className={`text-[18px] font-bold leading-none ${booking ? 'text-white' : 'text-secondary'}`}>
                                        {room.number}
                                    </span>
                                    {!isEditing && (
                                        <div className="flex flex-col items-center gap-0.5 mt-1">
                                            <span className={`text-[9px] font-bold ${booking ? 'text-white/80' : 'text-accent'} truncate max-w-full px-1`}>{room.type}</span>
                                        </div>
                                    )}
                                </div>

                                {isEditing && (
                                    <div 
                                        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center group/resize z-50 hover:bg-primary/10 rounded-br-2xl transition-all"
                                        onMouseDown={(e) => handleRoomResize(e, room.id)}
                                    >
                                        <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-secondary/20 group-hover/resize:border-primary transition-colors" />
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Footer Info */}
                <div className="p-6 flex justify-between items-center bg-canvas border-t border-hairline">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-canvas border border-hairline shadow-sm" />
                            <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary shadow-sm" />
                            <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">Ocupada / Reservada</span>
                        </div>
                    </div>
                    
                    <div className="text-[11px] font-bold text-accent uppercase tracking-widest">
                        {activeFloorRooms.length} habs en {activeFloor?.name || `Piso ${activeFloor?.floor_number}`}
                    </div>
                </div>
            </div>
            
            {isEditing && (
                <div 
                    className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center bg-gray-100/30 hover:bg-primary/10 transition-colors z-[100]"
                    onMouseDown={handleResize}
                >
                    <div className="flex gap-1.5 opacity-20">
                        <div className="w-1 h-1 bg-secondary rounded-full" />
                        <div className="w-1 h-1 bg-secondary rounded-full" />
                        <div className="w-1 h-1 bg-secondary rounded-full" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default HotelMapDesigner;
