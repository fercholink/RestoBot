import React from 'react';
import { Eye, ExternalLink, Clock, CheckCircle2, XCircle } from 'lucide-react';

const JobsHistory = () => {
    // Mock Data
    const jobs = [
        { id: '101', date: '2024-03-20 14:30', product: 'Hamburguesa Perro', platform: 'Instagram', status: 'completed', result: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd' },
        { id: '102', date: '2024-03-20 10:15', product: 'Salchipapa', platform: 'Facebook', status: 'completed', result: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5' },
        { id: '103', date: '2024-03-19 18:45', product: 'Coca Cola', platform: 'WhatsApp', status: 'failed', result: null },
        { id: '104', date: '2024-03-19 09:00', product: 'Pizza Familiar', platform: 'Instagram', status: 'pending', result: null },
    ];

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
