import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    FileText, Save, RefreshCw, Plus,
    TrendingUp, TrendingDown, DollarSign, Calendar, Trash2
} from 'lucide-react';
import { sileo } from 'sileo';

// ──────────────────────────────────────────────────────
// Catálogos de conceptos de nómina (DIAN Colombia)
// ──────────────────────────────────────────────────────
const SMLMV = 1423500;
const SUBSIDIO_TRANSPORTE = 200000;

const ACCRUED_ITEMS = [
    { key: 'salary', label: 'Salario Básico', editable: false },
    { key: 'transport', label: 'Subsidio de Transporte', editable: false },
    { key: 'overtime', label: 'Horas Extras', editable: true },
    { key: 'commission', label: 'Comisiones / Bonificaciones', editable: true },
    { key: 'vacation', label: 'Vacaciones', editable: true },
    { key: 'bonus', label: 'Prima de Servicios', editable: true },
    { key: 'cesantias', label: 'Cesantías', editable: true },
    { key: 'other_accrued', label: 'Otros Devengados', editable: true },
];

const DEDUCTION_ITEMS = [
    { key: 'health', label: 'Salud (4%)', editable: false },
    { key: 'pension', label: 'Pensión (4%)', editable: false },
    { key: 'rte_fte', label: 'Retención en la Fuente', editable: true },
    { key: 'advance', label: 'Préstamo / Anticipo', editable: true },
    { key: 'library', label: 'Libranza', editable: true },
    { key: 'other_deduction', label: 'Otras Deducciones', editable: true },
];

const calcDefaults = (employee, periodDays) => {
    const salary = parseFloat(employee.salary) || 0;
    const dailySalary = salary / 30;
    const proportionalSalary = Math.round(dailySalary * periodDays);
    const hasTransport = !employee.integral_salary && salary <= SMLMV * 2;
    const transport = hasTransport ? Math.round(SUBSIDIO_TRANSPORTE / 30 * periodDays) : 0;

    const base = employee.integral_salary ? salary * 0.7 : proportionalSalary;
    const pensionRate = employee.high_risk_pension ? 0.075 : 0.04;

    return {
        salary: proportionalSalary,
        transport,
        health: Math.round(base * 0.04),
        pension: Math.round(base * pensionRate),
        overtime: 0,
        commission: 0,
        vacation: 0,
        bonus: 0,
        cesantias: 0,
        other_accrued: 0,
        rte_fte: 0,
        advance: 0,
        library: 0,
        other_deduction: 0,
    };
};

