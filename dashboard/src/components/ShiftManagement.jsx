import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Wallet, Clock, ArrowRightLeft, CheckCircle2, AlertCircle, History, User, Building2, TrendingUp, TrendingDown, Landmark, Banknote, Save, X, Plus, Minus, Download, Send, XCircle } from 'lucide-react';

const ShiftManagement = ({ orders = [], onPrint, autoOpen = false }) => {
    // Estado local para la UI
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);

    const activeShift = shifts.find(s => s.status === 'abierto');
    const { user } = useAuth();

    // Cargar turnos desde Supabase
    useEffect(() => {
        fetchShifts();
    }, []);

    const fetchShifts = async () => {
        try {
            // 1. Fetch active shift (guaranteed)
            // 1. Fetch active shift (handle multiple if they exist by taking latest)
            const { data: activeDataArray, error: activeError } = await supabase
                .from('shifts')
                .select('*')
                .eq('status', 'abierto')
                .order('start_time', { ascending: false });

            // Take the most recent open shift if multiple exist
            const activeData = activeDataArray?.[0] || null;

            if (activeError) throw activeError;

            // 2. Fetch history (closed shifts)
            const { data: historyData, error: historyError } = await supabase
                .from('shifts')
                .select('*')
                .neq('status', 'abierto') // Exclude open if we want, or just mix them.
                // Let's just fetch all recent and merge, but simpler:
                .order('start_time', { ascending: false })
                .limit(20);

            if (historyError) throw historyError;

            // Merge: If active shift exists, place it first or ensure it's in the list
            let allShifts = historyData || [];
            if (activeData) {
                // Remove if it was present in history fetch (unlikely if we used neq, but safe check)
                allShifts = allShifts.filter(s => s.id !== activeData.id);
                allShifts.unshift(activeData);
            }

            setShifts(allShifts);
        } catch (error) {
            console.error('Error fetching shifts:', error);
            alert('Error cargando turnos: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const [showOpenModal, setShowOpenModal] = useState(false);

    useEffect(() => {
        if (autoOpen && !activeShift) {
            setShowOpenModal(true);
        }
    }, [autoOpen, activeShift]);

    // Safety: If active shift appears, close open modal
    useEffect(() => {
        if (activeShift) {
            setShowOpenModal(false);
        }
    }, [activeShift]);

    const syncShifts = async () => {
        await fetchShifts();
        window.dispatchEvent(new Event('shift-updated'));
    };

    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [initialCash, setInitialCash] = useState(50000);
    const [countedCash, setCountedCash] = useState(0);
    const [expenseAmount, setExpenseAmount] = useState(0);
    const [expenseReason, setExpenseReason] = useState('');





    // Cálculos en tiempo real basados en pedidos pagados
    const getShiftMetrics = (shift) => {
        if (!shift) return null;
        const shiftStart = shift.start_time ? new Date(shift.start_time) : new Date();

        const shiftOrders = Array.isArray(orders) ? orders.filter(o =>
            o.status === 'pagado' &&
            new Date(o.created_at) >= shiftStart
        ) : [];

        // Helper para obtener precio total (compatible con total o total_price)
        const getPrice = (o) => Number(o.total || o.total_price || 0);

        const cashSales = shiftOrders
            .filter(o => o.payment_method === 'efectivo')
            .reduce((sum, o) => sum + getPrice(o), 0);

        const digitalSales = shiftOrders
            .filter(o => o.payment_method !== 'efectivo')
            .reduce((sum, o) => sum + getPrice(o), 0);

        const totalExpenses = (shift.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const expectedInDrawer = Number(shift.initial_cash || 0) + cashSales - totalExpenses;

        return {
            cashSales,
            digitalSales,
            totalExpenses,
            expectedInDrawer,
            orderCount: shiftOrders.length,
            digitalBreakdown: {
                nequi: shiftOrders.filter(o => o.payment_method === 'nequi').reduce((sum, o) => sum + getPrice(o), 0),
                tarjeta: shiftOrders.filter(o => o.payment_method === 'tarjeta').reduce((sum, o) => sum + getPrice(o), 0),
                transferencia: shiftOrders.filter(o => o.payment_method === 'transferencia').reduce((sum, o) => sum + getPrice(o), 0),
            }
        };
    };

    const metrics = getShiftMetrics(activeShift);

    const safeDate = (dateStr) => {
        try {
            if (!dateStr) return new Date();
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? new Date() : d;
        } catch (e) {
            return new Date();
        }
    };

    const handleOpenShift = async () => {
        try {
            // Guard: Check if shift is already open locally or in DB
            if (activeShift) {
                alert("Ya existe un turno abierto.");
                setShowOpenModal(false);
                return;
            }

            // Double check server-side to prevent race conditions
            const { data: existingOpen } = await supabase
                .from('shifts')
                .select('id')
                .eq('status', 'abierto')
                .maybeSingle();

            if (existingOpen) {
                alert("Detectamos un turno abierto en segundo plano. Sincronizando...");
                await fetchShifts();
                setShowOpenModal(false);
                return;
            }

            const { error } = await supabase.from('shifts').insert([{
                cashier_name: user?.name || 'Cajero',
                branch_name: user?.branch || 'Sede Principal',
                status: 'abierto',
                start_time: new Date().toISOString(),
                initial_cash: Number(initialCash),
                expenses: []
            }]);

            if (error) throw error;

            // Force immediate UI update locally to prevent lag
            const newShiftStub = {
                id: 'temp_' + Date.now(),
                cashier_name: user?.name,
                branch_name: user?.branch,
                status: 'abierto',
                start_time: new Date().toISOString(),
                initial_cash: Number(initialCash),
                expenses: []
            };
            setShifts(prev => [newShiftStub, ...prev]);

            await syncShifts();
            setShowOpenModal(false);
        } catch (error) {
            console.error('Error opening shift:', error);
            alert('Error al abrir turno: ' + (error.message || 'Error desconocido'));
            // If error, try to fetch to see if it was created anyway
            fetchShifts();
        }
    };

    const handleAddExpense = async () => {
        if (!activeShift) return;
        const expense = {
            id: Date.now(),
            amount: Number(expenseAmount),
            reason: expenseReason,
            time: new Date().toISOString()
        };

        try {
            // Postgres JSON append
            const updatedExpenses = [...(activeShift.expenses || []), expense];
            const { error } = await supabase
                .from('shifts')
                .update({ expenses: updatedExpenses })
                .eq('id', activeShift.id);

            if (error) throw error;
            syncShifts();
            setShowExpenseModal(false);
            setExpenseAmount(0);
            setExpenseReason('');
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Error al registrar gasto');
        }
    };

    const handleCloseShift = async () => {
        if (!activeShift || !metrics) return;

        const finalBalance = Number(countedCash) - metrics.expectedInDrawer;

        try {
            const { error } = await supabase
                .from('shifts')
                .update({
                    status: 'cerrado',
                    end_time: new Date().toISOString(),
                    final_cash: Number(countedCash),
                    expected_cash: metrics.expectedInDrawer,
                    digital_sales: metrics.digitalSales,
                    difference: finalBalance,
                    metrics_snapshot: metrics
                })
                .eq('id', activeShift.id);

            if (error) throw error;
            syncShifts();
            setShowCloseModal(false);
            setCountedCash(0);
        } catch (error) {
            console.error('Error closing shift:', error);
            alert('Error al cerrar turno');
        }
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header / Acciones Globales */}
            {!activeShift && (
                <div className="bg-white p-12 rounded-[3.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center space-y-6 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                        <Banknote className="text-gray-300" size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-secondary">Caja Cerrada</h2>
                        <p className="text-gray-400 font-medium max-w-sm mx-auto">Debe abrir un turno con una base inicial para comenzar a registrar ventas hoy.</p>
                    </div>
                    <button
                        onClick={() => setShowOpenModal(true)}
                        className="bg-primary text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm"
                    >
                        Abrir Caja (Inyectar Base)
                    </button>
                </div>
            )}

            {/* Estado Actual de Caja (Solo si hay turno abierto) */}
            {activeShift && metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-2 bg-secondary rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                        <div className="relative z-10 flex flex-col justify-between h-full">
                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="bg-success text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Turno Activo</span>
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                            <Clock size={12} /> Iniciado {safeDate(activeShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <h2 className="text-4xl font-black mt-4">{activeShift.cashier_name}</h2>
                                    <p className="text-white/40 text-sm font-medium flex items-center gap-2">
                                        <Building2 size={14} /> Global • {metrics.orderCount} pedidos realizados
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Base Inicial</p>
                                        <p className="text-xl font-black">${activeShift.initial_cash.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Ventas Efectivo</p>
                                        <p className="text-xl font-black text-primary">${metrics.cashSales.toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Gastos / Pagos</p>
                                        <p className="text-xl font-black text-red-400">-${metrics.totalExpenses.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setShowExpenseModal(true)}
                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
                                >
                                    <Minus size={18} /> Registrar Gasto
                                </button>
                                <button
                                    onClick={() => setShowCloseModal(true)}
                                    className="flex-1 bg-white text-secondary px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <XCircle size={18} className="text-red-500" /> Cerrar Jornada
                                </button>
                            </div>
                        </div>
                        <Wallet className="absolute -right-12 -bottom-12 text-white/5 w-64 h-64 rotate-12" />
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium flex flex-col justify-between">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Efectivo Sugerido en Caja</h3>
                            <p className="text-4xl font-black text-secondary tracking-tighter">${metrics.expectedInDrawer.toLocaleString()}</p>
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-300 border-b pb-2">Desglose Digital</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">Nequi/Davi</span>
                                    <span className="text-secondary font-black">${metrics.digitalBreakdown.nequi.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400 font-bold">Tarjeta</span>
                                    <span className="text-secondary font-black">${metrics.digitalBreakdown.tarjeta.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-50">
                                    <span className="text-gray-400 font-black">Total Digital</span>
                                    <span className="text-blue-500 font-black">${metrics.digitalSales.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium flex flex-col justify-center items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                            <TrendingUp className="text-success" size={28} />
                        </div>
                        <div>
                            <p className="text-xs font-black text-secondary">Rendimiento Hoy</p>
                            <p className="text-3xl font-black text-success">+${(metrics.cashSales + metrics.digitalSales).toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Ventas Brutas Totales</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Historial de Turnos */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <History size={16} />
                        Historial de Turnos y Arqueos
                    </h3>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-gray-50 transition-all">
                            <Download size={14} /> Exportar Excel
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Responsable / Sede</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha / Hora</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Balance Final</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Estado Cuadre</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-medium whitespace-nowrap">
                            {shifts
                                .filter(s => (user?.role === 'admin' || user?.role === 'gerente') ? true : s.cashier_name === user?.name) // Filtro: Cajeros solo ven sus turnos
                                .map((shift) => (
                                    <tr key={shift.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-secondary font-black text-xs group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                    {(shift.cashier_name || 'C').split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <p className="font-black text-secondary text-sm">{shift.cashier_name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{shift.branch_name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-0.5">
                                                <p className="text-xs text-secondary font-bold">{new Date(shift.start_time).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">
                                                    {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {shift.end_time ? ` - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Abierto)'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-black text-secondary">${(shift.final_cash || (shift.status === 'abierto' ? metrics?.expectedInDrawer : 0))?.toLocaleString()}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Digital: ${(shift.digital_sales || 0).toLocaleString()}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                {shift.status === 'abierto' ? (
                                                    <span className="bg-blue-50 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">En progreso</span>
                                                ) : (shift.difference || 0) === 0 ? (
                                                    <span className="bg-success/10 text-success px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 tracking-tighter">
                                                        <CheckCircle2 size={12} /> Cuadrado
                                                    </span>
                                                ) : (
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 tracking-tighter ${shift.difference > 0 ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'}`}>
                                                        <AlertCircle size={12} /> {shift.difference > 0 ? 'Sobrante' : 'Faltante'} (${Math.abs(shift.difference).toLocaleString()})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary transition-all"><Send size={16} /></button>
                                                <button
                                                    onClick={() => {
                                                        const shiftToPrint = { ...shift };
                                                        if (!shift.metrics && shift.status === 'abierto') {
                                                            shiftToPrint.metrics = getShiftMetrics(shift);
                                                        }
                                                        onPrint && onPrint(shiftToPrint, 'cierre_caja');
                                                    }}
                                                    className="text-[10px] font-black text-secondary hover:text-primary uppercase tracking-widest border border-gray-100 px-3 py-2 rounded-xl"
                                                >
                                                    Reporte
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Apertura de Caja */}
            {showOpenModal && (
                <div className="fixed inset-0 bg-secondary/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in slide-in-from-bottom-8">
                        <div className="bg-gradient-to-br from-primary to-primary/80 p-10 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-3xl font-black tracking-tight">Iniciar Turno</h3>
                                <p className="text-white/70 text-sm font-medium mt-2">Ingrese la base de efectivo inicial</p>
                            </div>
                            <Plus className="absolute -right-10 -bottom-10 text-white/10 w-48 h-48 rotate-12" />
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-secondary tracking-[0.2em] ml-2">Efectivo de Apertura</label>
                                <div className="relative group">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-2xl">$</div>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={initialCash}
                                        onChange={(e) => setInitialCash(e.target.value)}
                                        className="w-full pl-12 pr-8 py-6 bg-gray-50 border-2 border-transparent focus:border-primary/20 rounded-[2rem] focus:outline-none font-black text-3xl text-secondary transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium italic px-4">Esta cantidad es la que se entrega al cajero para dar vueltas/cambio.</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleOpenShift}
                                    className="w-full bg-secondary text-white py-6 rounded-3xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-[0.2em]"
                                >
                                    Abrir Turno Ahora
                                </button>
                                <button onClick={() => setShowOpenModal(false)} className="w-full py-5 text-gray-400 font-black hover:text-red-500 transition-all text-xs uppercase tracking-widest">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Gasto / Salida */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-secondary/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in slide-in-from-bottom-8">
                        <div className="bg-red-500 p-8 text-white relative overflow-hidden text-center">
                            <Minus className="absolute left-[-20px] top-[-20px] text-white/10 w-32 h-32" />
                            <h3 className="text-2xl font-black tracking-tight relative z-10">Registrar Salida de Efectivo</h3>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Valor de la Salida</label>
                                <input
                                    type="number"
                                    autoFocus
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    className="w-full px-8 py-5 bg-gray-50 border-gray-100 rounded-3xl focus:ring-4 focus:ring-red-500/10 focus:outline-none font-black text-2xl text-secondary"
                                    placeholder="$ 0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Concepto o Razón</label>
                                <textarea
                                    value={expenseReason}
                                    onChange={(e) => setExpenseReason(e.target.value)}
                                    className="w-full px-6 py-4 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm font-medium h-24 resize-none"
                                    placeholder="Ej: Pago de cilantro, propina recolectada, etc."
                                ></textarea>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handleAddExpense}
                                    className="flex-1 bg-red-500 text-white py-5 rounded-3xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-widest"
                                >
                                    Confirmar Salida
                                </button>
                                <button onClick={() => setShowExpenseModal(false)} className="px-6 py-5 bg-gray-50 text-secondary rounded-3xl font-black hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">
                                    X
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cierre de Caja (Arqueo Ciego) */}
            {showCloseModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in fade-in duration-200">
                        <div className="bg-primary p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10 text-center w-full">
                                <h3 className="text-2xl font-black tracking-tight">Arqueo de Caja Final</h3>
                                <p className="text-white/60 text-xs font-medium mt-1">Verificación manual a puerta cerrada</p>
                            </div>
                            <Banknote className="absolute -right-8 -bottom-8 text-white/5 w-48 h-48" />
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="text-center space-y-1 py-4">
                                <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
                                <p className="text-sm font-black text-secondary">IMPORTANTE: Arqueo Ciego</p>
                                <p className="text-xs text-gray-400 font-medium">Ingrese el total de efectivo físico que tiene antes de ver el esperado del sistema.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2 text-center">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Efectivo Físico Contado</label>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={countedCash}
                                        onChange={(e) => setCountedCash(e.target.value)}
                                        className="w-full px-6 py-8 bg-gray-50 border-2 border-primary/10 rounded-[2rem] focus:outline-none font-black text-5xl text-secondary text-center"
                                        placeholder="0"
                                    />
                                    <p className="text-[10px] text-gray-300 font-bold px-4 pt-2">Cuente billetes y monedas con cuidado.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleCloseShift}
                                    className="flex-1 bg-secondary text-white py-6 rounded-3xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest"
                                >
                                    Confirmar y Cerrar
                                </button>
                                <button onClick={() => setShowCloseModal(false)} className="px-8 py-6 bg-gray-50 text-secondary rounded-3xl font-black hover:bg-gray-200 transition-all text-sm uppercase tracking-widest">
                                    X
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShiftManagement;
