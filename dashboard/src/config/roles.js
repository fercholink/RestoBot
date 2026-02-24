// ============================================================
// DEFINICIÓN MAESTRA DE ROLES Y PERMISOS — RestoBot
// Fuente de verdad única para toda la aplicación
// ============================================================

/**
 * Módulos del sistema y sus etiquetas
 */
export const MODULES = {
    restaurante: { label: 'Restaurante', icon: '🍔', tab: 'restaurante' },
    hotel: { label: 'Hotel', icon: '🏨', tab: 'hotel' },
    financiero: { label: 'Financiero', icon: '💰', tab: 'contabilidad' },
    usuarios: { label: 'Usuarios', icon: '👥', tab: 'usuarios' },
    sedes: { label: 'Sedes', icon: '🏢', tab: 'sedes' },
    marketing: { label: 'Marketing', icon: '📢', tab: 'marketing' },
    qr_tools: { label: 'QR & Digital', icon: '📱', tab: 'qr' },
    operaciones: { label: 'Operaciones', icon: '⚙️', tab: 'operaciones' },
};

/**
 * Roles del sistema con meta-información
 * Los permisos definitivos vienen de la BD (tabla roles)
 * pero aquí se definen como fallback y para la UI
 */
export const ROLE_DEFINITIONS = {
    admin: {
        label: 'Administrador',
        description: 'Acceso total al sistema',
        color: '#6c5ce7',
        bgColor: '#f0edff',
        icon: '👑',
        defaultTab: 'restaurante',
        sidebarCollapsed: false,
    },
    gerente: {
        label: 'Gerente',
        description: 'Gestión operativa completa',
        color: '#0984e3',
        bgColor: '#e8f4fd',
        icon: '🎯',
        defaultTab: 'restaurante',
        sidebarCollapsed: false,
    },
    cajero: {
        label: 'Cajero',
        description: 'Gestión de pedidos y caja',
        color: '#00b894',
        bgColor: '#e8f8f5',
        icon: '💳',
        defaultTab: 'restaurante',
        sidebarCollapsed: true,
    },
    mesero: {
        label: 'Mesero',
        description: 'Atención de mesas y pedidos',
        color: '#fdcb6e',
        bgColor: '#fef9e7',
        icon: '🍽️',
        defaultTab: 'restaurante',
        sidebarCollapsed: true,
    },
    cocina: {
        label: 'Cocina',
        description: 'Visualización de producción',
        color: '#e17055',
        bgColor: '#fdf0ee',
        icon: '👨‍🍳',
        defaultTab: 'restaurante',
        sidebarCollapsed: true,
    },
    recepcion: {
        label: 'Recepción',
        description: 'Gestión de reservas y hotel',
        color: '#a29bfe',
        bgColor: '#f0eeff',
        icon: '🏩',
        defaultTab: 'hotel',
        sidebarCollapsed: false,
    },
    analista: {
        label: 'Analista',
        description: 'Acceso de solo lectura a reportes',
        color: '#636e72',
        bgColor: '#f5f5f5',
        icon: '📊',
        defaultTab: 'operaciones',
        sidebarCollapsed: false,
    },
};

/**
 * Permisos por defecto por rol (FALLBACK si BD no responde)
 * Formato: { modulo: { create, read, update, delete } }
 */
