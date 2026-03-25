import { useOffline } from '../context/OfflineContext';

export const useOfflineSync = () => {
    const { isOnline, isSyncing, pendingCount, lastSyncedAt, runSync } = useOffline();
    return { isOnline, isSyncing, pendingCount, lastSyncedAt, runSync };
};
