import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Briefcase, Save, RefreshCw, Plus, User, DollarSign,
    Calendar, CreditCard, Building2, AlertCircle
} from 'lucide-react';
import { sileo } from 'sileo';

// ──────────────────────────────────────────────────────
// Catálogos DIAN / Colombia
// ──────────────────────────────────────────────────────
export const DOC_TYPES = [
    { id: '13', label: 'CC — Cédula de Ciudadanía' },
    { id: '22', label: 'CE — Cédula de Extranjería' },
    { id: '91', label: 'TI — Tarjeta de Identidad' },
    { id: '41', label: 'Pasaporte' },
    { id: '31', label: 'NIT' },
];

export const CONTRACT_TYPES = [
    { id: 'termino_indefinido', label: 'Término Indefinido' },
    { id: 'termino_fijo', label: 'Término Fijo' },
    { id: 'obra_labor', label: 'Obra o Labor' },
    { id: 'aprendizaje', label: 'Contrato de Aprendizaje' },
];

export const WORKER_TYPES = [
    { id: 1, label: '1 — Trabajador de tiempo completo' },
    { id: 2, label: '2 — Trabajador de tiempo parcial' },
];

export const BANK_ACCOUNT_TYPES = [
    { id: 'ahorro', label: 'Cuenta de Ahorros' },
    { id: 'corriente', label: 'Cuenta Corriente' },
];

// ──────────────────────────────────────────────────────
// Valor del SMLMV para cálculos de subsidio de transporte
// ──────────────────────────────────────────────────────
const SMLMV_2025 = 1423500;
const SUBSIDIO_TRANSPORTE_2025 = 200000;

const EMPTY_FORM = {
    document_type: '13',
    document_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    salary: '',
    contract_type: 'termino_indefinido',
    employment_date: '',
    end_date: '',
    worker_type_id: 1,
    sub_worker_type_id: 0,
    high_risk_pension: false,
    integral_salary: false,
    bank_name: '',
    bank_account_type: 'ahorro',
    bank_account_number: '',
};

