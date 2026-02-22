import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Save, Building2, Briefcase, FileText, CheckCircle, Store, Building, Home, Activity, RefreshCw, AlertCircle
} from 'lucide-react';
import { sileo } from 'sileo';

const TenantAccountingConfig = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [activeModules, setActiveModules] = useState([]);

    const DOC_TYPES = [
        { id: 'NIT', label: 'NIT' },
        { id: 'CC', label: 'Cédula de Ciudadanía' },
        { id: 'CE', label: 'Cédula de Extranjería' },
        { id: 'TI', label: 'Tarjeta de Identidad' },
    ];

    const MACRO_SECTORS = ['Servicios', 'Comercio', 'Manufactura'];
    const SIZES = ['Microempresa', 'Pequeña', 'Mediana', 'Grande'];
    const LEGAL_FORMS = ['Persona Natural', 'SAS', 'SA', 'Limitada', 'En Comandita'];
    const NIIF_GROUPS = [1, 2, 3];
    const TAX_REGIMES = [
        { id: 'responsable_iva', label: 'Responsable de IVA (Común)' },
        { id: 'no_responsable', label: 'No Responsable de IVA (Simplificado)' },
        { id: 'regimen_simple', label: 'Régimen Simple de Tributación (RST)' }
    ];

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            // 1. Obtener usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No estás autenticado");

            // 2. Obtener la organización del usuario desde el perfil (o la primera organización si es admin general)
            // Por simplicidad en este paso, buscaremos la primera configuración existente, 
            // o crearemos una mock si el sistema aún no tiene organizaciones migadas 100%.

            // Intentar traer el profile para sacar organization_id
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();

            let orgId = profile?.organization_id;

            if (!orgId) {
                // Si aún no hay org, intentamos buscar si este usuario es dueño de alguna
                const { data: orgs } = await supabase.from('organizations').select('id').eq('owner_id', user.id);
                if (orgs && orgs.length > 0) {
                    orgId = orgs[0].id;
                }
            }

            if (!orgId) {
                // Si definitivamente no hay organización, intentamos auto-crear una por defecto.
                // Esto facilita el desarrollo y evita bloquear al usuario.
                const { data: newOrg, error: newOrgError } = await supabase
                    .from('organizations')
                    .insert([{ name: 'Mi Empresa (Default)', owner_id: user.id }])
                    .select()
                    .single();

                if (newOrgError) {
                    setErrorMsg("Aún no tienes una Organización asignada y falló la auto-creación. Por favor, asegúrate de haber ejecutado 'migration_saas_init.sql' en tu panel de Supabase SQL. Detalle: " + newOrgError.message);
                    setLoading(false);
                    return;
                }

                orgId = newOrg.id;

                // Actualizamos el perfil del usuario para asociarlo a esta nueva organización
                await supabase.from('profiles').update({ organization_id: orgId }).eq('id', user.id);
            }

            // 3. Buscar configuración del Tenant
            let { data: tenantConfig, error: configError } = await supabase
                .from('tenant_accounting_config')
                .select('*')
                .eq('organization_id', orgId)
                .maybeSingle();

            if (!tenantConfig) {
                // Si no existe, la creamos (Onboarding silencioso)
                const newConfig = {
                    organization_id: orgId,
                    primary_industry: 'restaurant',
                    macro_sector: 'Servicios',
                    size_classification: 'Microempresa',
                    legal_form: 'SAS',
                    niif_group: 3,
                    tax_regime: 'responsable_iva',
                    business_name: profile?.organizations?.name || 'Nombre Empresa',
                    document_type: 'NIT',
                    document_number: '',
                    verification_digit: '',
                    email: profile?.organizations?.contact_email || '',
                    phone: '',
                    address: '',
                    city: ''
                };
                const { data: inserted, error: insertError } = await supabase
                    .from('tenant_accounting_config')
                    .insert([newConfig])
                    .select()
                    .single();

                if (insertError) throw insertError;
                tenantConfig = inserted;
            }

            setConfig(tenantConfig);

            // 4. Buscar módulos activos
            const { data: modulesData } = await supabase
                .from('active_modules')
                .select('*')
                .eq('organization_id', orgId);

            setActiveModules(modulesData || []);

        } catch (error) {
            console.error(error);
            setErrorMsg("Error cargando la configuración: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('tenant_accounting_config')
                .update({
                    primary_industry: config.primary_industry,
                    macro_sector: config.macro_sector,
                    size_classification: config.size_classification,
                    legal_form: config.legal_form,
                    niif_group: config.niif_group,
                    is_great_contributor: config.is_great_contributor,
                    is_self_retaining: config.is_self_retaining,
                    tax_regime: config.tax_regime,
                    business_name: config.business_name,
                    document_type: config.document_type,
                    document_number: config.document_number,
                    verification_digit: config.verification_digit,
                    email: config.email,
                    phone: config.phone,
                    address: config.address,
                    city: config.city,
                    updated_at: new Date().toISOString()
                })
                .eq('id', config.id);

            if (error) throw error;
            sileo.success({ title: 'Guardado', description: 'Estructura empresarial actualizada correctamente.' });
        } catch (error) {
            console.error(error);
            sileo.error({ title: 'Error', description: 'No se pudo guardar la configuración.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-gray-400">
                <RefreshCw size={32} className="animate-spin text-secondary" />
                <p className="text-sm font-black uppercase tracking-widest">Cargando perfil corporativo...</p>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="p-8 text-center bg-rose-50 rounded-3xl border border-rose-100 mt-8">
                <AlertCircle size={48} className="text-rose-400 mx-auto mb-4" />
                <h3 className="text-xl font-black text-rose-600 mb-2">Configuración Incompleta</h3>
                <p className="text-sm font-medium text-rose-500">{errorMsg}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 fade-in">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-secondary flex items-center gap-3">
                    <Building2 className="text-emerald-500" />
                    Estructura Contable (Core Colombiano)
                </h2>
                <p className="text-sm text-gray-500 font-medium mt-2">
                    Clasificación empresarial requerida por la DIAN (Decreto 957) y NIIF para la generación de reportes y plantillas contables.
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* 0. PERFIL EMPRESARIAL BÁSICO (DIAN) */}
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-rose-500 rounded-l-[2rem]"></div>
                    <h3 className="text-base font-black text-secondary mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Briefcase size={18} className="text-rose-500" />
                        Perfil Empresarial (Obligatorio FE)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="lg:col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Razón Social / Nombre Comercial</label>
                            <input
                                required
                                type="text"
                                value={config?.business_name || ''}
                                onChange={e => setConfig({ ...config, business_name: e.target.value })}
                                placeholder="NOMBRE DE LA EMPRESA SAS"
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-bold outline-none uppercase transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo Doc.</label>
                            <select
                                value={config?.document_type || 'NIT'}
                                onChange={e => setConfig({ ...config, document_type: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-medium outline-none transition-all"
                            >
                                {DOC_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">NIT / CC</label>
                                <input
                                    required
                                    type="text"
                                    value={config?.document_number || ''}
                                    onChange={e => setConfig({ ...config, document_number: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-mono font-bold outline-none transition-all"
                                />
                            </div>
                            {config?.document_type === 'NIT' && (
                                <div className="w-16">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">DV</label>
                                    <input
                                        type="text"
                                        maxLength="1"
                                        value={config?.verification_digit || ''}
                                        onChange={e => setConfig({ ...config, verification_digit: e.target.value.replace(/\D/g, '') })}
                                        className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 text-center font-mono font-bold outline-none transition-all"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Correo Facturación</label>
                            <input
                                required
                                type="email"
                                value={config?.email || ''}
                                onChange={e => setConfig({ ...config, email: e.target.value })}
                                placeholder="fe@empresa.com"
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-medium outline-none transition-all"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Teléfono Principal</label>
                            <input
                                required
                                type="text"
                                value={config?.phone || ''}
                                onChange={e => setConfig({ ...config, phone: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-medium outline-none transition-all"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ciudad (Código DANE)</label>
                            <input
                                type="text"
                                value={config?.city || ''}
                                onChange={e => setConfig({ ...config, city: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-medium outline-none transition-all"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Dirección Sede Principal</label>
                            <input
                                required
                                type="text"
                                value={config?.address || ''}
                                onChange={e => setConfig({ ...config, address: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-medium outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* 1. MÓDULO PRINCIPAL */}
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 rounded-l-[2rem]"></div>
                    <h3 className="text-base font-black text-secondary mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Store size={18} className="text-blue-500" />
                        Industria Principal (Módulo Base)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { id: 'restaurant', name: 'Alimentos y Bebidas', icon: Store, desc: 'Restaurantes, Bares, Cafés' },
                            { id: 'hotel', name: 'Hotelería y Turismo', icon: Building, desc: 'Hoteles, Hostales, Glamping' },
                            { id: 'real_estate', name: 'Inmobiliario', icon: Home, desc: 'Propiedad Raíz, Arriendos' }
                        ].map(ind => (
                            <div
                                key={ind.id}
                                onClick={() => setConfig({ ...config, primary_industry: ind.id })}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${config?.primary_industry === ind.id
                                    ? 'border-blue-500 bg-blue-50/50'
                                    : 'border-gray-100 hover:border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`p-2 rounded-xl ${config?.primary_industry === ind.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <ind.icon size={18} />
                                    </div>
                                    <h4 className={`text-sm font-black ${config?.primary_industry === ind.id ? 'text-blue-700' : 'text-gray-600'}`}>
                                        {ind.name}
                                    </h4>
                                </div>
                                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{ind.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. TAMAÑO Y SECTOR (Decreto 957) */}
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-[2rem]"></div>
                    <h3 className="text-base font-black text-secondary mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={18} className="text-emerald-500" />
                        Tamaño y Sector (Decreto 957)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Macro Sector</label>
                            <select
                                value={config?.macro_sector || ''}
                                onChange={e => setConfig({ ...config, macro_sector: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-3 font-medium outline-none transition-all"
                            >
                                {MACRO_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tamaño por Ingresos (UVT)</label>
                            <select
                                value={config?.size_classification || ''}
                                onChange={e => setConfig({ ...config, size_classification: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-3 font-medium outline-none transition-all"
                            >
                                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 3. RESPONSABILIDADES FISCALES */}
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-purple-500 rounded-l-[2rem]"></div>
                    <h3 className="text-base font-black text-secondary mb-4 uppercase tracking-widest flex items-center gap-2">
                        <FileText size={18} className="text-purple-500" />
                        Taxonomía DIAN y NIIF
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Forma Jurídica</label>
                            <select
                                value={config?.legal_form || ''}
                                onChange={e => setConfig({ ...config, legal_form: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block p-3 font-medium outline-none transition-all"
                            >
                                {LEGAL_FORMS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Régimen de IVA / Tributario</label>
                            <select
                                value={config?.tax_regime || ''}
                                onChange={e => setConfig({ ...config, tax_regime: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block p-3 font-medium outline-none transition-all"
                            >
                                {TAX_REGIMES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                        {/* NIIF */}
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Grupo NIIF</label>
                            <select
                                value={config?.niif_group || 3}
                                onChange={e => setConfig({ ...config, niif_group: Number(e.target.value) })}
                                className="bg-white border border-gray-200 text-secondary text-sm rounded-xl p-2 font-medium outline-none"
                            >
                                <option value={1}>Grupo 1 (Plenas)</option>
                                <option value={2}>Grupo 2 (Pymes)</option>
                                <option value={3}>Grupo 3 (Microempresa)</option>
                            </select>
                        </div>

                        {/* Switches */}
                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                                <input
                                    type="checkbox"
                                    checked={config?.is_great_contributor || false}
                                    onChange={e => setConfig({ ...config, is_great_contributor: e.target.checked })}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <span className="text-xs font-black text-secondary tracking-tight">Gran Contribuyente</span>
                            </label>
                        </div>
                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                                <input
                                    type="checkbox"
                                    checked={config?.is_self_retaining || false}
                                    onChange={e => setConfig({ ...config, is_self_retaining: e.target.checked })}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <span className="text-xs font-black text-secondary tracking-tight">Autorretenedor (Renta)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* BOTON GUARDAR */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 bg-secondary text-white px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-secondary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                        Guardar Estructura
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TenantAccountingConfig;
