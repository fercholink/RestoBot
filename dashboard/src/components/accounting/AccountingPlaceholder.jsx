import React from 'react';
import { Construction } from 'lucide-react';

const AccountingPlaceholder = ({ title, description, icon: Icon }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center animate-in fade-in duration-500">
            <div className="bg-gray-100 p-6 rounded-full mb-6">
                {Icon ? <Icon size={48} className="text-gray-300" /> : <Construction size={48} className="text-gray-300" />}
            </div>
            <h3 className="text-2xl font-black text-secondary mb-2 uppercase tracking-tight">{title}</h3>
            <p className="text-base text-gray-500 max-w-md mx-auto">{description}</p>
            <div className="mt-8 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold uppercase tracking-wider">
                Próximamente
            </div>
        </div>
    );
};

export default AccountingPlaceholder;
