import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, Plus, Search, Filter, Edit, Trash2, Shield,
    User, Building2, Phone, Mail, MapPin, RefreshCw, Hexagon
} from 'lucide-react';
import { sileo } from 'sileo';

import ThirdPartyModal, { TAX_REGIMES } from './ThirdPartyModal';

const ThirdPartiesDirectory = () => {
    const [thirdParties, setThirdParties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingModal, setEditingModal] = useState(null);

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
            console.error('Error fetching third parties:', error);
            sileo.error({ title: 'Error', description: 'No se pudieron cargar los terceros.' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (tp = null) => {
        setEditingModal(tp);
        setIsModalOpen(true);
    };

    const handleSaved = () => {
        setIsModalOpen(false);
        fetchThirdParties();
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
            <ThirdPartyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                thirdPartyToEdit={editingModal}
                onSaved={handleSaved}
            />
        </div>
    );
};

export default ThirdPartiesDirectory;
