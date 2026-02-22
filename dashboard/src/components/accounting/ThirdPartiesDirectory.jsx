import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, Plus, Search, Filter, Edit, Trash2, Shield,
    User, Building2, Phone, Mail, MapPin, RefreshCw, Hexagon
} from 'lucide-react';
import { sileo } from 'sileo';

const DOC_TYPES = [
    { id: 'NIT', label: 'NIT - Número de Identificación Tributaria' },
    { id: 'CC', label: 'CC - Cédula de Ciudadanía' },
    { id: 'CE', label: 'CE - Cédula de Extranjería' },
    { id: 'TI', label: 'TI - Tarjeta de Identidad' },
    { id: 'PASS', label: 'Pasaporte' }
];

const TAX_REGIMES = [
    { id: 'responsable_iva', label: 'Responsable de IVA' },
    { id: 'no_responsable', label: 'No Responsable' },
    { id: 'regimen_simple', label: 'Régimen Simple' }
];

// Cálculo de Dígito de Verificación (Algoritmo DIAN)
const calculateDV = (nit) => {
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

const ThirdPartiesDirectory = () => {
    const [thirdParties, setThirdParties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingModal, setEditingModal] = useState(null);
    const [saving, setSaving] = useState(false);

    // Formulario actual
    const [formData, setFormData] = useState({
        document_type: 'CC', document_number: '', verification_digit: '',
        business_name: '', first_name: '', last_name: '',
        tax_regime: 'responsable_iva', liability_code: '',
        email: '', phone: '', address: '', city: '',
        is_client: true, is_supplier: false, is_employee: false
    });

    useEffect(() => {
        fetchThirdParties();
    }, []);

    const fetchThirdParties = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('third_parties')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setThirdParties(data || []);
        } catch (error) {
            console.error(error);
            sileo.error({ title: 'Error', description: 'No se pudieron cargar los Terceros.' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (tp = null) => {
        if (tp) {
            setEditingModal(tp.id);
            setFormData(tp);
        } else {
            setEditingModal(null);
            setFormData({
                document_type: 'CC', document_number: '', verification_digit: '',
                business_name: '', first_name: '', last_name: '',
                tax_regime: 'responsable_iva', liability_code: '',
                email: '', phone: '', address: '', city: '',
                is_client: true, is_supplier: false, is_employee: false
            });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;

        let newFormData = {
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        };

        // Si cambia el documento y es NIT, auto-calcular DV
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
            // Si no es persona jurídica, vaciar razón social
            if (formData.document_type !== 'NIT') {
                payload.business_name = '';
            } else {
                payload.first_name = '';
                payload.last_name = '';
            }

            if (editingModal) {
                const { error } = await supabase.from('third_parties').update(payload).eq('id', editingModal);
                if (error) throw error;
                sileo.success({ title: 'Actualizado', description: 'Tercero actualizado exitosamente.' });
            } else {
                const { error } = await supabase.from('third_parties').insert([payload]);
                if (error) throw error;
                sileo.success({ title: 'Creado', description: 'Tercero registrado en la base de datos.' });
            }

            setIsModalOpen(false);
            fetchThirdParties();
        } catch (error) {
            console.error(error);
            const msg = error.code === '23505' ? 'Ya existe un tercero con este documento.' : error.message;
            sileo.error({ title: 'Error al guardar', description: msg });
        } finally {
            setSaving(false);
        }
    };

    const getDisplayName = (tp) => {
        return tp.business_name || `${tp.first_name || ''} ${tp.last_name || ''}`.trim() || 'Sin Nombre';
    };

    const filteredList = thirdParties.filter(tp =>
        getDisplayName(tp).toLowerCase().includes(searchTerm.toLowerCase()) ||
        tp.document_number.includes(searchTerm)
    );

    return (
        <div className="flex-1 flex flex-col h-full fade-in">
            {/* Cabecera */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-black text-secondary flex items-center gap-3">
                        <Users className="text-blue-500" />
                        Directorio de Terceros (DIAN)
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        Base de datos central unificada para Clientes, Proveedores y Empleados, requerida para facturación electrónica y medios magnéticos.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md active:scale-95"
                >
                    <Plus size={16} /> Nuevo Tercero
                </button>
            </div>

            {/* Buscador */}
            <div className="flex gap-4 mb-6 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por Nombre, Razón Social o NIT/CC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
            </div>

            {/* Tabla / Lista */}
            <div className="flex-1 overflow-y-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
                {loading ? (
                    <div className="flex justify-center items-center h-48 text-gray-300">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="text-center py-20">
                        <Hexagon size={48} className="text-gray-200 mx-auto mb-4" />
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No hay terceros registrados</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Identificación</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Nombre / Razón Social</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Rol</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400">Contacto</th>
                                <th className="p-4 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredList.map(tp => (
                                <tr key={tp.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">{tp.document_type}</span>
                                            <span className="text-sm font-bold text-secondary font-mono">
                                                {tp.document_number}{tp.verification_digit ? `-${tp.verification_digit}` : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {tp.document_type === 'NIT' ? <Building2 size={16} className="text-gray-400" /> : <User size={16} className="text-gray-400" />}
                                            <span className="text-sm font-black text-secondary">{getDisplayName(tp)}</span>
                                        </div>
                                        {tp.tax_regime && (
                                            <span className="text-[10px] text-gray-400 font-bold uppercase block mt-1">
                                                {TAX_REGIMES.find(r => r.id === tp.tax_regime)?.label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 flex gap-1 flex-wrap">
                                        {tp.is_client && <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Cliente</span>}
                                        {tp.is_supplier && <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Proveedor</span>}
                                        {tp.is_employee && <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Empleado</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="text-[11px] text-gray-500 font-medium">
                                            {tp.email && <div className="flex items-center gap-1"><Mail size={10} /> {tp.email}</div>}
                                            {tp.phone && <div className="flex items-center gap-1 mt-0.5"><Phone size={10} /> {tp.phone}</div>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleOpenModal(tp)}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                        >
                                            <Edit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Creación / Edición */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-secondary/80 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-secondary flex items-center gap-2">
                                <Shield className="text-blue-500" size={20} />
                                {editingModal ? 'Editar Tercero' : 'Registrar Nuevo Tercero'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-secondary rounded-full p-1 transition-colors">
                                <Plus className="rotate-45" size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                            <form id="thirdPartyForm" onSubmit={handleSave} className="space-y-6">

                                {/* Roles del Tercero */}
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
                                    {/* IDENTIFICACIÓN */}
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

                                    {/* DATOS GENERALES */}
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

                                    {/* DATOS TRIBUTARIOS */}
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

                                    {/* CONTACTO */}
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
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-secondary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="thirdPartyForm"
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-500 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                Guardar Tercero
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThirdPartiesDirectory;