export const DEFAULT_PERMISSIONS = {
    admin: {
        restaurante: { create: true, read: true, update: true, delete: true },
        hotel: { create: true, read: true, update: true, delete: true },
        financiero: { create: true, read: true, update: true, delete: true },
        usuarios: { create: true, read: true, update: true, delete: true },
        sedes: { create: true, read: true, update: true, delete: true },
        marketing: { create: true, read: true, update: true, delete: true },
        qr_tools: { create: true, read: true, update: true, delete: true },
        operaciones: { create: true, read: true, update: true, delete: true },
    },
    gerente: {
        restaurante: { create: true, read: true, update: true, delete: true },
        hotel: { create: true, read: true, update: true, delete: true },
        financiero: { create: true, read: true, update: false, delete: false },
        usuarios: { create: false, read: true, update: false, delete: false },
        sedes: { create: false, read: true, update: false, delete: false },
        marketing: { create: true, read: true, update: true, delete: false },
        qr_tools: { create: true, read: true, update: true, delete: false },
        operaciones: { create: true, read: true, update: true, delete: false },
    },
    cajero: {
        restaurante: { create: true, read: true, update: true, delete: false },
        hotel: { create: false, read: false, update: false, delete: false },
        financiero: { create: false, read: false, update: false, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: false, update: false, delete: false },
        marketing: { create: false, read: false, update: false, delete: false },
        qr_tools: { create: false, read: true, update: false, delete: false },
        operaciones: { create: false, read: true, update: false, delete: false },
    },
    mesero: {
        restaurante: { create: false, read: true, update: true, delete: false },
        hotel: { create: false, read: false, update: false, delete: false },
        financiero: { create: false, read: false, update: false, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: false, update: false, delete: false },
        marketing: { create: false, read: false, update: false, delete: false },
        qr_tools: { create: false, read: true, update: false, delete: false },
        operaciones: { create: false, read: true, update: false, delete: false },
    },
    cocina: {
        restaurante: { create: false, read: true, update: true, delete: false },
        hotel: { create: false, read: false, update: false, delete: false },
        financiero: { create: false, read: false, update: false, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: false, update: false, delete: false },
        marketing: { create: false, read: false, update: false, delete: false },
        qr_tools: { create: false, read: false, update: false, delete: false },
        operaciones: { create: false, read: false, update: false, delete: false },
    },
    recepcion: {
        restaurante: { create: false, read: true, update: false, delete: false },
        hotel: { create: true, read: true, update: true, delete: false },
        financiero: { create: false, read: false, update: false, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: false, update: false, delete: false },
        marketing: { create: false, read: false, update: false, delete: false },
        qr_tools: { create: false, read: true, update: false, delete: false },
        operaciones: { create: false, read: true, update: false, delete: false },
    },
    analista: {
        restaurante: { create: false, read: true, update: false, delete: false },
        hotel: { create: false, read: true, update: false, delete: false },
        financiero: { create: false, read: true, update: false, delete: false },
        usuarios: { create: false, read: false, update: false, delete: false },
        sedes: { create: false, read: true, update: false, delete: false },
        marketing: { create: false, read: true, update: false, delete: false },
        qr_tools: { create: false, read: false, update: false, delete: false },
        operaciones: { create: false, read: true, update: false, delete: false },
    },
};

/**
 * Roles que reciben notificaciones de tiempo real por tipo de evento
 */
export const REALTIME_SUBSCRIPTIONS = {
    orders: ['admin', 'gerente', 'cajero', 'mesero', 'cocina'],
    bookings: ['admin', 'gerente', 'recepcion'],
    profiles: ['admin', 'gerente'],
};

/**
 * Velocidad de polling por rol (ms)
 * Roles operativos tienen polling más frecuente
 */
export const POLLING_INTERVALS = {
    admin: 8000,   // 8 segundos
    gerente: 8000,   // 8 segundos
    cajero: 6000,   // 6 segundos (operativo)
    mesero: 6000,   // 6 segundos (operativo)
    cocina: 5000,   // 5 segundos (más urgente)
    recepcion: 10000, // 10 segundos
    analista: 30000, // 30 segundos (solo lectura)
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Obtiene la definición de un rol
 * @param {string} role - nombre del rol
 * @returns objeto con metadata del rol
 */
export const getRoleDefinition = (role) => {
    return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.cajero;
};

/**
 * Obtiene los permisos por defecto de un rol
 * @param {string} role - nombre del rol
 * @returns objeto de permisos por módulo
 */
export const getDefaultPermissions = (role) => {
    return DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.cajero;
};

/**
 * Verifica si un rol puede realizar una acción en un módulo
 * @param {string} role
 * @param {string} module
 * @param {'create'|'read'|'update'|'delete'} action
 * @param {object} customPermissions - permisos personalizados del usuario (override)
 */
export const canDo = (role, module, action, customPermissions = null) => {
    const perms = customPermissions || DEFAULT_PERMISSIONS[role] || {};
    return perms[module]?.[action] === true;
};

/**
 * Verifica si un rol debe recibir notificaciones de un tipo
 */
export const shouldReceiveNotification = (role, type) => {
    return REALTIME_SUBSCRIPTIONS[type]?.includes(role) ?? false;
};

/**
 * Retorna el intervalo de polling para un rol dado
 */
export const getPollingInterval = (role) => {
    return POLLING_INTERVALS[role] || 12000;
};

// Base roles — roles dinámicos se validan desde la BD
export const VALID_ROLES = Object.keys(ROLE_DEFINITIONS);

/**
 * Verifica si un rol es válido (base o dinámico)
 * Para roles dinámicos, se acepta cualquier string no vacío
 */
export const isValidRole = (role) => {
    if (!role || typeof role !== 'string') return false;
    return true; // Aceptar cualquier rol — la BD es la fuente de verdad
};
