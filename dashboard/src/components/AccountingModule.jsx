import React, { useState } from 'react';
import { Landmark, TrendingUp, TrendingDown, FileText, Receipt, PieChart, Calculator, AlertCircle, Save, Download, Plus, Briefcase, FileSpreadsheet, ShieldCheck, ChevronRight } from 'lucide-react';

const AccountingModule = ({ orders }) => {
    const [activeSubTab, setActiveSubTab] = useState('summary');

    // Datos simulados para contabilidad
    const financials = {
        utility: '$2.840.000',
        utilityPercent: '+8.4%',
        activeAccounts: 12,
        pendingTax: '$450.000'
    };

    const ledgers = [
        { id: '1', date: '2024-01-16', concept: 'Venta de Servicios (Hotel)', type: 'ingreso', amount: 150000 },
        { id: '2', date: '2024-01-16', concept: 'Pago Proveedor Carnes', type: 'egreso', amount: -65000 },
        { id: '3', date: '2024-01-15', concept: 'Servicios Públicos', type: 'egreso', amount: -120000 },
        { id: '4', date: '2024-01-15', concept: 'Venta Restaurante (Mesa)', type: 'ingreso', amount: 89000 },
    ];

    const subMenuItems = [
        { id: 'summary', label: 'Resumen Diario', icon: PieChart },
        { id: 'invoicing', label: 'Facturación DIAN', icon: Receipt },
        { id: 'payroll', label: 'Nómina Electrónica', icon: Briefcase },
        { id: 'reports', label: 'Informes Legales', icon: FileSpreadsheet },
    ];

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            {/* Sub-Header de Navegación del Módulo */}
            <div className="bg-white border-b border-gray-100 px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                        <Landmark size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-secondary tracking-tight">Ecosistema Contable</h2>
                        <div className="flex items-center gap-1 text-[10px] text-accent font-bold uppercase tracking-widest">
                            Finanzas <ChevronRight size={10} /> {subMenuItems.find(t => t.id === activeSubTab)?.label}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl border border-gray-200 shadow-inner overflow-x-auto max-w-full">
                    {subMenuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSubTab(item.id)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === item.id
                                ? 'bg-secondary text-white shadow-lg scale-[1.02]'
                                : 'text-accent hover:bg-white/50'
                                }`}
                        >
                            <item.icon size={14} />
                            <span className="hidden lg:inline">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Contenido Dinámico */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeSubTab === 'summary' && (
                    <>
                        {/* Quick Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="p-3 rounded-2xl bg-success/10 text-success"><TrendingUp size={20} /></div>
                                    <span className="text-[10px] font-black text-success uppercase tracking-widest">{financials.utilityPercent}</span>
                                </div>
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Utilidad Neta</p>
                                <h3 className="text-2xl font-black text-secondary">{financials.utility}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="p-3 rounded-2xl bg-primary/10 text-primary"><Calculator size={20} /></div>
                                </div>
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Cuentas por Cobrar</p>
                                <h3 className="text-2xl font-black text-secondary">$1.200.000</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="p-3 rounded-2xl bg-warning/10 text-warning"><Landmark size={20} /></div>
                                </div>
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Pasivos Totales</p>
                                <h3 className="text-2xl font-black text-secondary">$840.000</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-secondary">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="p-3 rounded-2xl bg-secondary/5 text-secondary"><AlertCircle size={20} /></div>
                                </div>
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Impuestos Pendientes</p>
                                <h3 className="text-2xl font-black text-secondary">{financials.pendingTax}</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                    <h3 className="text-lg font-black text-secondary">Libro Auxiliar Diario</h3>
                                    <FileText className="text-accent" size={20} />
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50">
                                                <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest">Fecha</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest">Detalle</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {ledgers.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-bold text-accent">{item.date}</td>
                                                    <td className="px-6 py-4 text-xs font-black text-secondary">{item.concept}</td>
                                                    <td className={`px-6 py-4 text-xs font-black text-right ${item.type === 'ingreso' ? 'text-success' : 'text-red-500'}`}>
                                                        {item.amount > 0 ? '+' : ''} ${Math.abs(item.amount).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <h3 className="text-lg font-black text-secondary mb-8">Estructura de Gastos</h3>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-8 flex">
                                    <div className="bg-secondary w-[65%] h-full" />
                                    <div className="bg-primary w-[35%] h-full" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-accent">Costos Operativos</span>
                                        <span className="text-secondary">65%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-accent">Gastos Administrativos</span>
                                        <span className="text-primary">35%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeSubTab === 'invoicing' && (
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-secondary uppercase tracking-tight">Emisión de Facturas DIAN</h3>
                                    <p className="text-sm font-medium text-accent">Pedidos con requerimiento de factura electrónica</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="bg-secondary text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
                                        <ShieldCheck size={16} /> Validar Todo
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest">Pedido</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest">Cliente / NIT</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest text-right">Monto</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest text-center">Estado Factus</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-accent uppercase tracking-widest text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {orders?.filter(o => o.is_electronic_invoiced).length > 0 ? (
                                            orders.filter(o => o.is_electronic_invoiced).map((order) => (
                                                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-black text-secondary">#{order.id}</div>
                                                        <div className="text-[10px] text-accent font-medium">{new Date(order.created_at).toLocaleDateString()}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs font-black text-secondary">{order.tax_data.names}</div>
                                                        <div className="text-[10px] text-accent font-bold uppercase">{order.tax_data.identification}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-xs font-black text-secondary">
                                                        ${order.total_price?.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-3 py-1 bg-warning/10 text-warning text-[9px] font-black uppercase rounded-full">
                                                            Pendiente Emisión
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="p-2 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white rounded-xl transition-all">
                                                            <Save size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <Receipt size={40} className="text-gray-200 mb-4" />
                                                        <p className="text-sm font-black text-accent uppercase tracking-widest">No hay facturas pendientes</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Banner publicitario de Factus */}
                        <div className="bg-gradient-to-r from-secondary to-secondary/80 rounded-3xl p-8 flex items-center justify-between shadow-premium overflow-hidden relative">
                            <div className="relative z-10">
                                <h4 className="text-white font-black text-lg mb-2 flex items-center gap-2">
                                    <ShieldCheck size={24} className="text-success" />
                                    Conexión Segura con Factus.com.co
                                </h4>
                                <p className="text-white/60 text-sm max-w-lg mb-4">
                                    Toda la información capturada será enviada automáticamente a la DIAN a través de la API oficial de Factus.
                                </p>
                                <div className="flex gap-4">
                                    <div className="px-4 py-2 bg-white/10 rounded-xl text-white text-[9px] font-black uppercase tracking-widest border border-white/10">Tokens OAuth2: Activos</div>
                                    <div className="px-4 py-2 bg-white/10 rounded-xl text-white text-[9px] font-black uppercase tracking-widest border border-white/10">DIAN Res: 1876...</div>
                                </div>
                            </div>
                            <div className="absolute right-0 top-0 p-10 opacity-10 scale-150 rotate-12">
                                <Landmark size={200} />
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'payroll' && (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="p-5 rounded-full bg-primary/5 text-primary mb-6 animate-bounce">
                            <Briefcase size={48} />
                        </div>
                        <h3 className="text-xl font-black text-secondary mb-2">Nómina Electrónica</h3>
                        <p className="text-sm font-medium text-accent max-w-md text-center mb-8 px-6">
                            Liquidación automática de nómina bajo estándares legales. Generación de desprendibles y envío de archivos XML a la DIAN.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl px-8">
                            {['Empleados', 'Prestaciones', 'Aportes SS', 'XML Firmados'].map(tag => (
                                <div key={tag} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                                    <div className="text-xs font-black text-secondary uppercase">{tag}</div>
                                    <div className="text-[10px] font-bold text-accent">Configurable</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSubTab === 'reports' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { title: 'Estado de Resultados (P&G)', desc: 'Utilidad y perdida por periodo contable.' },
                                { title: 'Balance General', desc: 'Situación patrimonial de la empresa.' },
                                { title: 'Información Exógena', desc: 'Reporte para medios magnéticos DIAN.' },
                                { title: 'Libro Mayor y Balances', desc: 'Cuentas detalladas por PUC colombiano.' }
                            ].map((report, idx) => (
                                <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-secondary uppercase tracking-tight mb-1">{report.title}</h4>
                                        <p className="text-xs text-accent font-medium">{report.desc}</p>
                                    </div>
                                    <button className="p-3 bg-gray-50 text-accent rounded-2xl group-hover:bg-secondary group-hover:text-white transition-all">
                                        <FileSpreadsheet size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountingModule;
