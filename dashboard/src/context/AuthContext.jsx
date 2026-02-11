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
            // Try to fetch profile from 'profiles' table (created via migration)
            const { data, error } = await supabase
                .from('profiles')
                .select('*, branch:branches(*)')
                .eq('id', sessionUser.id)
                .single();

            if (data && !error) {
                profileData = data;
                console.log("Auth: Perfil cargado desde BD", data);
            }
        } catch (err) {
            console.warn("Auth: No se pudo cargar perfil de BD (tabla no existe o error), usando metadata.", err);
        }

        // Merge Metadata (Fallback) with Profile (Priority)
        // Profile ID overrides session ID (they should be same)
        // Role from profile overrides metadata
        const metadata = sessionUser.user_metadata || {};

        return {
            ...sessionUser,
            ...metadata, // Base metadata
            ...profileData, // DB Profile overrides (role, branch_id, permissions)
            branch: profileData.branch || { name: metadata.branch || 'Sede Principal' }, // Ensure branch object exists
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
