import { Eye, ExternalLink, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

const JobsHistory = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('marketing_jobs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setJobs(data || []);
        } catch (error) {
            console.error("Error fetching jobs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs(); // Carga inicial

        // Suscripción a cambios en tiempo real para actualizar la tabla
        const channel = supabase.channel('table_db_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'marketing_jobs' },
                (payload) => {
                    console.log("Cambio en tabla:", payload);
                    fetchJobs(); // Recargar lista simple
                }
            )
            .subscribe();

        return () => channel.unsubscribe();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString('es-CO');
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> Completado</span>;
            case 'pending': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><Clock size={12} /> Procesando</span>;
            case 'failed': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit"><XCircle size={12} /> Fallido</span>;
            default: return null;
        }
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plataforma</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {jobs.map((job) => (
                            <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-600 font-medium">{job.date}</td>
                                <td className="px-6 py-4 text-sm text-gray-800 font-medium">{job.product}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{job.platform}</td>
                                <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                                <td className="px-6 py-4 text-right">
                                    {job.result ? (
                                        <button className="text-purple-600 hover:text-purple-800 font-medium text-sm inline-flex items-center gap-1 transition-colors">
                                            <Eye size={16} /> Ver
                                        </button>
                                    ) : (
                                        <span className="text-gray-300 text-sm">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default JobsHistory;
