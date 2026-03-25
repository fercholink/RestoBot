
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, 
    Save, 
    Trash2, 
    Layers, 
    Circle, 
    Square, 
    Move, 
    RotateCw, 
    Maximize, 
    Info, 
    Users, 
    Utensils, 
    CheckCircle2, 
    Clock, 
    Map as MapIcon,
    ChevronRight,
    Search,
    Edit3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sileo } from 'sileo';
import { useCallback } from 'react';
import { db } from '../lib/db';
import { useOfflineSync } from '../hooks/useOfflineSync';

const TableMapDesigner = ({ orders = [] }) => {
    const { user } = useAuth();
    const { isOnline } = useOfflineSync();
    const [areas, setAreas] = useState([]);
    const [activeArea, setActiveArea] = useState(null);
    const [tables, setTables] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // UI Local State
    const [selectedTable, setSelectedTable] = useState(null);
    const [showAreaModal, setShowAreaModal] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');
    
    const [containerHeight, setContainerHeight] = useState(600);
    const mapRef = useRef(null);

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

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            console.log('Fetching Table Map Data...', { isOnline, orgId: user.organization_id });
            if (isOnline) {
                // Fetch Areas
                let areasQuery = supabase.from('areas').select('*').order('name');
                if (user?.organization_id) areasQuery = areasQuery.eq('organization_id', user.organization_id);
                if (user?.branch?.id) areasQuery = areasQuery.eq('branch_id', user.branch.id);
                const { data: areasData, error: areasError } = await areasQuery;
                if (areasError) throw areasError;
                
                // Fetch Tables
                let tablesQuery = supabase.from('tables').select('*').order('number');
                if (user?.organization_id) tablesQuery = tablesQuery.eq('organization_id', user.organization_id);
                if (user?.branch?.id) tablesQuery = tablesQuery.eq('branch_id', user.branch.id);
                const { data: tablesData, error: tablesError } = await tablesQuery;
                if (tablesError) throw tablesError;

                console.log('Supabase Data Received:', { areas: areasData?.length, tables: tablesData?.length });

                // Cache (Background)
                try {
                    if (areasData) await db.areas.bulkPut(areasData);
                    if (tablesData) await db.tables.bulkPut(tablesData);
                    console.log('[TableMap] ✅ Cache local actualizada');
                } catch (dexieError) {
                    console.warn('[TableMap] ⚠️ Fallo al actualizar caché local:', dexieError);
                }
                
                if (areasData) {
                    setAreas(areasData);
                    if (areasData.length > 0 && !activeArea) {
                        setActiveArea(areasData[0]);
                    }
                }
                if (tablesData) {
                    setTables(tablesData);
                }
            } else {
                // Fallback Local
                console.log('Offline: Loading from IndexedDB...');
                const localAreas = await db.areas.where('organization_id').equals(user.organization_id).toArray();
                const localTables = await db.tables.where('organization_id').equals(user.organization_id).toArray();
                console.log('Local Data Loaded:', { areas: localAreas.length, tables: localTables.length });
                setAreas(localAreas);
                setTables(localTables);
                if (localAreas.length > 0 && !activeArea) {
                    setActiveArea(localAreas[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching table map data, falling back to local:', error);
            const localAreas = await db.areas.where('organization_id').equals(user.organization_id || null).toArray();
            const localTables = await db.tables.where('organization_id').equals(user.organization_id || null).toArray();
            setAreas(localAreas);
            setTables(localTables);
            if (localAreas.length > 0 && !activeArea) {
                setActiveArea(localAreas[0]);
            }
        } finally {
            setLoading(false);
        }
    }, [user, isOnline]); // Removed activeArea from dependencies to prevent re-fetch loop

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddArea = async () => {
        if (!newAreaName.trim()) return;
        
        try {
            const { data, error } = await supabase
                .from('areas')
                .insert([{ 
                    name: newAreaName,
                    organization_id: user?.organization_id,
                    branch_id: user?.branch?.id
                }])
                .select();
            
            if (error) throw error;
            
            setAreas([...areas, data[0]]);
            await db.areas.put(data[0]); // Update cache
            setActiveArea(data[0]);
            setNewAreaName('');
            setShowAreaModal(false);
            sileo.success({ title: 'Área creada', description: `Se ha creado el área "${newAreaName}"` });
        } catch (error) {
            console.error('Error adding area:', error);
            sileo.error({ title: 'Error', description: 'No se pudo crear el área.' });
        }
    };

    const handleAddTable = async (shape = 'square') => {
        if (!activeArea) return;

        // Colocación en rejilla simple para evitar amontonamiento
        const tablesInArea = tables.filter(t => String(t.area_id) === String(activeArea.id));
        const col = tablesInArea.length % 6;
        const row = Math.floor(tablesInArea.length / 6);

        const newTable = {
            number: (tablesInArea.length + 1).toString(),
            area_id: activeArea.id,
            shape: shape,
            x_pos: 60 + (col * 140),
            y_pos: 60 + (row * 140),
            width: 100,
            height: 100,
            capacity: 4,
            status: 'libre',
            organization_id: user?.organization_id,
            branch_id: user?.branch?.id
        };

        try {
            const { data, error } = await supabase
                .from('tables')
                .insert([newTable])
                .select();
            
            if (error) throw error;
            setTables([...tables, data[0]]);
            await db.tables.put(data[0]); // Update cache
            setSelectedTable(data[0]);
            setIsEditing(true);
        } catch (error) {
            console.error('Error adding table:', error);
            sileo.error({ title: 'Error', description: 'No se pudo agregar la mesa.' });
        }
    };

    const handleUpdateTablePosition = (id, x, y) => {
        setTables(tables.map(t => t.id === id ? { ...t, x_pos: x, y_pos: y } : t));
    };

    const handleTableResize = (e, tableId) => {
        e.stopPropagation();
        const startX = e.pageX;
        const startY = e.pageY;
        const targetTable = tables.find(t => t.id === tableId);
        if (!targetTable) return;
        const startWidth = targetTable.width || 100;
        const startHeight = targetTable.height || 100;

        const onMouseMove = (moveEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
            const newHeight = Math.max(50, startHeight + (moveEvent.pageY - startY));
            
            setTables(prev => prev.map(t => 
                t.id === tableId ? { ...t, width: newWidth, height: newHeight } : t
            ));
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
            const updates = tables.map(t => ({
                id: t.id,
                x_pos: Math.round(t.x_pos),
                y_pos: Math.round(t.y_pos),
                width: t.width,
                height: t.height,
                shape: t.shape,
                capacity: t.capacity,
                number: t.number
            }));

            // Supabase doesn't support bulk update with unique IDs easily in one call without RPC
            // So we do it one by one or via a custom function. For now, we'll assume a few tables.
            for (const table of updates) {
                const { error } = await supabase
                    .from('tables')
                    .update(table)
                    .eq('id', table.id);
                if (error) throw error;
            }

            setIsEditing(false);
            sileo.success({ title: 'Diseño guardado', description: 'El mapa de mesas se ha actualizado correctamente.' });
        } catch (error) {
            console.error('Error saving layout:', error);
            sileo.error({ title: 'Error', description: 'No se pudo guardar el diseño del mapa.' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTable = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta mesa?')) return;

        try {
            const { error } = await supabase
                .from('tables')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            setTables(tables.filter(t => t.id !== id));
            setSelectedTable(null);
            sileo.success({ title: 'Mesa eliminada', description: 'La mesa ha sido removida del mapa.' });
        } catch (error) {
            console.error('Error deleting table:', error);
            sileo.error({ title: 'Error', description: 'No se pudo eliminar la mesa.' });
        }
    };

    // Helper to get order for a table
    const getOrderForTable = (tableNumber) => {
        return orders.find(o => o.table_number === tableNumber && o.status !== 'pagado' && o.status !== 'cancelado');
    };

    const activeAreaTables = tables.filter(t => String(t.area_id) === String(activeArea?.id));

    return (
        <div 
            className="flex bg-gray-50/50 rounded-2xl overflow-hidden border border-gray-100 shadow-premium relative transition-all duration-300"
            style={{ minHeight: `${containerHeight}px` }}
        >
            
            {/* Navigation / Areas Sidebar */}
            <div className="w-64 bg-white border-r border-gray-100 flex flex-col">
                <div className="p-4 border-b border-gray-50 bg-gray-50/20">
                    <h2 className="text-lg font-black text-secondary tracking-tight flex items-center gap-2">
                        <MapIcon className="text-primary" size={18} /> Mapa de Mesas
                    </h2>
                    <p className="text-[9px] font-bold text-accent uppercase tracking-widest mt-0.5">Gestión de áreas y ocupación</p>
                </div>

                <div className="p-4 border-b border-gray-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Buscar mesa..." 
                            className="w-full bg-gray-50 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tus Áreas</span>
                        <button 
                            onClick={() => setShowAreaModal(true)}
                            className="p-1 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {areas.map(area => (
                        <button
                            key={area.id}
                            onClick={() => setActiveArea(area)}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all group ${activeArea?.id === area.id ? 'bg-secondary text-white shadow-lg' : 'hover:bg-gray-50 text-secondary'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${activeArea?.id === area.id ? 'bg-white/10' : 'bg-gray-100'}`}>
                                    <Layers size={14} />
                                </div>
                                <span className="text-sm font-bold">{area.name}</span>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${activeArea?.id === area.id ? 'bg-white/20' : 'bg-gray-200 text-gray-500'}`}>
                                {tables.filter(t => t.area_id === area.id).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Selected Table Quick Info */}
                <AnimatePresence>
                    {selectedTable && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-gray-50 border-t border-gray-100 p-6 overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-sm font-black text-secondary">Mesa {selectedTable.number}</h4>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${getOrderForTable(selectedTable.number) ? 'bg-success' : 'bg-gray-300'}`} />
                                        <span className="text-[10px] font-bold text-accent uppercase">{getOrderForTable(selectedTable.number) ? 'Ocupada' : 'Disponible'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(true)} className="p-2 bg-white rounded-xl shadow-sm hover:text-primary transition-colors border border-gray-100"><Edit3 size={14} /></button>
                                    <button onClick={() => handleDeleteTable(selectedTable.id)} className="p-2 bg-white rounded-xl shadow-sm hover:text-rose-500 transition-colors border border-gray-100"><Trash2 size={14} /></button>
                                </div>
                            </div>

                            {getOrderForTable(selectedTable.number) ? (
                                <div className="space-y-3">
                                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black text-gray-400">PEDIDO EN CURSO</span>
                                            <span className="text-[10px] font-black text-primary font-mono">${getOrderForTable(selectedTable.number).total}</span>
                                        </div>
                                        <p className="text-xs font-bold text-secondary truncate">{getOrderForTable(selectedTable.number).customer_name || 'Sin nombre'}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-accent mt-1">
                                            <Clock size={10} />
                                            <span>Abierto hace 15 min</span>
                                        </div>
                                    </div>
                                    <button className="w-full bg-secondary text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">Ver Detalle</button>
                                </div>
                            ) : (
                                <p className="text-[10px] text-gray-400 font-bold italic text-center py-4">Selecciona una mesa para gestionar su estado o diseño.</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Main Map Area */}
            <div className="flex-1 flex flex-col relative bg-[#f1f2f6]">
                {/* Map Toolbar */}
                <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-center pointer-events-none">
                    <div className="flex gap-3 pointer-events-auto">
                        <div className="bg-white shadow-premium rounded-2xl p-1.5 flex gap-1 border border-primary/10">
                            <button 
                                onClick={() => handleAddTable('square')}
                                className="p-2.5 hover:bg-primary/10 text-primary rounded-xl transition-all flex items-center gap-2 font-bold text-xs"
                                title="Mesa Rectangular"
                            >
                                <Square size={16} /> Rectangular
                            </button>
                            <button 
                                onClick={() => handleAddTable('circle')}
                                className="p-2.5 hover:bg-primary/10 text-primary rounded-xl transition-all flex items-center gap-2 font-bold text-xs"
                                title="Mesa Redonda"
                            >
                                <Circle size={16} /> Redonda
                            </button>
                        </div>
                        
                        <div className="bg-white shadow-premium rounded-2xl p-1.5 flex gap-1 border border-gray-100">
                            <button className="p-2.5 hover:bg-gray-50 text-secondary rounded-xl transition-all" title="Zoom In"><Maximize size={16} /></button>
                            <button className="p-2.5 hover:bg-gray-50 text-secondary rounded-xl transition-all" title="Ver Info"><Info size={16} /></button>
                        </div>
                    </div>

                    <div className="flex gap-3 pointer-events-auto">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className="bg-white text-rose-500 font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-premium hover:bg-rose-50 transition-all border border-rose-100"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveLayout}
                                    className="bg-primary text-secondary font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-premium hover:brightness-110 transition-all flex items-center gap-2"
                                >
                                    <Save size={16} /> Guardar Diseño
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="bg-secondary text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest shadow-premium hover:brightness-110 transition-all flex items-center gap-2"
                            >
                                <Edit3 size={16} /> Editar Mapa
                            </button>
                        )}
                    </div>
                </div>

                {/* The Interactive Map */}
                <div 
                    ref={mapRef}
                    className="flex-1 overflow-auto relative custom-scrollbar bg-gray-50/50"
                    onClick={() => setSelectedTable(null)}
                >
                    {/* Lienzo Expandible (Workspace) */}
                    <div className="absolute inset-0" style={{ 
                        width: '3000px', 
                        height: '3000px',
                        backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
                        backgroundSize: '40px 40px',
                        backgroundPosition: '0 0',
                        opacity: 0.4
                    }} />

                    {activeAreaTables.map(table => {
                        const order = getOrderForTable(table.number);
                        const isSelected = selectedTable?.id === table.id;
                        
                        return (
                            <motion.div
                                key={table.id}
                                drag={isEditing}
                                dragMomentum={false}
                                onDragEnd={(e, info) => {
                                    // Calculate relative position based on mapRef
                                    const rect = mapRef.current.getBoundingClientRect();
                                    const x = table.x_pos + info.offset.x;
                                    const y = table.y_pos + info.offset.y;
                                    handleUpdateTablePosition(table.id, x, y);
                                }}
                                style={{ 
                                    x: table.x_pos, 
                                    y: table.y_pos,
                                    width: table.width,
                                    height: table.height,
                                    position: 'absolute'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTable(table);
                                }}
                                className={`
                                    cursor-pointer transition-shadow
                                    flex flex-col items-center justify-center p-2
                                    ${table.shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}
                                    ${isSelected ? 'ring-4 ring-primary ring-offset-4 z-40' : 'z-20'}
                                    ${order 
                                        ? 'bg-success text-white shadow-xl shadow-success/20' 
                                        : 'bg-white text-secondary shadow-premium border border-gray-100 hover:border-primary/50'}
                                `}
                                layoutId={`table-${table.id}`}
                            >
                                {isEditing && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-secondary text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">Mover</div>
                                    </div>
                                )}

                                <div className="flex flex-col items-center pointer-events-none">
                                    <span className={`text-lg font-black leading-none ${order ? 'text-white' : 'text-secondary'}`}>
                                        {table.number}
                                    </span>
                                    {!isEditing && (
                                        <div className="flex items-center gap-0.5 mt-1">
                                            <Users size={10} className={order ? 'text-white/70' : 'text-accent'} />
                                            <span className={`text-[8px] font-bold ${order ? 'text-white/70' : 'text-accent'}`}>{table.capacity}</span>
                                        </div>
                                    )}
                                </div>

                                {isEditing && (
                                    <div 
                                        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center group/resize z-50 hover:bg-primary/10 rounded-br-2xl transition-all"
                                        onMouseDown={(e) => handleTableResize(e, table.id)}
                                    >
                                        <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-secondary/20 group-hover/resize:border-primary transition-colors" />
                                    </div>
                                )}

                                {order && !isEditing && (
                                    <div className="absolute -top-1 -right-1 bg-white p-1 rounded-full shadow-lg">
                                        <div className="animate-pulse bg-success rounded-full p-1">
                                            <Utensils size={8} className="text-white" />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Map Footer Info */}
                <div className="p-6 flex justify-between items-center bg-white border-t border-gray-100">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white border border-gray-200" />
                            <span className="text-[10px] font-black text-accent uppercase tracking-widest">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-success shadow-sm" />
                            <span className="text-[10px] font-black text-accent uppercase tracking-widest">Ocupada</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-400 shadow-sm" />
                            <span className="text-[10px] font-black text-accent uppercase tracking-widest">Reservada</span>
                        </div>
                    </div>
                    
                    <div className="text-[10px] font-bold text-gray-400">
                        {activeAreaTables.length} mesas en {activeArea?.name}
                    </div>
                </div>
            </div>

            {/* Area Creation Modal */}
            {showAreaModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl"
                    >
                        <h3 className="text-2xl font-black text-secondary tracking-tight mb-2">Nueva Área</h3>
                        <p className="text-sm text-gray-500 font-medium mb-6">Crea una nueva zona para organizar tus mesas (ej. Terraza, Piso 2).</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nombre del Área</label>
                                <input 
                                    type="text" 
                                    autoFocus
                                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-4 font-bold text-secondary outline-none focus:border-primary focus:bg-white transition-all shadow-inner"
                                    placeholder="Ej. Salón VIP"
                                    value={newAreaName}
                                    onChange={(e) => setNewAreaName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddArea()}
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button 
                                    onClick={() => setShowAreaModal(false)}
                                    className="flex-1 bg-gray-100 text-secondary font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleAddArea}
                                    className="flex-1 bg-secondary text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all shadow-xl"
                                >
                                    Crear Área
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
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

export default TableMapDesigner;