// ──────────────────────────────────────────────────────
// Componente principal del Modal
// ──────────────────────────────────────────────────────
const PayrollEmployeeModal = ({ isOpen, onClose, employeeToEdit = null, onSaved }) => {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        if (isOpen) {
            if (employeeToEdit) {
                setFormData({ ...EMPTY_FORM, ...employeeToEdit });
            } else {
                setFormData(EMPTY_FORM);
            }
        }
    }, [isOpen, employeeToEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...formData,
                salary: parseFloat(formData.salary) || 0,
                worker_type_id: parseInt(formData.worker_type_id),
                sub_worker_type_id: parseInt(formData.sub_worker_type_id) || 0,
                end_date: formData.end_date || null,
                updated_at: new Date().toISOString(),
            };

            if (employeeToEdit) {
                const { data, error } = await supabase
                    .from('payroll_employees')
                    .update(payload)
                    .eq('id', employeeToEdit.id)
                    .select()
                    .single();
                if (error) throw error;
                sileo.success({ title: 'Actualizado', description: `${data.first_name} actualizado correctamente.` });
                if (onSaved) onSaved(data);
            } else {
                const { data, error } = await supabase
                    .from('payroll_employees')
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                sileo.success({ title: 'Empleado Registrado', description: `${data.first_name} ${data.last_name} fue agregado.` });
                if (onSaved) onSaved(data);
            }
            onClose();
        } catch (error) {
            console.error(error);
            const msg = error.code === '23505'
                ? 'Ya existe un empleado con ese número de documento.'
                : error.message;
            sileo.error({ title: 'Error al guardar', description: msg });
        } finally {
            setSaving(false);
        }
    };

    // Cálculo indicativo de subsidio de transporte
    const salary = parseFloat(formData.salary) || 0;
    const hasTransportSubsidy = !formData.integral_salary && salary > 0 && salary <= SMLMV_2025 * 2;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-secondary/80 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-black text-secondary flex items-center gap-2">
                        <Briefcase className="text-purple-500" size={20} />
                        {employeeToEdit ? 'Editar Empleado' : 'Nuevo Empleado'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-secondary rounded-full p-1 transition-colors">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-6 flex-1">
                    <form id="employeeForm" onSubmit={handleSave} className="space-y-6">

                        {/* ── A. Identificación ── */}
                        <SectionTitle label="A. Identificación" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <FieldLabel>Tipo de Documento</FieldLabel>
                                <select
                                    name="document_type"
                                    value={formData.document_type}
                                    onChange={handleChange}
                                    required
                                    className={SELECT_CLS}
                                >
                                    {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FieldLabel>Número de Documento</FieldLabel>
                                <input
                                    type="text"
                                    name="document_number"
                                    value={formData.document_number}
                                    onChange={handleChange}
                                    required
                                    placeholder="Ej: 1012345678"
                                    className={INPUT_CLS + ' font-mono'}
                                />
                            </div>
                            <div>
                                <FieldLabel><User size={12} className="inline mr-1" />Nombres</FieldLabel>
                                <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Nombres completos" className={INPUT_CLS + ' capitalize'} />
                            </div>
                            <div>
                                <FieldLabel>Apellidos</FieldLabel>
                                <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Apellidos completos" className={INPUT_CLS + ' capitalize'} />
                            </div>
                            <div>
                                <FieldLabel>Correo Electrónico</FieldLabel>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="empleado@empresa.com" className={INPUT_CLS} />
                            </div>
                            <div>
                                <FieldLabel>Teléfono</FieldLabel>
                                <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="+57 ..." className={INPUT_CLS} />
                            </div>
                            <div className="md:col-span-2">
                                <FieldLabel>Dirección de Residencia</FieldLabel>
                                <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Cra 10 # 20-30, Bogotá" className={INPUT_CLS} />
                            </div>
                        </div>

                        {/* ── B. Contrato ── */}
                        <SectionTitle label="B. Contrato y Salario" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <FieldLabel>Tipo de Contrato</FieldLabel>
                                <select name="contract_type" value={formData.contract_type} onChange={handleChange} required className={SELECT_CLS}>
                                    {CONTRACT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FieldLabel>Tipo de Trabajador (DIAN)</FieldLabel>
                                <select name="worker_type_id" value={formData.worker_type_id} onChange={handleChange} className={SELECT_CLS}>
                                    {WORKER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FieldLabel><Calendar size={12} className="inline mr-1" />Fecha de Ingreso</FieldLabel>
                                <input type="date" name="employment_date" value={formData.employment_date} onChange={handleChange} required className={INPUT_CLS} />
                            </div>
                            <div>
                                <FieldLabel>Fecha de Fin de Contrato (opcional)</FieldLabel>
                                <input type="date" name="end_date" value={formData.end_date || ''} onChange={handleChange} className={INPUT_CLS} />
                            </div>
                            <div>
                                <FieldLabel><DollarSign size={12} className="inline mr-1" />Salario Mensual (COP)</FieldLabel>
                                <input
                                    type="number"
                                    name="salary"
                                    value={formData.salary}
                                    onChange={handleChange}
                                    required
                                    min={0}
                                    placeholder={`Mín. ${SMLMV_2025.toLocaleString('es-CO')}`}
                                    className={INPUT_CLS + ' font-mono'}
                                />
                            </div>

                            {/* Flags */}
                            <div className="flex flex-col gap-3 justify-center">
                                <CheckboxItem
                                    name="integral_salary"
                                    checked={formData.integral_salary}
                                    onChange={handleChange}
                                    label="Salario Integral"
                                    sub="≥ 10 SMLMV, sin prestaciones sociales"
                                />
                                <CheckboxItem
                                    name="high_risk_pension"
                                    checked={formData.high_risk_pension}
                                    onChange={handleChange}
                                    label="Pensión Alto Riesgo"
                                    sub="Aportes del 7.5% (no del 4%)"
                                />
                            </div>

                            {/* Subsidio de transporte indicativo */}
                            {hasTransportSubsidy && (
                                <div className="md:col-span-2 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                    <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
                                    <p className="text-xs font-medium text-blue-700">
                                        <strong>Subsidio de Transporte aplica</strong> — El salario está por debajo de 2 SMLMV (${`${(SMLMV_2025 * 2).toLocaleString('es-CO')}`}). Se añadirá automáticamente ${SUBSIDIO_TRANSPORTE_2025.toLocaleString('es-CO')} al liquidar.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ── C. Datos bancarios ── */}
                        <SectionTitle label="C. Cuenta Bancaria (para depósito)" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <FieldLabel><Building2 size={12} className="inline mr-1" />Banco</FieldLabel>
                                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} placeholder="Ej: Bancolombia" className={INPUT_CLS} />
                            </div>
                            <div>
                                <FieldLabel>Tipo de Cuenta</FieldLabel>
                                <select name="bank_account_type" value={formData.bank_account_type} onChange={handleChange} className={SELECT_CLS}>
                                    {BANK_ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <FieldLabel><CreditCard size={12} className="inline mr-1" />Número de Cuenta</FieldLabel>
                                <input type="text" name="bank_account_number" value={formData.bank_account_number} onChange={handleChange} placeholder="0000000000" className={INPUT_CLS + ' font-mono'} />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-secondary transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="employeeForm" disabled={saving} className="flex items-center gap-2 bg-purple-600 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {employeeToEdit ? 'Guardar Cambios' : 'Registrar Empleado'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────
// Helpers UI
// ──────────────────────────────────────────────────────
const SectionTitle = ({ label }) => (
    <h4 className="text-xs font-black text-secondary border-b border-gray-100 pb-2 uppercase tracking-widest">{label}</h4>
);

const FieldLabel = ({ children }) => (
    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{children}</label>
);

const CheckboxItem = ({ name, checked, onChange, label, sub }) => (
    <label className="flex items-start gap-3 cursor-pointer p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-purple-200 transition-colors">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500 mt-0.5" />
        <div>
            <div className="text-xs font-black text-secondary uppercase">{label}</div>
            <div className="text-[10px] text-gray-400 font-medium mt-0.5">{sub}</div>
        </div>
    </label>
);

const INPUT_CLS = 'w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-purple-500 focus:border-purple-500 transition-all shadow-sm';
const SELECT_CLS = 'w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-purple-500 focus:border-purple-500 transition-all';

export default PayrollEmployeeModal;
