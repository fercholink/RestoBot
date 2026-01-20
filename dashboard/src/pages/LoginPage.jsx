import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutPanelLeft, Mail, Lock, LogIn } from 'lucide-react';

const LoginPage = () => {
    console.log("Rendering LoginPage");
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(email, password);
        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-premium border border-gray-100 w-full max-w-md animate-in fade-in zoom-in duration-300">
                <div className="text-center mb-8">
                    <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <LayoutPanelLeft size={32} className="text-primary" />
                    </div>
                    <h1 className="text-3xl font-black text-secondary tracking-tighter">RestoBot</h1>
                    <p className="text-accent font-bold text-sm uppercase tracking-widest mt-2">Acceso al Panel</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Correo Electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 pl-12 text-sm font-bold focus:border-primary focus:bg-white transition-all outline-none shadow-inner"
                                placeholder="ejemplo@correo.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 pl-12 text-sm font-bold focus:border-primary focus:bg-white transition-all outline-none shadow-inner"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl text-center border border-red-100 animate-shake">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-secondary text-white font-black py-4 rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        <LogIn size={20} />
                        ENTRAR AL SISTEMA
                    </button>

                    <div className="pt-6 border-t border-gray-100 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("¿Desea limpiar todos los datos locales (Cajas, Turnos, Navegación)? Esto cerrará su sesión.")) {
                                    localStorage.clear();
                                    window.location.reload();
                                }
                            }}
                            className="text-[10px] font-black text-accent hover:text-primary transition-colors uppercase tracking-widest"
                        >
                            🔄 Resetear Datos Locales (Solucionar Errores)
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
