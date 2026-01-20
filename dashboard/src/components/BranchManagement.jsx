import React, { useState } from 'react';
import { Building2, MapPin, Phone, Users, Plus, Edit2, Trash2, Power, CheckCircle2, XCircle, Search, Save, X } from 'lucide-react';

const MOCK_BRANCHES = [
    { id: 1, name: 'Sede Norte', address: 'Calle 100 # 15-20', phone: '+57 300 111 2233', employees: 8, active: true },
    { id: 2, name: 'Sede Sur', address: 'Carrera 45 # 2-30', phone: '+57 311 444 5566', employees: 5, active: true },
    { id: 3, name: 'Sede Centro', address: 'Avenida 19 # 4-10', phone: '+57 320 777 8899', employees: 12, active: false },
];

const BranchManagement = () => {
    const [branches, setBranches] = useState(MOCK_BRANCHES);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.address.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleStatus = (id) => {
        setBranches(prev => prev.map(b =>
            b.id === id ? { ...b, active: !b.active } : b
        ));
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar sede..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => { setEditingBranch(null); setShowModal(true); }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-premium hover:brightness-110 active:scale-95 transition-all"
                >
                    <Plus size={20} />
                    Nueva Sucursal
                </button>
            </div>

            {/* Grid de Sedes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBranches.map((branch) => (
                    <div
                        key={branch.id}
                        className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-premium transition-all duration-300 ${!branch.active ? 'opacity-70 grayscale-[0.3]' : ''}`}
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className={`p-3 rounded-2xl ${branch.active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                                    <Building2 size={24} />
                                </div>
                                <button
                                    onClick={() => toggleStatus(branch.id)}
                                    className={`p-2 rounded-xl transition-all ${branch.active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                                    title={branch.active ? 'Desactivar Sede' : 'Activar Sede'}
                                >
                                    <Power size={18} />
                                </button>
                            </div>

                            <div>
                                <h3 className="text-xl font-black text-secondary tracking-tight">{branch.name}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-medium">
                                    <MapPin size={12} />
                                    {branch.address}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Personal</p>
                                    <div className="flex items-center gap-2 font-black text-secondary">
                                        <Users size={14} className="text-primary" />
                                        {branch.employees} <span className="text-[10px] font-bold text-gray-400">pax</span>
                                    </div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</p>
                                    <div className={`flex items-center justify-end gap-1 font-black ${branch.active ? 'text-success' : 'text-red-500'}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {branch.active ? 'ACTIVA' : 'CERRADA'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 text-xs font-bold text-gray-500">
                                <Phone size={12} className="text-primary/60" />
                                {branch.phone}
                            </div>

                            <div className="pt-4 flex gap-2">
                                <button
                                    onClick={() => { setEditingBranch(branch); setShowModal(true); }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-secondary hover:bg-gray-100 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-gray-100"
                                >
                                    <Edit2 size={14} />
                                    Editar
                                </button>
                                <button className="p-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Sede */}
            {showModal && (
                <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in fade-in duration-200">
                        <div className="bg-secondary p-8 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-2xl font-black tracking-tight">{editingBranch ? 'Editar Sede' : 'Nueva Sede'}</h3>
                                <p className="text-white/60 text-xs font-medium mt-1">Configuración logística y contacto</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="relative z-10 p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                            <Building2 className="absolute -right-8 -bottom-8 text-white/5 w-40 h-40" />
                        </div>
                        <form className="p-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Nombre de la Sucursal</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none font-bold"
                                    defaultValue={editingBranch?.name}
                                    placeholder="Ej. Sede Norte 2"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Dirección Física</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm font-medium"
                                        defaultValue={editingBranch?.address}
                                        placeholder="Calle 123..."
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Teléfono de Contacto</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input
                                        type="text"
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm font-medium"
                                        defaultValue={editingBranch?.phone}
                                        placeholder="+57..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button className="flex-1 bg-primary text-white py-4 rounded-2xl font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Save size={18} />
                                    Guardar Sede
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 bg-gray-100 text-secondary rounded-2xl font-black hover:bg-gray-200 transition-all text-sm uppercase tracking-widest">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchManagement;
