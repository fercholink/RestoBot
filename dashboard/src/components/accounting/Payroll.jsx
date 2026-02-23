import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, FileText, CheckCircle, RefreshCw, Send, Hexagon,
    Plus, Search, Briefcase, DollarSign, Calendar, Edit, Trash2
} from 'lucide-react';
import { sileo } from 'sileo';
import factusService from '../../services/factusService';
import PayrollEmployeeModal from './PayrollEmployeeModal';
import PayrollLiquidationModal from './PayrollLiquidationModal';

// ──────────────────────────────────────────────────────
// Componente contenedor principal
// ──────────────────────────────────────────────────────
const Payroll = () => {
    const [subTab, setSubTab] = useState('employees');

    return (
        <div className="h-full flex flex-col fade-in">
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                {[
                    { id: 'employees', label: 'Directorio Empleados', icon: Users },
                    { id: 'documents', label: 'Desprendibles / Nómina', icon: FileText },
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setSubTab(id)}
                        className={`flex items-center gap-2 pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === id
                            ? 'border-b-4 border-secondary text-secondary'
                            : 'text-gray-400 hover:text-secondary'
                            }`}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto">
                {subTab === 'employees'
                    ? <PayrollEmployees onGoToDocuments={() => setSubTab('documents')} />
                    : <PayrollDocuments />
                }
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────
// Tab 1: Empleados
// ──────────────────────────────────────────────────────
const PayrollEmployees = ({ onGoToDocuments }) => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    useEffect(() => { fetchEmployees(); }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payroll_employees')
                .select('*')
                .order('created_at', { ascending: false });
            if (error && error.code !== '42P01') throw error;
            setEmployees(data || []);
        } catch (err) {
            console.error(err);
            sileo.error({ title: 'Error', description: 'No se pudieron cargar los empleados.' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (emp = null) => {
        setEditing(emp);
        setIsModalOpen(true);
    };

    const handleDelete = async (emp) => {
        if (!window.confirm(`¿Eliminar a ${emp.first_name} ${emp.last_name}? Esta acción no se puede deshacer.`)) return;
        const { error } = await supabase.from('payroll_employees').delete().eq('id', emp.id);
        if (error) {
            sileo.error({ title: 'Error', description: error.message });
        } else {
            sileo.success({ title: 'Eliminado', description: 'Empleado eliminado.' });
            fetchEmployees();
        }
    };

    const filtered = employees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.document_number || '').includes(searchTerm)
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Cabecera */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-black text-secondary">Gestión de Contratos</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">Información base para liquidación de nómina requerida por la DIAN.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all shadow-md active:scale-95"
                >
                    <Plus size={16} /> Agregar Empleado
                </button>
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o cédula..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-purple-500 focus:border-purple-500 outline-none transition-all shadow-sm"
                />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-48 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Hexagon size={48} className="text-gray-200 mx-auto mb-4" />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Aún no hay empleados</p>
                        <p className="text-xs text-gray-400 mt-2">Agrega el primer empleado con el botón de arriba.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                {['Identificación', 'Nombre', 'Contrato', 'Salario', 'Acciones'].map(h => (
                                    <th key={h} className={`p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 ${h === 'Acciones' ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-purple-50 text-purple-600 px-2 py-0.5 rounded uppercase">CC</span>
                                            <span className="text-sm font-bold text-secondary font-mono">{emp.document_number}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm font-black text-secondary">
                                        {emp.first_name} {emp.last_name}
                                        {emp.integral_salary && (
                                            <span className="ml-2 text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase">Integral</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs font-bold text-gray-600 capitalize">{emp.contract_type?.replace(/_/g, ' ')}</span>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{emp.employment_date}</div>
                                    </td>
                                    <td className="p-4 text-sm font-black text-emerald-600">
                                        ${(emp.salary || 0).toLocaleString('es-CO')}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleOpenModal(emp)}
                                                className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(emp)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            <PayrollEmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                employeeToEdit={editing}
                onSaved={() => { setIsModalOpen(false); fetchEmployees(); }}
            />
        </div>
    );
};

// ──────────────────────────────────────────────────────
// Tab 2: Desprendibles / Liquidaciones
// ──────────────────────────────────────────────────────
const PayrollDocuments = () => {
    const [docs, setDocs] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [editingDoc, setEditingDoc] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [{ data: docsData, error: docsErr }, { data: empsData, error: empsErr }] = await Promise.all([
                supabase.from('payroll_documents').select('*, payroll_employees(id, first_name, last_name, document_number, salary), payroll_items(*)').order('created_at', { ascending: false }),
                supabase.from('payroll_employees').select('*').order('first_name'),
            ]);
            if (docsErr && docsErr.code !== '42P01') throw docsErr;
            if (empsErr && empsErr.code !== '42P01') throw empsErr;
            setDocs(docsData || []);
            setEmployees(empsData || []);
        } catch (err) {
            console.error(err);
            sileo.error({ title: 'Error', description: 'No se pudo cargar la información.' });
        } finally {
            setLoading(false);
        }
    };

    const openNewLiquidacion = (emp) => {
        setSelectedEmployee(emp);
        setEditingDoc(null);
        setPickerOpen(false);
        setIsModalOpen(true);
    };

    const openEditLiquidacion = (doc) => {
        setSelectedEmployee(doc.payroll_employees);
        setEditingDoc(doc);
        setIsModalOpen(true);
    };

    const handleDelete = async (doc) => {
        if (!window.confirm('¿Eliminar esta liquidación?')) return;
        const { error } = await supabase.from('payroll_documents').delete().eq('id', doc.id);
        if (error) {
            sileo.error({ title: 'Error', description: error.message });
        } else {
            sileo.success({ title: 'Eliminada', description: 'Liquidación eliminada.' });
            fetchAll();
        }
    };

    const handleEmitToDIAN = async (doc) => {
        if (!window.confirm(`¿Estás seguro de emitir a la DIAN la nómina de ${doc.payroll_employees?.first_name}? Esta acción es irreversible.`)) return;

        let loadingToast = null;
        try {
            loadingToast = sileo.loading({ title: 'Emitiendo...', description: 'Conectando con la DIAN a través de Factus...' });

            const emp = doc.payroll_employees;

            // ⚠️ Mapeo simplificado (Debe ajustarse al esquema exacto de API Factus v1)
            const payload = {
                document_type_id: 10, // 10: Nómina Individual
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
                payment_date: doc.payment_date,
                period: {
                    start_date: doc.period_start,
                    end_date: doc.period_end,
                    worked_days: 30 // Calcular basado en fechas
                },
                worker: {
                    identification_document_id: 3, // 3: CC (Ajustar dinámicamente)
                    identification: emp.document_number,
                    first_name: emp.first_name,
                    last_name: emp.last_name,
                    worker_type_id: emp.worker_type_id || 1,
                    sub_worker_type_id: emp.sub_worker_type_id || 0,
                    salary: emp.salary,
                },
                accrueds: {
                    basic: { worked_days: 30, amount: doc.accrued_total } // Mapear doc.payroll_items de tipo devengo
                },
                deductions: {
                    health: { percentage: 4, amount: doc.deductions_total / 2 }, // Ajustar
                    pension: { percentage: 4, amount: doc.deductions_total / 2 } // Ajustar
                },
                totals: {
                    accrued_total: doc.accrued_total,
                    deductions_total: doc.deductions_total,
                    net_total: doc.net_total
                }
            };

            await factusService.emitPayroll(payload);

            // Actualizar estado en BD
            const { error } = await supabase
                .from('payroll_documents')
                .update({ factus_status: 'signed', factus_doc_number: `NOM-${doc.id.substring(0, 8)}` })
                .eq('id', doc.id);

            if (error) throw error;

            if (loadingToast) loadingToast.close();
            sileo.success({ title: '¡Éxito!', description: 'Nómina emitida y firmada correctamente.' });
            fetchAll();
        } catch (error) {
            if (loadingToast) loadingToast.close();
            console.error('Error enviando nómina:', error);
            sileo.error({ title: 'Error Factus', description: error.message || 'No se pudo emitir la nómina.' });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Cabecera */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-black text-secondary">Desprendibles de Pago</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">Liquidaciones de nómina guardadas. Pendientes o emitidas a la DIAN.</p>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setPickerOpen(v => !v)}
                        className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/90 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={16} /> Nueva Liquidación
                    </button>
                    {pickerOpen && (
                        <div className="absolute right-0 top-12 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl w-72 p-2 animate-in zoom-in-95 duration-150">
                            <p className="text-[10px] font-black text-gray-400 uppercase px-3 pt-2 pb-1">Selecciona empleado</p>
                            {employees.length === 0 ? (
                                <p className="text-xs text-gray-400 px-3 py-4 text-center">No hay empleados registrados.</p>
                            ) : (
                                employees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => openNewLiquidacion(emp)}
                                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="text-sm font-black text-secondary">{emp.first_name} {emp.last_name}</div>
                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">CC {emp.document_number} — ${(emp.salary || 0).toLocaleString('es-CO')}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Lista */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-48 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : docs.length === 0 ? (
                    <div className="text-center py-20">
                        <Briefcase size={48} className="text-gray-200 mx-auto mb-4" />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No hay liquidaciones</p>
                        <p className="text-xs text-gray-400 mt-2">Crea la primera usando el botón "Nueva Liquidación".</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                {['Empleado', 'Periodo', 'Devengado', 'Deducciones', 'Neto', 'Estado', 'Acciones'].map(h => (
                                    <th key={h} className={`p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 ${h === 'Acciones' ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {docs.map(doc => {
                                const emp = doc.payroll_employees || {};
                                const signed = doc.factus_status === 'signed';
                                return (
                                    <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                                        <td className="p-4">
                                            <div className="text-sm font-black text-secondary">{emp.first_name} {emp.last_name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">CC {emp.document_number}</div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-gray-600">
                                            <div className="flex items-center gap-1"><Calendar size={12} className="text-blue-500" />{doc.period_start}</div>
                                            <div className="text-gray-400 pl-4">→ {doc.period_end}</div>
                                        </td>
                                        <td className="p-4 text-sm font-black text-emerald-600">${(doc.accrued_total || 0).toLocaleString('es-CO')}</td>
                                        <td className="p-4 text-sm font-black text-red-500">${(doc.deductions_total || 0).toLocaleString('es-CO')}</td>
                                        <td className="p-4 text-lg font-black text-secondary">${(doc.net_total || 0).toLocaleString('es-CO')}</td>
                                        <td className="p-4">
                                            {signed ? (
                                                <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                                                    <CheckCircle size={10} /> Aprobado
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-orange-100 text-orange-700 w-fit block">Borrador</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {!signed && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditLiquidacion(doc)}
                                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="Editar"
                                                        >
                                                            <Edit size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEmitToDIAN(doc)}
                                                            className="flex items-center gap-1 p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                            title="Emitir a DIAN"
                                                        >
                                                            <Send size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(doc)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal liquidación */}
            <PayrollLiquidationModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setPickerOpen(false); }}
                employee={selectedEmployee}
                documentToEdit={editingDoc}
                onSaved={fetchAll}
            />
        </div>
    );
};

export default Payroll;
