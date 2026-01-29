import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutPanelLeft, Mail, Lock, LogIn, UserPlus, User } from 'lucide-react';

const LoginPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For registration
    const [role, setRole] = useState('cajero'); // Default role for new users
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const { login, signUp } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (isLogin) {
            const result = await login(email, password);
            if (!result.success) {
                setError(result.message);
            }
        } else {
            // Registration Mode
            const result = await signUp(email, password, {
                name: name || 'Colaborador',
                role: role, // Use selected role
                branch: 'Sede Principal'
            });

            if (!result.success) {
                setError(result.message);
            } else {
                setMessage("¡Registro exitoso! Por favor verifica tu correo (si está habilitado) o inicia sesión.");
                setIsLogin(true); // Switch back to login
            }
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
                    <p className="text-accent font-bold text-sm uppercase tracking-widest mt-2">{isLogin ? 'Acceso al Panel' : 'Crear Cuenta Nueva'}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {!isLogin && (
                        <>
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Nombre Completo</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
                                    <input
                                        type="text"
                                        required={!isLogin}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 pl-12 text-sm font-bold focus:border-primary focus:bg-white transition-all outline-none shadow-inner"
                                        placeholder="Tu Nombre"
                                    />
                                </div>
                            </div>

                            {/* Selector de Rol */}
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300 delay-75">
                                <label className="text-[10px] font-black text-secondary/60 uppercase tracking-widest px-1">Rol de Usuario</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRole('cajero')}
                                        className={`p-3 rounded-xl border-2 font-bold text-xs transition-all ${role === 'cajero' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                    >
                                        CAJERO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('admin')}
                                        className={`p-3 rounded-xl border-2 font-bold text-xs transition-all ${role === 'admin' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                    >
                                        ADMINISTRADOR
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

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
                        <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl text-center border border-red-100 animate-shake whitespace-pre-line">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-50 text-green-600 text-xs font-bold p-3 rounded-xl text-center border border-green-100 animate-pulse">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-secondary text-white font-black py-4 rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                        {isLogin ? 'ENTRAR AL SISTEMA' : 'REGISTRARME AHORA'}
                    </button>

                    <div className="pt-6 border-t border-gray-100 text-center space-y-4">
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-xs font-bold text-primary hover:text-secondary transition-colors"
                        >
                            {isLogin ? '¿No tienes cuenta? Registrate aquí' : '¿Ya tienes cuenta? Inicia Sesión'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("¿Desea limpiar todos los datos locales (Cajas, Turnos, Navegación)? Esto cerrará su sesión.")) {
                                    localStorage.clear();
                                    window.location.reload();
                                }
                            }}
                            className="block w-full text-[10px] font-black text-accent hover:text-primary transition-colors uppercase tracking-widest opacity-60 hover:opacity-100"
                        >
                            🔄 Resetear Datos Locales
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