// ──────────────────────────────────────────────────────
// Modal principal
// ──────────────────────────────────────────────────────
const PayrollLiquidationModal = ({ isOpen, onClose, employee = null, documentToEdit = null, onSaved }) => {
    const [saving, setSaving] = useState(false);
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [amounts, setAmounts] = useState({});

    // Días del periodo
    const periodDays = (() => {
        if (!periodStart || !periodEnd) return 30;
        const d1 = new Date(periodStart);
        const d2 = new Date(periodEnd);
        const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        return Math.max(1, Math.min(diff, 30));
    })();

    useEffect(() => {
        if (!isOpen) return;

        if (documentToEdit) {
            setPeriodStart(documentToEdit.period_start || '');
            setPeriodEnd(documentToEdit.period_end || '');
            setPaymentDate(documentToEdit.payment_date || '');
            // Rebuild amounts map from items
            const map = {};
            (documentToEdit.payroll_items || []).forEach(item => { map[item.category] = item.amount; });
            setAmounts(map);
        } else if (employee) {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            setPeriodStart(firstDay);
            setPeriodEnd(lastDay);
            setPaymentDate(lastDay);
            setAmounts(calcDefaults(employee, 30));
        }
    }, [isOpen, employee, documentToEdit]);

    // Recalcular salud/pensión cuando cambia el periodo o un devengado base
    useEffect(() => {
        if (!employee) return;
        const defaults = calcDefaults(employee, periodDays);
        setAmounts(prev => ({
            ...prev,
            salary: defaults.salary,
            transport: defaults.transport,
            health: defaults.health,
            pension: defaults.pension,
        }));
    }, [periodDays, employee]);

    const setAmount = (key, val) => {
        setAmounts(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
    };

    const totalAccrued = ACCRUED_ITEMS.reduce((s, i) => s + (parseFloat(amounts[i.key]) || 0), 0);
    const totalDeductions = DEDUCTION_ITEMS.reduce((s, i) => s + (parseFloat(amounts[i.key]) || 0), 0);
    const netTotal = totalAccrued - totalDeductions;

    const handleSave = async (e) => {
        e.preventDefault();
        if (!employee) return;
        setSaving(true);
        try {
            const docPayload = {
                employee_id: employee.id,
                period_start: periodStart,
                period_end: periodEnd,
                accrued_total: totalAccrued,
                deductions_total: totalDeductions,
                net_total: netTotal,
                payment_date: paymentDate || null,
                factus_status: 'draft',
            };

            let docId;
            if (documentToEdit) {
                const { data, error } = await supabase
                    .from('payroll_documents')
                    .update(docPayload)
                    .eq('id', documentToEdit.id)
                    .select()
                    .single();
                if (error) throw error;
                docId = data.id;
                // Delete existing items
                await supabase.from('payroll_items').delete().eq('document_id', docId);
            } else {
                const { data, error } = await supabase
                    .from('payroll_documents')
                    .insert([docPayload])
                    .select()
                    .single();
                if (error) throw error;
                docId = data.id;
            }

            // Insert items
            const items = [
                ...ACCRUED_ITEMS.map(i => ({
                    document_id: docId,
                    type: 'ACCRUED',
                    category: i.key,
                    amount: parseFloat(amounts[i.key]) || 0,
                    description: i.label,
                })),
                ...DEDUCTION_ITEMS.map(i => ({
                    document_id: docId,
                    type: 'DEDUCTION',
                    category: i.key,
                    amount: parseFloat(amounts[i.key]) || 0,
                    description: i.label,
                })),
            ].filter(it => it.amount > 0);

            const { error: itemsError } = await supabase.from('payroll_items').insert(items);
            if (itemsError) throw itemsError;

            sileo.success({ title: documentToEdit ? 'Liquidación Actualizada' : 'Liquidación Guardada', description: `Neto: $${netTotal.toLocaleString('es-CO')}` });
            if (onSaved) onSaved();
            onClose();
        } catch (err) {
            console.error(err);
            sileo.error({ title: 'Error al guardar', description: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !employee) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-secondary/80 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-secondary flex items-center gap-2">
                            <FileText className="text-emerald-500" size={20} />
                            {documentToEdit ? 'Editar Liquidación' : 'Nueva Liquidación de Nómina'}
                        </h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            {employee.first_name} {employee.last_name} — CC {employee.document_number}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-secondary rounded-full p-1 transition-colors">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 flex-1">
                    <form id="liquidationForm" onSubmit={handleSave}>

                        {/* Periodo */}
                        <SectionTitle label="Periodo de Liquidación" />
                        <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
                            <div>
                                <FieldLabel><Calendar size={12} className="inline mr-1" />Inicio del Periodo</FieldLabel>
                                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} required className={INPUT_CLS} />
                            </div>
                            <div>
                                <FieldLabel>Fin del Periodo</FieldLabel>
                                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required className={INPUT_CLS} />
                            </div>
                            <div>
                                <FieldLabel>Fecha de Pago</FieldLabel>
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={INPUT_CLS} />
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 font-bold mb-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                            📅 Días del periodo: <strong>{periodDays}</strong> / Salario mensual: <strong>${(employee.salary || 0).toLocaleString('es-CO')}</strong>
                            {employee.integral_salary && <span className="ml-2 text-purple-600 font-black">[Integral]</span>}
                        </div>

                        {/* Devengados / Deducciones side by side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Devengados */}
                            <div>
                                <SectionTitle label="Devengados (Ingresos)" icon={<TrendingUp size={14} className="text-emerald-500" />} />
                                <div className="space-y-2 mt-3">
                                    {ACCRUED_ITEMS.map(item => (
                                        <ConceptRow
                                            key={item.key}
                                            label={item.label}
                                            value={amounts[item.key] || 0}
                                            editable={item.editable}
                                            onChange={val => setAmount(item.key, val)}
                                            colorClass="border-emerald-100 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    ))}
                                    <div className="flex justify-between items-center pt-3 border-t border-emerald-200 mt-2">
                                        <span className="text-xs font-black text-emerald-700 uppercase">Total Devengado</span>
                                        <span className="text-sm font-black text-emerald-700">${totalAccrued.toLocaleString('es-CO')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Deducciones */}
                            <div>
                                <SectionTitle label="Deducciones (Descuentos)" icon={<TrendingDown size={14} className="text-red-400" />} />
                                <div className="space-y-2 mt-3">
                                    {DEDUCTION_ITEMS.map(item => (
                                        <ConceptRow
                                            key={item.key}
                                            label={item.label}
                                            value={amounts[item.key] || 0}
                                            editable={item.editable}
                                            onChange={val => setAmount(item.key, val)}
                                            colorClass="border-red-100 focus:ring-red-400 focus:border-red-400"
                                        />
                                    ))}
                                    <div className="flex justify-between items-center pt-3 border-t border-red-200 mt-2">
                                        <span className="text-xs font-black text-red-500 uppercase">Total Deducciones</span>
                                        <span className="text-sm font-black text-red-500">${totalDeductions.toLocaleString('es-CO')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Neto */}
                        <div className={`mt-6 flex justify-between items-center p-5 rounded-2xl border-2 ${netTotal >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-center gap-2">
                                <DollarSign size={20} className={netTotal >= 0 ? 'text-emerald-600' : 'text-red-500'} />
                                <span className="font-black text-secondary uppercase text-sm">Neto a Pagar</span>
                            </div>
                            <span className={`text-3xl font-black ${netTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                ${netTotal.toLocaleString('es-CO')}
                            </span>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-secondary transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="liquidationForm" disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        {documentToEdit ? 'Guardar Cambios' : 'Guardar Liquidación'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────
const ConceptRow = ({ label, value, editable, onChange, colorClass }) => (
    <div className="flex items-center gap-2">
        <span className={`flex-1 text-xs font-bold ${editable ? 'text-gray-600' : 'text-gray-400'}`}>{label}</span>
        <input
            type="number"
            value={value}
            onChange={e => onChange(e.target.value)}
            readOnly={!editable}
            min={0}
            className={`w-32 text-right text-xs font-mono rounded-lg px-2 py-1.5 border outline-none transition-all shadow-sm
                ${editable
                    ? `bg-white text-secondary ${colorClass}`
                    : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'}`}
        />
    </div>
);

const SectionTitle = ({ label, icon }) => (
    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        {icon}
        <h4 className="text-xs font-black text-secondary uppercase tracking-widest">{label}</h4>
    </div>
);

const FieldLabel = ({ children }) => (
    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{children}</label>
);

const INPUT_CLS = 'w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm';

export default PayrollLiquidationModal;
