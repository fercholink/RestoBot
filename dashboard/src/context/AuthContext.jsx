import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const handleUserSession = async (session) => {
        const supabaseUser = session?.user ?? null;
        if (supabaseUser) {
            // AUTO-FIX: Si el usuario no tiene rol (creado manualmente), asignarle 'cajero'
            let role = supabaseUser.user_metadata?.role;
            if (!role) {
                console.log("Auth: Usuario sin rol detectado. Asignando 'cajero' automáticamente...");
                const { data, error } = await supabase.auth.updateUser({
                    data: { role: 'cajero', name: 'Cajero', branch: 'Sede Principal' }
                });
                if (!error && data.user) {
                    // Update local var with new metadata
                    role = 'cajero';
                    supabaseUser.user_metadata = { ...supabaseUser.user_metadata, role: 'cajero', name: 'Cajero' };
                }
            }

            // Calcular nombre real para mostrar
            const metadataName = supabaseUser.user_metadata?.name;
            const emailName = supabaseUser.email?.split('@')[0];
            // Si el nombre es genérico o vacío, usar el del email
            const finalName = (metadataName && metadataName !== 'Usuario Nuevo' && metadataName !== 'Colaborador')
                ? metadataName
                : (emailName || 'Cajero');

            // Flatten metadata for compatibility with existing app
            setUser({
                ...supabaseUser,
                ...supabaseUser.user_metadata,
                name: finalName, // Nombre sanitizado
                role: role || 'cajero' // Fallback visual
            });
        } else {
            setUser(null);
        }
    };

    useEffect(() => {
        // 1. Initial Session Check
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            handleUserSession(session);
            setLoading(false);
        };
        getSession();

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleUserSession(session);
            setLoading(false);
        });

        // Cleanup subscription
        return () => subscription.unsubscribe();
    }, []);

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error("AuthContext: Login error", error);
            return { success: false, message: error.message };
        }
    };

    const signUp = async (email, password, metadata = {}) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata, // Save user name, role, branch, etc.
                }
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error("AuthContext: Register error", error);
            return { success: false, message: error.message };
        }
    };

    const logout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error("AuthContext: Logout error", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, signUp, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
