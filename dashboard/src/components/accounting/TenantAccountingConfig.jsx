import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Save, Building2, Briefcase, FileText, CheckCircle, Store, Building, Home, Activity, RefreshCw, AlertCircle, Receipt
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
                    city: '',
                    rnt_number: '',
                    invima_registration: '',
                    default_tax_type: 'impoconsumo_8'
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
                    rnt_number: config.rnt_number || null,
                    invima_registration: config.invima_registration || null,
                    default_tax_type: config.default_tax_type || 'impoconsumo_8',
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
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-secondary flex items-center gap-3">
                        <Building2 className="text-emerald-500" />
                        Estructura Contable (Core Colombiano)
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-2">
                        Clasificación empresarial requerida por la DIAN (Decreto 957) y NIIF para la generación de reportes y plantillas contables.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={async () => {
                        const loadingToast = sileo.loading({ title: 'Cargando...', description: 'Instalando PUC en la base de datos...' });
                        try {
                            const accounts = [
                                { code: '1', name: 'ACTIVO', nature: 'debit', is_movement: false },
                                { code: '11', name: 'DISPONIBLE', nature: 'debit', is_movement: false },
                                { code: '1105', name: 'CAJA', nature: 'debit', is_movement: false },
                                { code: '110505', name: 'CAJA GENERAL', nature: 'debit', is_movement: true },
                                { code: '110510', name: 'CAJAS MENORES', nature: 'debit', is_movement: true },
                                { code: '1110', name: 'BANCOS', nature: 'debit', is_movement: false },
                                { code: '111005', name: 'MONEDA NACIONAL', nature: 'debit', is_movement: true },
                                { code: '1120', name: 'CUENTAS DE AHORRO', nature: 'debit', is_movement: false },
                                { code: '112005', name: 'BANCOS Y CORPORACIONES', nature: 'debit', is_movement: true },

                                { code: '13', name: 'DEUDORES', nature: 'debit', is_movement: false },
                                { code: '1305', name: 'CLIENTES', nature: 'debit', is_movement: false },
                                { code: '130505', name: 'NACIONALES', nature: 'debit', is_movement: true },
                                { code: '1355', name: 'ANTICIPO DE IMPUESTOS', nature: 'debit', is_movement: false },
                                { code: '135515', name: 'RETENCIÓN EN LA FUENTE', nature: 'debit', is_movement: true },
                                { code: '135517', name: 'IMPUESTO A LAS VENTAS RETENIDO', nature: 'debit', is_movement: true },
                                { code: '135518', name: 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', nature: 'debit', is_movement: true },

                                { code: '14', name: 'INVENTARIOS', nature: 'debit', is_movement: false },
                                { code: '1435', name: 'MERCANCÍAS NO FABRICADAS POR LA EMPRESA', nature: 'debit', is_movement: true },
                                { code: '1445', name: 'ENVASES Y EMPAQUES', nature: 'debit', is_movement: true },

                                { code: '15', name: 'PROPIEDAD PLANTA Y EQUIPO', nature: 'debit', is_movement: false },
                                { code: '1524', name: 'EQUIPO DE OFICINA', nature: 'debit', is_movement: true },
                                { code: '1528', name: 'EQUIPO DE COMPUTACIÓN Y COMUNICACIÓN', nature: 'debit', is_movement: true },
                                { code: '1540', name: 'FLOTA Y EQUIPO DE TRANSPORTE', nature: 'debit', is_movement: true },

                                { code: '2', name: 'PASIVO', nature: 'credit', is_movement: false },
                                { code: '21', name: 'OBLIGACIONES FINANCIERAS', nature: 'credit', is_movement: false },
                                { code: '2105', name: 'BANCOS NACIONALES', nature: 'credit', is_movement: true },

                                { code: '22', name: 'PROVEEDORES', nature: 'credit', is_movement: false },
                                { code: '2205', name: 'NACIONALES', nature: 'credit', is_movement: true },

                                { code: '23', name: 'CUENTAS POR PAGAR', nature: 'credit', is_movement: false },
                                { code: '2335', name: 'COSTOS Y GASTOS POR PAGAR', nature: 'credit', is_movement: true },
                                { code: '2365', name: 'RETENCIÓN EN LA FUENTE', nature: 'credit', is_movement: false },
                                { code: '236505', name: 'SALARIOS Y PAGOS LABORALES', nature: 'credit', is_movement: true },
                                { code: '236515', name: 'HONORARIOS', nature: 'credit', is_movement: true },
                                { code: '236525', name: 'SERVICIOS', nature: 'credit', is_movement: true },
                                { code: '236540', name: 'COMPRAS', nature: 'credit', is_movement: true },
                                { code: '2367', name: 'IMPUESTO A LAS VENTAS RETENIDO', nature: 'credit', is_movement: true },
                                { code: '2368', name: 'IMPUESTO DE INDUSTRIA Y COMERCIO RETENIDO', nature: 'credit', is_movement: true },

                                { code: '24', name: 'IMPUESTOS, GRAVAMENES Y TASAS', nature: 'credit', is_movement: false },
                                { code: '2408', name: 'IMPUESTO SOBRE LAS VENTAS POR PAGAR (IVA)', nature: 'credit', is_movement: false },
                                { code: '240801', name: 'IVA GENERADO EN VENTAS', nature: 'credit', is_movement: true },
                                { code: '240802', name: 'IVA DESCONTABLE COMPRAS', nature: 'debit', is_movement: true },

                                { code: '25', name: 'OBLIGACIONES LABORALES', nature: 'credit', is_movement: false },
                                { code: '2505', name: 'SALARIOS POR PAGAR', nature: 'credit', is_movement: true },
                                { code: '2510', name: 'CESANTÍAS CONSOLIDADAS', nature: 'credit', is_movement: true },
                                { code: '2515', name: 'INTERESES SOBRE CESANTÍAS', nature: 'credit', is_movement: true },
                                { code: '2520', name: 'PRIMA DE SERVICIOS', nature: 'credit', is_movement: true },
                                { code: '2525', name: 'VACACIONES CONSOLIDADAS', nature: 'credit', is_movement: true },

                                { code: '3', name: 'PATRIMONIO', nature: 'credit', is_movement: false },
                                { code: '31', name: 'CAPITAL SOCIAL', nature: 'credit', is_movement: false },
                                { code: '3115', name: 'APORTES SOCIALES', nature: 'credit', is_movement: true },
                                { code: '36', name: 'RESULTADOS DEL EJERCICIO', nature: 'credit', is_movement: false },
                                { code: '3605', name: 'UTILIDAD DEL EJERCICIO', nature: 'credit', is_movement: true },
                                { code: '3610', name: 'PÉRDIDA DEL EJERCICIO', nature: 'debit', is_movement: true },

                                { code: '4', name: 'INGRESOS', nature: 'credit', is_movement: false },
                                { code: '41', name: 'OPERACIONALES', nature: 'credit', is_movement: false },
                                { code: '4135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', nature: 'credit', is_movement: true },
                                { code: '4140', name: 'HOTELES Y RESTAURANTES', nature: 'credit', is_movement: true },
                                { code: '4145', name: 'TRANSPORTE, ALMACENAMIENTO Y COMUNICACIONES', nature: 'credit', is_movement: true },
                                { code: '4155', name: 'ACTIVIDADES INMOBILIARIAS', nature: 'credit', is_movement: true },
                                { code: '4175', name: 'SERVICIOS SOCIALES Y DE SALUD', nature: 'credit', is_movement: true },
                                { code: '42', name: 'NO OPERACIONALES', nature: 'credit', is_movement: false },
                                { code: '4210', name: 'FINANCIEROS', nature: 'credit', is_movement: true },

                                { code: '5', name: 'GASTOS', nature: 'debit', is_movement: false },
                                { code: '51', name: 'OPERACIONALES DE ADMINISTRACIÓN', nature: 'debit', is_movement: false },
                                { code: '5105', name: 'GASTOS DE PERSONAL', nature: 'debit', is_movement: false },
                                { code: '510506', name: 'SUELDOS', nature: 'debit', is_movement: true },
                                { code: '510515', name: 'HORAS EXTRAS Y RECARGOS', nature: 'debit', is_movement: true },
                                { code: '510527', name: 'AUXILIO DE TRANSPORTE', nature: 'debit', is_movement: true },
                                { code: '5110', name: 'HONORARIOS', nature: 'debit', is_movement: true },
                                { code: '5115', name: 'IMPUESTOS', nature: 'debit', is_movement: true },
                                { code: '5120', name: 'ARRENDAMIENTOS', nature: 'debit', is_movement: true },
                                { code: '5135', name: 'SERVICIOS', nature: 'debit', is_movement: true },
                                { code: '5145', name: 'MANTENIMIENTO Y REPARACIONES', nature: 'debit', is_movement: true },
                                { code: '5150', name: 'ADECUACIÓN E INSTALACIÓN', nature: 'debit', is_movement: true },
                                { code: '5195', name: 'DIVERSOS', nature: 'debit', is_movement: true },

                                { code: '52', name: 'OPERACIONALES DE VENTAS', nature: 'debit', is_movement: false },
                                { code: '5205', name: 'GASTOS DE PERSONAL VENTAS', nature: 'debit', is_movement: true },
                                { code: '5235', name: 'SERVICIOS VENTAS', nature: 'debit', is_movement: true },

                                { code: '53', name: 'NO OPERACIONALES', nature: 'debit', is_movement: false },
                                { code: '5305', name: 'FINANCIEROS', nature: 'debit', is_movement: true },

                                { code: '6', name: 'COSTOS DE VENTAS', nature: 'debit', is_movement: false },
                                { code: '61', name: 'COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS', nature: 'debit', is_movement: false },
                                { code: '6135', name: 'COMERCIO AL POR MAYOR Y AL POR MENOR', nature: 'debit', is_movement: true },
                                { code: '6145', name: 'TRANSPORTE, ALMACENAMIENTO Y COMUNICACIONES', nature: 'debit', is_movement: true },
                                { code: '6155', name: 'ACTIVIDADES INMOBILIARIAS', nature: 'debit', is_movement: true },
                                { code: '6175', name: 'SERVICIOS DE SALUD', nature: 'debit', is_movement: true }
                            ];
                            for (let acc of accounts) {
                                await supabase.from('accounting_accounts').upsert({
                                    code: acc.code,
                                    name: acc.name,
                                    nature: acc.nature,
                                    is_movement: acc.is_movement
                                }, { onConflict: 'code' });
                            }
                            sileo.success({ title: 'Éxito', description: 'Plan Único de Cuentas instalado.' });
                        } catch (e) {
                            sileo.error({ title: 'Error', description: 'Falló instalación del PUC.' });
                        } finally {
                            loadingToast.close();
                        }
                    }}
                    className="p-3 bg-primary text-white text-xs font-bold rounded-xl shadow-md hover:scale-105 transition-transform"
                >
                    Instalar PUC Colombia (Semilla)
                </button>
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

                    {/* RNT e INVIMA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">RNT — Registro Nacional de Turismo</label>
                            <input
                                type="text"
                                value={config?.rnt_number || ''}
                                onChange={e => setConfig({ ...config, rnt_number: e.target.value })}
                                placeholder="Ej: 123456 (Obligatorio Ley 300/1996)"
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-mono font-bold outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Registro INVIMA (si aplica)</label>
                            <input
                                type="text"
                                value={config?.invima_registration || ''}
                                onChange={e => setConfig({ ...config, invima_registration: e.target.value })}
                                placeholder="Ej: RSAA-12345678 (Res 2674/2013)"
                                className="w-full bg-gray-50 border border-gray-200 text-secondary text-sm rounded-xl focus:ring-rose-500 focus:border-rose-500 block p-3 font-mono font-bold outline-none transition-all"
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
                                onClick={() => setConfig({
                                    ...config,
                                    primary_industry: ind.id,
                                    default_tax_type: ind.id === 'restaurant' ? 'impoconsumo_8' : 'iva_19'
                                })}
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

                {/* 4. IMPUESTO POR DEFECTO EN FACTURACIÓN */}
                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 rounded-l-[2rem]"></div>
                    <h3 className="text-base font-black text-secondary mb-1 uppercase tracking-widest flex items-center gap-2">
                        <Receipt size={18} className="text-amber-500" />
                        Impuesto por Defecto en Facturación DIAN
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold mb-4">
                        Se aplica a los ítems que no tengan impuesto explícito. Los productos de alojamiento siempre usan IVA 19%.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {
                                id: 'impoconsumo_8',
                                label: 'Impoconsumo 8% (INC)',
                                desc: 'Restaurantes, Bares, Cafés — Ley 1607/2012',
                                badge: 'Recomendado restaurantes'
                            },
                            {
                                id: 'iva_19',
                                label: 'IVA 19%',
                                desc: 'Hoteles, Servicios Generales, Inmobiliario',
                                badge: 'Recomendado hoteles'
                            }
                        ].map(tax => (
                            <div
                                key={tax.id}
                                onClick={() => setConfig({ ...config, default_tax_type: tax.id })}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${config?.default_tax_type === tax.id
                                    ? 'border-amber-500 bg-amber-50/50'
                                    : 'border-gray-100 hover:border-gray-200'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className={`text-sm font-black ${config?.default_tax_type === tax.id ? 'text-amber-700' : 'text-gray-600'}`}>
                                        {tax.label}
                                    </h4>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${config?.default_tax_type === tax.id ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                                        {tax.badge}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 font-medium">{tax.desc}</p>
                            </div>
                        ))}
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
