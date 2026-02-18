import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import factusService from '../../services/factusService';
import { Save, CheckCircle, AlertCircle, Eye, EyeOff, Plug } from 'lucide-react';
import { sileo } from 'sileo';

const FactusConfig = () => {
    const [credentials, setCredentials] = useState({
        client_id: '',
        client_secret: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, success, error
    const [showSecrets, setShowSecrets] = useState(false);

    useEffect(() => {
        loadCredentials();
    }, []);

    const loadCredentials = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'factus_credentials')
                .single();

            if (data?.value) {
                setCredentials(data.value);
                setStatus('saved'); // Indicate we have saved creds
            }
        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    };

    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleTestAndSave = async () => {
        setLoading(true);
        setStatus('testing');
        try {
            // 1. Test Connection (Login)
            const tokenData = await factusService.login(credentials);
            if (tokenData && tokenData.access_token) {

                // 2. Save if successful
                const { error } = await supabase
                    .from('app_settings')
                    .upsert({
                        key: 'factus_credentials',
                        value: credentials,
                        description: 'Credenciales API Factus (Sandbox/Prod)'
                    }, { onConflict: 'key' });

                if (error) throw error;

                setStatus('success');
                sileo.success({ title: "Conexión Exitosa", description: "Credenciales válidas y guardadas." });
            }
        } catch (error) {
            console.error('Test failed:', error);
            setStatus('error');
            sileo.error({ title: "Error de Conexión", description: error.message || "Verifique sus credenciales" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                    <Plug size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-secondary">Configuración API Factus</h3>
                    <p className="text-xs text-accent font-medium">Conexión con el proveedor tecnológico (Sandbox / Prod)</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Email / Username */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-accent tracking-widest pl-2">Correo Electrónico (Usuario)</label>
                    <input
                        type="email"
                        name="email"
                        value={credentials.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-sm font-bold text-secondary"
                        placeholder="ej. sandbox@factus.com.co"
                    />
                </div>

                {/* Password */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-accent tracking-widest pl-2">Contraseña</label>
                    <div className="relative">
                        <input
                            type={showSecrets ? "text" : "password"}
                            name="password"
                            value={credentials.password}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-sm font-bold text-secondary"
                            placeholder="••••••••"
                        />
                        <button
                            onClick={() => setShowSecrets(!showSecrets)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-secondary"
                        >
                            {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {/* Client ID */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-accent tracking-widest pl-2">Client ID</label>
                    <input
                        type="text"
                        name="client_id"
                        value={credentials.client_id}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-xs font-mono text-secondary"
                        placeholder="UUID"
                    />
                </div>

                {/* Client Secret */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-accent tracking-widest pl-2">Client Secret</label>
                    <input
                        type={showSecrets ? "text" : "password"}
                        name="client_secret"
                        value={credentials.client_secret}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-xs font-mono text-secondary"
                        placeholder="Secret Key"
                    />
                </div>

                <div className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {status === 'success' && <span className="text-success text-xs font-black flex items-center gap-1"><CheckCircle size={14} /> Conectado</span>}
                        {status === 'error' && <span className="text-red-500 text-xs font-black flex items-center gap-1"><AlertCircle size={14} /> Error</span>}
                    </div>
                    <button
                        onClick={handleTestAndSave}
                        disabled={loading}
                        className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all ${loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-secondary text-white hover:brightness-110 active:scale-95'
                            }`}
                    >
                        {loading ? 'Validando...' : (
                            <>
                                <Save size={16} /> Guardar y Conectar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FactusConfig;
