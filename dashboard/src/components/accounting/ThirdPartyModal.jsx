import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Plus, Save, RefreshCw, Mail, Phone, MapPin } from 'lucide-react';
import { sileo } from 'sileo';

export const DOC_TYPES = [
    { id: 'NIT', label: 'NIT - Número de Identificación Tributaria' },
    { id: 'CC', label: 'CC - Cédula de Ciudadanía' },
    { id: 'CE', label: 'CE - Cédula de Extranjería' },
    { id: 'TI', label: 'TI - Tarjeta de Identidad' },
    { id: 'PASS', label: 'Pasaporte' }
];

export const TAX_REGIMES = [
    { id: 'responsable_iva', label: 'Responsable de IVA' },
    { id: 'no_responsable', label: 'No Responsable' },
    { id: 'regimen_simple', label: 'Régimen Simple' }
];

export const calculateDV = (nit) => {
    if (!nit || isNaN(nit)) return null;
    let vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    let z = nit.length;
    let x = 0;
    let y = 0;
    for (let i = 0; i < z; i++) {
        y = nit.substring(i, i + 1);
        x += (y * vpri[z - 1 - i]);
    }
    let y1 = x % 11;
    return y1 > 1 ? 11 - y1 : y1;
};

const ThirdPartyModal = ({ isOpen, onClose, thirdPartyToEdit = null, onSaved, initialDocNumber = '' }) => {
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        document_type: 'CC', document_number: initialDocNumber, verification_digit: '',
        business_name: '', first_name: '', last_name: '',
        tax_regime: 'responsable_iva', liability_code: '',
        email: '', phone: '', address: '', city: '',
        is_client: true, is_supplier: false, is_employee: false
    });

    useEffect(() => {
        if (isOpen) {
            if (thirdPartyToEdit) {
                setFormData(thirdPartyToEdit);
            } else {
                setFormData({
                    document_type: 'CC', document_number: initialDocNumber, verification_digit: '',
                    business_name: '', first_name: '', last_name: '',
                    tax_regime: 'responsable_iva', liability_code: '',
                    email: '', phone: '', address: '', city: '',
                    is_client: true, is_supplier: false, is_employee: false
                });
            }
        }
    }, [isOpen, thirdPartyToEdit, initialDocNumber]);

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newFormData = { ...formData, [name]: type === 'checkbox' ? checked : value };

        if (name === 'document_number' || name === 'document_type') {
            const docType = name === 'document_type' ? value : newFormData.document_type;
            const docNum = name === 'document_number' ? value : newFormData.document_number;

            if (docType === 'NIT' && docNum) {
                newFormData.verification_digit = calculateDV(docNum);
            } else if (docType !== 'NIT') {
                newFormData.verification_digit = '';
            }
        }
        setFormData(newFormData);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...formData, updated_at: new Date().toISOString() };
            if (formData.document_type !== 'NIT') {
                payload.business_name = '';
            } else {
                payload.first_name = '';
                payload.last_name = '';
            }

            let responseData;
            if (thirdPartyToEdit) {
                const { data, error } = await supabase.from('third_parties').update(payload).eq('id', thirdPartyToEdit.id).select().single();
                if (error) throw error;
                sileo.success({ title: 'Actualizado', description: 'Tercero actualizado exitosamente.' });
                responseData = data;
            } else {
                const { data, error } = await supabase.from('third_parties').insert([payload]).select().single();
                if (error) throw error;
                sileo.success({ title: 'Creado', description: 'Tercero registrado en la base de datos.' });
                responseData = data;
            }

            if (onSaved) onSaved(responseData);
            onClose();
        } catch (error) {
            console.error(error);
            const msg = error.code === '23505' ? 'Ya existe un tercero con este documento.' : error.message;
            sileo.error({ title: 'Error al guardar', description: msg });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-secondary/80 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-black text-secondary flex items-center gap-2">
                        <Shield className="text-blue-500" size={20} />
                        {thirdPartyToEdit ? 'Editar Tercero' : 'Registrar Nuevo Tercero'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-secondary rounded-full p-1 transition-colors">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                    <form id="thirdPartyForm" onSubmit={handleSave} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Roles asignados (Multipropósito)</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-emerald-200 transition-colors flex-1">
                                    <input type="checkbox" name="is_client" checked={formData.is_client} onChange={handleFormChange} className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500" />
                                    <span className="text-xs font-black text-secondary uppercase">Cliente</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-amber-200 transition-colors flex-1">
                                    <input type="checkbox" name="is_supplier" checked={formData.is_supplier} onChange={handleFormChange} className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500" />
                                    <span className="text-xs font-black text-secondary uppercase">Proveedor</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-purple-200 transition-colors flex-1">
                                    <input type="checkbox" name="is_employee" checked={formData.is_employee} onChange={handleFormChange} className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500" />
                                    <span className="text-xs font-black text-secondary uppercase">Empleado</span>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1 md:col-span-2">
                                <h4 className="text-xs font-black text-secondary border-b pb-2 mb-3 uppercase tracking-widest">A. Identificación Fiscal</h4>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tipo de Documento</label>
                                <select name="document_type" value={formData.document_type} onChange={handleFormChange} required className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 focus:border-blue-500 transition-all">
                                    {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Número</label>
                                    <input type="text" name="document_number" value={formData.document_number} onChange={handleFormChange} required placeholder="Ej: 900123456" className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm font-mono" />
                                </div>
                                {formData.document_type === 'NIT' && (
                                    <div className="w-16">
                                        <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex justify-between">DV <Shield size={10} /></label>
                                        <input type="text" name="verification_digit" value={formData.verification_digit !== null ? formData.verification_digit : ''} readOnly className="w-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-black text-center rounded-xl p-3 outline-none font-mono cursor-not-allowed" />
                                    </div>
                                )}
                            </div>

                            <div className="col-span-1 md:col-span-2 mt-4">
                                <h4 className="text-xs font-black text-secondary border-b pb-2 mb-3 uppercase tracking-widest">B. Datos del Tercero</h4>
                            </div>

                            {formData.document_type === 'NIT' ? (
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Razón Social Registrada en RUT</label>
                                    <input type="text" name="business_name" value={formData.business_name} onChange={handleFormChange} required className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm uppercase" />
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nombres (Natural)</label>
                                        <input type="text" name="first_name" value={formData.first_name} onChange={handleFormChange} required className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm capitalize" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Apellidos (Natural)</label>
                                        <input type="text" name="last_name" value={formData.last_name} onChange={handleFormChange} required className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm capitalize" />
                                    </div>
                                </>
                            )}

                            <div className="mt-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Régimen Tributario</label>
                                <select name="tax_regime" value={formData.tax_regime} onChange={handleFormChange} className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all">
                                    {TAX_REGIMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="mt-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Cód. Responsabilidad (RUT)</label>
                                <input type="text" name="liability_code" value={formData.liability_code} onChange={handleFormChange} placeholder="Ej: O-13, O-47" className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm font-mono" />
                            </div>

                            <div className="col-span-1 md:col-span-2 mt-4">
                                <h4 className="text-xs font-black text-secondary border-b pb-2 mb-3 uppercase tracking-widest">C. Datos de Contacto y Notificación</h4>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5"><Mail size={12} className="inline mr-1" /> Correo (FE)</label>
                                <input type="email" name="email" value={formData.email} onChange={handleFormChange} placeholder="facturacion@empresa.com" className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5"><Phone size={12} className="inline mr-1" /> Teléfono</label>
                                <input type="text" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="+57..." className="w-full bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm" />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5"><MapPin size={12} className="inline mr-1" /> Dirección Física</label>
                                <div className="flex gap-2">
                                    <input type="text" name="address" value={formData.address} onChange={handleFormChange} placeholder="Calle 123 #..." className="flex-1 bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm" />
                                    <input type="text" name="city" value={formData.city} onChange={handleFormChange} placeholder="Ciudad" className="w-1/3 bg-white border border-gray-200 text-secondary text-sm rounded-xl p-3 outline-none focus:ring-blue-500 transition-all shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-secondary transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="thirdPartyForm" disabled={saving} className="flex items-center gap-2 bg-blue-500 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar Tercero
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThirdPartyModal;
