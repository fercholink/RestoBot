import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const enrichUser = async (sessionUser) => {
        if (!sessionUser) return null;

        let profileData = {};
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', sessionUser.id)
                .single();

            if (data && !error) {
                profileData = data;
                console.log("Auth: Perfil cargado desde BD", data.role);
            } else if (error) {
                console.warn("Auth: profiles devolvió error, usando JWT claims como fallback.", error.message);
            }
        } catch (err) {
            console.warn("Auth: No se pudo cargar perfil de BD, usando metadata.", err.message);
        }

        const metadata = sessionUser.user_metadata || {};
        const appMeta = sessionUser.app_metadata || {};

        // Fallback de rol: profiles → app_metadata → user_metadata → 'cajero'
        const resolvedRole = profileData.role
            || appMeta.role
            || metadata.role
            || 'cajero';

        // Fallback de permisos para rol admin/gerente si no vienen de BD
        const defaultAdminPermissions = {
            restaurante: { create: true, read: true, update: true, delete: true },
            hotel: { create: true, read: true, update: true, delete: true },
            financiero: { create: true, read: true, update: true, delete: true },
            usuarios: { create: true, read: true, update: true, delete: true },
            sedes: { create: true, read: true, update: true, delete: true },
            marketing: { create: true, read: true, update: true, delete: true },
            qr_tools: { create: true, read: true, update: true, delete: true },
            operaciones: { create: true, read: true, update: true, delete: true },
        };

        const resolvedPermissions = profileData.permissions
            || metadata.permissions
            || (resolvedRole === 'admin' || resolvedRole === 'gerente' ? defaultAdminPermissions : {});

        return {
            ...sessionUser,
            ...metadata,
            ...profileData,
            role: resolvedRole,
            permissions: resolvedPermissions,
            branch: { name: profileData.branch_id ? 'Sede' : 'Sede Principal', id: profileData.branch_id || metadata.branch_id },
            name: profileData.full_name || metadata.name || sessionUser.email?.split('@')[0] || 'Usuario'
        };
    };


    const handleUserSession = async (session) => {
        setLoading(true);
        const sessionUser = session?.user ?? null;

        if (sessionUser) {
            const enriched = await enrichUser(sessionUser);
            setUser(enriched);
        } else {
            setUser(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        // 1. Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleUserSession(session);
        });

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            handleUserSession(session);
        });

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
                options: { data: metadata }
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, signUp, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
