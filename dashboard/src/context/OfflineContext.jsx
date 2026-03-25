import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../lib/db';
import { OfflineManager } from '../services/OfflineManager';
import { useAuth } from './AuthContext';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
    const { user } = useAuth();
    const [isOnline, setIsOnline]           = useState(navigator.onLine);
    const [pendingCount, setPendingCount]   = useState(0);
    const [isSyncing, setIsSyncing]         = useState(false);
    const [lastSyncedAt, setLastSyncedAt]   = useState(null);
    const syncLockRef                       = useRef(false);

    // ── Contar pendientes en la cola ──────────────────────────────────────────
    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await db.pending_sync.where('status').equals('pending').count();
            setPendingCount(count);
        } catch { /* db puede no estar lista aún */ }
    }, []);

    // ── Ejecutar sync completo ────────────────────────────────────────────────
    const runSync = useCallback(async () => {
        if (!navigator.onLine || syncLockRef.current) return;
        syncLockRef.current = true;
        setIsSyncing(true);

        try {
            await OfflineManager.processSyncQueue();
            await refreshPendingCount();
            setLastSyncedAt(new Date());
        } catch (e) {
            console.error('[Offline] Error en sync:', e);
        } finally {
            setIsSyncing(false);
            syncLockRef.current = false;
        }
    }, [refreshPendingCount]);

    // ── Sync completo de datos (menu, mesas, pedidos, hotel) ──────────────────
    const runFullSync = useCallback(async () => {
        if (!navigator.onLine) return;
        // organization_id puede ser null en superadmin — intentamos de todas formas
        const orgId = user?.organization_id || null;
        if (!orgId) {
            console.warn('[Offline] Sin organization_id — solo procesando cola pendiente');
            await runSync();
            return;
        }

        console.log('[Offline] Sync completo org:', orgId);
        await Promise.allSettled([
            OfflineManager.syncMenu(orgId),
            OfflineManager.syncTableMap(orgId),
            OfflineManager.syncRooms(orgId),
            OfflineManager.syncBookings(orgId),
        ]);
        await runSync();
        console.log('[Offline] Sync completo finalizado');
    }, [user?.organization_id, runSync]);

    // ── Eventos de red ────────────────────────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Al reconectar: primero procesar pendientes, luego refrescar datos
            runSync().then(() => runFullSync());
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online',  handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online',  handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [runSync, runFullSync]);

    // ── Sync inicial cuando el usuario queda disponible ───────────────────────
    useEffect(() => {
        if (!user?.id) return; // esperar a que el usuario esté cargado
        refreshPendingCount();
        if (navigator.onLine) {
            // Pequeño delay para no bloquear el render inicial
            const t = setTimeout(() => runFullSync(), 1500);
            return () => clearTimeout(t);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // ── Polling ligero de pendientes (cada 30s) ───────────────────────────────
    useEffect(() => {
        const interval = setInterval(refreshPendingCount, 30_000);
        return () => clearInterval(interval);
    }, [refreshPendingCount]);

    const value = {
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncedAt,
        runSync,
        runFullSync,
        refreshPendingCount,
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
};

export const useOffline = () => {
    const ctx = useContext(OfflineContext);
    if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
    return ctx;
};
