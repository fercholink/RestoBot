import React, { useState } from 'react';
import { Megaphone, History, PlusCircle, LayoutDashboard } from 'lucide-react';
import CreateAdForm from './CreateAdForm';
import JobsHistory from './JobsHistory';

const MarketingModule = () => {
    const [activeTab, setActiveTab] = useState('create');

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                        <Megaphone size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Marketing AI</h1>
                        <p className="text-sm text-gray-500">Crea y gestiona tus campañas publicitarias con IA</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="px-6 pt-6">
                <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            }`}
                    >
                        <PlusCircle size={18} />
                        Crear Anuncio
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            }`}
                    >
                        <History size={18} />
                        Historial
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-hidden">
                {activeTab === 'create' && <CreateAdForm />}
                {activeTab === 'history' && <JobsHistory />}
            </div>
        </div>
    );
};

export default MarketingModule;
