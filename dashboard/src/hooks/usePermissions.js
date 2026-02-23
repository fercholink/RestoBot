import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canDo, getRoleDefinition, getDefaultPermissions } from '../config/roles';

/**
 * Hook para verificar permisos del usuario actual
 * Uso: const { can, role, roleInfo, isAdmin, isCocina } = usePermissions()
 */
const usePermissions = () => {
    const { user } = useAuth();

    const role = user?.role || 'cajero';
    const customPermissions = user?.permissions || null;

    /**
     * Verifica si el usuario puede realizar una acción en un módulo
     * @param {string} module - nombre del módulo
     * @param {'create'|'read'|'update'|'delete'} action
     */
    const can = useMemo(() => (module, action) => {
        return canDo(role, module, action, customPermissions);
    }, [role, customPermissions]);

    /**
     * Verifica si el usuario tiene al menos lectura en un módulo
     */
    const canAccess = useMemo(() => (module) => {
        return canDo(role, module, 'read', customPermissions);
    }, [role, customPermissions]);

    /**
     * Metadata del rol actual
     */
    const roleInfo = useMemo(() => getRoleDefinition(role), [role]);

    /**
     * Permisos completos resueltos del usuario
     */
    const permissions = useMemo(() => {
        return customPermissions || getDefaultPermissions(role);
    }, [role, customPermissions]);

    // Shortcuts de roles comunes
    const isAdmin = role === 'admin';
    const isGerente = role === 'gerente';
    const isCajero = role === 'cajero';
    const isMesero = role === 'mesero';
    const isCocina = role === 'cocina';
    const isRecepcion = role === 'recepcion';
    const isAnalista = role === 'analista';
    const isManager = isAdmin || isGerente; // Admin o Gerente

    return {
        role,
        roleInfo,
        permissions,
        can,
        canAccess,
        isAdmin,
        isGerente,
        isCajero,
        isMesero,
        isCocina,
        isRecepcion,
        isAnalista,
        isManager,
        user,
    };
};

export default usePermissions;
