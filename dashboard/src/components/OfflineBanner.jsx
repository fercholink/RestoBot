import { WifiOff, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';

const OfflineBanner = () => {
    const { isOnline, isSyncing, pendingCount, lastSyncedAt, runSync } = useOffline();

    // Online sin pendientes → no mostrar nada
    if (isOnline && pendingCount === 0 && !isSyncing) return null;

    return (
        <div className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
            !isOnline
                ? 'bg-rose-600'
                : isSyncing
                    ? 'bg-amber-500'
                    : pendingCount > 0
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
        }`}>
            <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
                <div className="flex items-center gap-3">
                    {!isOnline ? (
                        <WifiOff size={15} className="text-white" />
                    ) : isSyncing ? (
                        <RefreshCw size={15} className="text-white animate-spin" />
                    ) : (
                        <Clock size={15} className="text-white" />
                    )}

                    <span className="text-white text-xs font-black uppercase tracking-widest">
                        {!isOnline
                            ? 'Sin conexión — trabajando en modo offline'
                            : isSyncing
                                ? 'Sincronizando datos con el servidor...'
                                : `${pendingCount} acción${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''} de sincronizar`
                        }
                    </span>

                    {!isOnline && (
                        <span className="hidden sm:inline text-white/70 text-[10px] font-bold">
                            Los pedidos se guardan localmente y se enviarán al reconectar
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {lastSyncedAt && isOnline && (
                        <span className="hidden md:flex items-center gap-1 text-white/70 text-[10px] font-bold">
                            <CheckCircle size={10} />
                            Último sync: {lastSyncedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}

                    {isOnline && pendingCount > 0 && !isSyncing && (
                        <button
                            onClick={runSync}
                            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                        >
                            <RefreshCw size={11} />
                            Sincronizar ahora
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OfflineBanner;
