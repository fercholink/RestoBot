import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import factusService from '../../services/factusService';
import { Save, CheckCircle, AlertCircle, Eye, EyeOff, Plug, Zap, RefreshCw, Clock } from 'lucide-react';
import { sileo } from 'sileo';

const FactusConfig = () => {
    const [credentials, setCredentials] = useState({
        client_id: '',
        client_secret: '',
        email: '',
        password: '',
        environment: 'sandbox' // 'sandbox' | 'production'
    });
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('idle'); // idle | success | error
    const [showSecrets, setShowSecrets] = useState(false);
    const [tokenStatus, setTokenStatus] = useState(null);

    useEffect(() => {
        loadCredentials();
        refreshTokenStatus();
    }, []);

    const refreshTokenStatus = () => {
        setTokenStatus(factusService.getTokenStatus());
    };

    const loadCredentials = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'factus_credentials')
                .single();

            if (data?.value) {
                setCredentials({ environment: 'sandbox', ...data.value });
                setConnectionStatus('saved');
            }
        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    };

    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
        setConnectionStatus('idle');
    };

    const handleEnvironmentToggle = (env) => {
        setCredentials({ ...credentials, environment: env });
        setConnectionStatus('idle');
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setConnectionStatus('testing');
        try {
            const tokenData = await factusService.login(credentials);
            if (tokenData?.access_token) {
                setConnectionStatus('success');
                refreshTokenStatus();
                sileo.success({ title: "Conexión Exitosa ✓", description: `Conectado a ${credentials.environment === 'sandbox' ? 'Sandbox' : 'Producción'}.` });
            }
        } catch (error) {
            setConnectionStatus('error');
            sileo.error({ title: "Falló la conexión", description: error.message });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await factusService.saveCredentials(credentials);
            setConnectionStatus('saved');
            sileo.success({ title: "Guardado", description: "Credenciales guardadas correctamente." });
        } catch (error) {
            sileo.error({ title: "Error al guardar", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const isSandbox = credentials.environment === 'sandbox';

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">

            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-secondary/10 rounded-2xl text-secondary">
                            <Plug size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-secondary">Configuración API Factus</h3>
                            <p className="text-xs text-gray-400 font-medium">Conexión con proveedor tecnológico DIAN</p>
                        </div>
                    </div>
                    {/* Status Badge */}
                    <div className="flex flex-col items-end gap-1">
                        {connectionStatus === 'success' || connectionStatus === 'saved' ? (
                            <span className="flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                <CheckCircle size={12} /> Conectado
                            </span>
                        ) : connectionStatus === 'error' ? (
                            <span className="flex items-center gap-1 text-xs font-black text-red-500 bg-red-50 px-3 py-1 rounded-full">
                                <AlertCircle size={12} /> Error
                            </span>
                        ) : null}

                        {tokenStatus?.active && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Clock size={10} /> Token: {tokenStatus.expiresInMinutes}min
                            </span>
                        )}
                    </div>
                </div>

                {/* Environment Selector */}
                <div className="mb-6">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-2">Entorno</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl w-fit gap-1">
                        <button
                            onClick={() => handleEnvironmentToggle('sandbox')}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${isSandbox
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            🧪 Sandbox
                        </button>
                        <button
                            onClick={() => handleEnvironmentToggle('production')}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${!isSandbox
                                ? 'bg-emerald-500 text-white shadow-md'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            🚀 Producción
                        </button>
                    </div>
                    {isSandbox && (
                        <p className="text-[10px] text-orange-500 font-bold mt-2 flex items-center gap-1">
                            <AlertCircle size={10} /> Las facturas en Sandbox NO son reales ni válidas ante la DIAN.
                        </p>
                    )}
                    {!isSandbox && (
                        <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                            <CheckCircle size={10} /> Las facturas en Producción son válidas ante la DIAN.
                        </p>
                    )}
                </div>

                {/* Fields */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Correo Electrónico</label>
                        <input
                            type="email"
                            name="email"
                            value={credentials.email}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-sm font-bold text-secondary"
                            placeholder="usuario@empresa.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Contraseña</label>
                        <div className="relative">
                            <input
                                type={showSecrets ? "text" : "password"}
                                name="password"
                                value={credentials.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-sm font-bold text-secondary pr-10"
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Client ID</label>
                            <input
                                type="text"
                                name="client_id"
                                value={credentials.client_id}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-xs font-mono text-secondary"
                                placeholder="UUID del cliente"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest pl-1">Client Secret</label>
                            <input
                                type={showSecrets ? "text" : "password"}
                                name="client_secret"
                                value={credentials.client_secret}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 text-xs font-mono text-secondary"
                                placeholder="Secret Key"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={handleTestConnection}
                        disabled={testing || !credentials.email || !credentials.password}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${testing
                            ? 'bg-gray-100 text-gray-400 cursor-wait'
                            : 'bg-gray-100 text-secondary hover:bg-gray-200 active:scale-95'
                            }`}
                    >
                        <Zap size={14} />
                        {testing ? 'Probando...' : 'Probar Conexión'}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all ml-auto ${loading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-secondary text-white hover:brightness-110 active:scale-95'
                            }`}
                    >
                        <Save size={14} />
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700">
                <p className="font-black mb-1 flex items-center gap-1"><RefreshCw size={12} /> ¿Cómo funciona?</p>
                <ul className="space-y-1 list-disc pl-4 font-medium opacity-80">
                    <li>El token OAuth se reutiliza automáticamente mientras sea válido (hasta 1 hora).</li>
                    <li>Al vencer, se refresca automáticamente sin necesidad de volver a ingresar credenciales.</li>
                    <li>Las credenciales se guardan de forma segura en la base de datos de tu cuenta.</li>
                    <li>Cambia de entorno cuando estés listo para emitir facturas reales a la DIAN.</li>
                </ul>
            </div>
        </div>
    );
};

export default FactusConfig;
