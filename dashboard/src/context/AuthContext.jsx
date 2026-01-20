import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_USERS } from '../constants/initialUsers';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('restobot_user');
        try {
            console.log("AuthContext: Loading saved user...");
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            }
        } catch (error) {
            console.error("AuthContext: Error parsing saved user:", error);
            localStorage.removeItem('restobot_user');
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const rawPassword = password.trim();

        console.log("Login Attempt:", normalizedEmail);

        // 1. Obtener usuarios: Primero localStorage, si no hay, usar INITIAL_USERS
        let allUsers = [];
        try {
            const storedUsers = localStorage.getItem('restobot_registered_users');
            if (storedUsers) {
                allUsers = JSON.parse(storedUsers);
            } else {
                // Si no hay nada en storage, usamos los iniciales
                allUsers = INITIAL_USERS;
                // Opcional: Persistir los iniciales de una vez para que UserManagement los vea igual
                // localStorage.setItem('restobot_registered_users', JSON.stringify(INITIAL_USERS));
            }
        } catch (err) {
            console.error("AuthContext: Error reading users", err);
            allUsers = INITIAL_USERS;
        }

        // Combinar con INITIAL_USERS si se desea que siempre existan (opcional, pero seguro para demos)
        // Por ahora, vamos a asegurar que el Admin siempre pueda entrar incluso si borran localStorage
        const adminUser = INITIAL_USERS.find(u => u.role === 'gerente');
        const internalMasterList = [...allUsers];

        // Buscar usuario
        const foundUser = internalMasterList.find(u =>
            u.email.trim().toLowerCase() === normalizedEmail &&
            // Comparación simple de password para demo. En prod usar hash.
            (u.password === rawPassword || (u.id === 1 && rawPassword === 'admin123')) // Backdoor admin original mantenido por compatibilidad
        );

        if (foundUser) {
            const authUser = { ...foundUser, token: 'fake-jwt-token-' + Date.now() };
            setUser(authUser);
            localStorage.setItem('restobot_user', JSON.stringify(authUser));
            return { success: true };
        }

        return { success: false, message: 'Credenciales inválidas o usuario no persistido' };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('restobot_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
