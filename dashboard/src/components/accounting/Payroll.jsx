import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, FileText, CheckCircle, RefreshCw, Send, Hexagon,
    Plus, Search, Briefcase, Download, DollarSign, Calendar, Edit
} from 'lucide-react';
import { sileo } from 'sileo';

const Payroll = () => {
    const [subTab, setSubTab] = useState('employees'); // employees | documents

    return (
        <div className="h-full flex flex-col fade-in">
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                <button
                    onClick={() => setSubTab('employees')}
                    className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === 'employees'
                        ? 'border-b-4 border-secondary text-secondary'
                        : 'text-gray-400 hover:text-secondary'
                        }`}
                >
                    <Users size={16} className="inline-block mr-2 -mt-1" />
                    Directorio Empleados
                </button>
                <button
                    onClick={() => setSubTab('documents')}
                    className={`pb-2 px-4 text-sm font-black uppercase tracking-widest transition-all ${subTab === 'documents'
                        ? 'border-b-4 border-secondary text-secondary'
                        : 'text-gray-400 hover:text-secondary'
                        }`}
                >
                    <FileText size={16} className="inline-block mr-2 -mt-1" />
                    Desprendibles DIAN
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {subTab === 'employees' ? <PayrollEmployees /> : <PayrollDocuments />}
            </div>
        </div>
    );
};

// -----------------------------------------------------
// Empleados
// -----------------------------------------------------
const PayrollEmployees = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payroll_employees')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // If the table doesn't exist yet, just clear and simulate empty
                if (error.code === '42P01') {
                    setEmployees([]);
                    return;
                }
                throw error;
            }
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            sileo.error({ title: 'Error', description: 'No se pudieron cargar los empleados.' });
        } finally {
            setLoading(false);
        }
    };

    const filtered = employees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.document_number.includes(searchTerm)
    );

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl font-black text-secondary">Gestión de Contratos</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                        Información base para liquidación de nómina requerida por la DIAN.
                    </p>
                </div>
                <button
                    onClick={() => sileo.info('En desarrollo', 'Para asignar un nuevo empleado, usa esta ventana próximamente.')}
                    className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md active:scale-95"
                >
                    <Plus size={16} /> Agregar Empleado
                </button>
            </div>

            <div className="flex gap-4 mb-6 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar empleado por nombre o cédula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1">
                {loading ? (
                    <div className="flex justify-center items-center h-48 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Hexagon size={48} className="text-gray-200 mx-auto mb-4" />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Aún no hay empleados</p>
                        <p className="text-xs text-gray-400 mt-2">Agrega el primer empleado o verifica la tabla en BD</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Identificación</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Nombre</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Contrato / Salario</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">{emp.document_type}</span>
                                            <span className="text-sm font-bold text-secondary font-mono">
                                                {emp.document_number}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm font-black text-secondary">
                                        {emp.first_name} {emp.last_name}
                                    </td>
                                    <td className="p-4">
                                        <p className="text-xs font-bold text-gray-600 uppercase mb-1">
                                            {emp.contract_type.replace('_', ' ')}
                                        </p>
                                        <p className="text-xs font-black text-emerald-600 flex items-center gap-1">
                                            <DollarSign size={12} /> {(emp.salary || 0).toLocaleString('es-CO')}
                                        </p>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                                            <Edit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// -----------------------------------------------------
// Desprendibles (Nómina)
// -----------------------------------------------------
const PayrollDocuments = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDocs();
    }, []);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payroll_documents')
                .select('*, payroll_employees(first_name, last_name, document_number)')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    setDocs([]);
                    return;
                }
                throw error;
            }
            setDocs(data || []);
        } catch (error) {
            console.error('Error fetching docs:', error);
            sileo.error('Error cargando los desprendibles');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-xl font-black text-secondary">Desprendibles de Pago</h2>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                        Liquidaciones de nómina pendientes y emitidas a la DIAN.
                    </p>
                </div>
                <button
                    onClick={() => sileo.info('En desarrollo', 'Para liquidar un mes nuevo usa este botón.')}
                    className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-secondary/90 transition-all shadow-md active:scale-95"
                >
                    <Plus size={16} /> Nueva Liquidación
                </button>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1">
                {loading ? (
                    <div className="flex justify-center items-center h-48 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : docs.length === 0 ? (
                    <div className="text-center py-20">
                        <Briefcase size={48} className="text-gray-200 mx-auto mb-4" />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No hay nóminas</p>
                        <p className="text-xs text-gray-400 mt-2">Comienza liquidando la primera quincena o mes.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Empleado</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Periodo</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Monto Neto</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Estado DIAN</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {docs.map(doc => (
                                <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                    <td className="p-4 text-sm font-black text-secondary">
                                        {doc.payroll_employees?.first_name} {doc.payroll_employees?.last_name}
                                        <div className="text-[10px] font-bold text-gray-400 font-mono mt-1">CC {doc.payroll_employees?.document_number}</div>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-gray-600 flex items-center gap-2 mt-4">
                                        <Calendar size={14} className="text-blue-500" />
                                        {doc.period_start} a {doc.period_end}
                                    </td>
                                    <td className="p-4 text-lg font-black text-secondary">
                                        ${(doc.net_total || 0).toLocaleString('es-CO')}
                                    </td>
                                    <td className="p-4">
                                        {doc.factus_status === 'signed' ? (
                                            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-700">Aprobado</span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-orange-100 text-orange-700">Pendiente</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {doc.factus_status !== 'signed' && (
                                            <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-white font-black text-[10px] uppercase rounded-lg hover:bg-black transition-all ml-auto">
                                                <Send size={12} /> Emitir a DIAN
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Payroll;
