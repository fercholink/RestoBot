import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getDefaultPermissions, VALID_ROLES, isValidRole } from '../config/roles';

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
                console.log(`[Auth] ✅ Perfil cargado — rol: ${data.role}`);
            } else if (error) {
                console.warn("Auth: profiles devolvió error, usando JWT claims como fallback.", error.message);
            }
        } catch (err) {
            console.warn("Auth: No se pudo cargar perfil de BD, usando metadata.", err.message);
        }

        const metadata = sessionUser.user_metadata || {};
        const appMeta = sessionUser.app_metadata || {};

        // Resolver rol con validación — garantiza un rol siempre válido
        const rawRole = profileData.role || appMeta.role || metadata.role || 'cajero';
        const resolvedRole = isValidRole(rawRole) ? rawRole : 'cajero';

        // Resolver permisos: BD (si tiene contenido real) → default del rol
        // IMPORTANTE: {} vacío NO cuenta como permisos válidos
        const dbPerms = profileData.permissions;
        const hasRealPermissions = dbPerms && typeof dbPerms === 'object' && Object.keys(dbPerms).length > 0;
        const resolvedPermissions = hasRealPermissions ? dbPerms : getDefaultPermissions(resolvedRole);
        const resolvedOrganizationId = profileData.organization_id || metadata.organization_id || null;

        // ─── PASO 2.1: FETCHAR MODULES POR ORGANIZACIÓN ───
        let organizationData = null;
        if (resolvedOrganizationId) {
            try {
                const { data: orgData, error: orgError } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', resolvedOrganizationId)
                    .single();
                
                if (orgData && !orgError) {
                    organizationData = orgData;
                } else if (orgError) {
                    console.warn("[Auth] No se pudo cargar organización:", orgError.message);
                }
            } catch (err) {
                console.warn("[Auth] Excepción al cargar organización:", err.message);
            }
        }

        // Si la org no tiene array predefinido (ej. migración incompleta), le damos todos como fallback.
        const defaultModules = ['restaurante', 'hotel', 'financiero', 'usuarios', 'sedes', 'marketing', 'qr_tools', 'operaciones'];
        const activeModules = organizationData?.active_modules || defaultModules;

        console.log(`[Auth] ✅ Usuario listo — rol: ${resolvedRole}, org: ${resolvedOrganizationId}, mods activos: ${activeModules.length}`);

        // ─── BYPASS DE EMERGENCIA ───
        // Si el correo es el del dueño, forzamos superadmin y admin
        const isOwner = ['fercho028890@gmail.com', 'ricardo@admin.com'].includes(sessionUser.email?.toLowerCase());
        const finalRole = isOwner ? 'admin' : resolvedRole;
        const finalIsSuperAdmin = isOwner ? true : (profileData.is_superadmin || false);

        return {
            ...sessionUser,
            ...metadata,
            ...profileData,
            role: finalRole,
            permissions: resolvedPermissions,
            is_superadmin: finalIsSuperAdmin,
            organization_id: resolvedOrganizationId,
            organization: organizationData ? {
                ...organizationData,
                active_modules: activeModules
            } : { active_modules: activeModules },
            branch: { name: profileData.branch_id ? 'Sede' : 'Sede Principal', id: profileData.branch_id || metadata.branch_id },
            name: profileData.full_name || metadata.name || sessionUser.email?.split('@')[0] || 'Usuario'
        };
    };


    const handleUserSession = async (session) => {
        // Solo mostramos el spinner de carga si no tenemos un usuario ya en memoria (evita flashes al enfocar la pestaña)
        if (!user) setLoading(true);
        
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
