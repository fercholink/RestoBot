
import React, { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import { Download, Printer, Save, Copy, QrCode, Utensils, Zap, PartyPopper } from 'lucide-react';

const TableQRGenerator = () => {
    const [type, setType] = useState('mesa'); // mesa, menu, wifi, custom
    const [value, setValue] = useState('1');
    const [customUrl, setCustomUrl] = useState('');
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const qrRef = useRef(null);

    const getQRValue = () => {
        switch (type) {
            case 'mesa':
                // Generates a URL or JSON for the table ordering
                // Example: https://tu-dominio.com/order?table=5
                // Or a whatsapp link with pre-filled text
                const restaurantPhone = '573019697028'; // Should come from config
                const message = `Hola, estoy en la Mesa ${value}, quiero ver el menú.`;
                return `https://wa.me/${restaurantPhone}?text=${encodeURIComponent(message)}`;
            case 'menu':
                return customUrl || 'https://tu-restaurante.com/menu';
            case 'wifi':
                return `WIFI:T:WPA;S:${ssid};P:${password};;`;
            case 'custom':
                return customUrl;
            default:
                return '';
        }
    };

    const handleDownload = async () => {
        if (qrRef.current) {
            try {
                const dataUrl = await toPng(qrRef.current, { cacheBust: true });
                const link = document.createElement('a');
                link.download = `qr-${type}-${value || 'custom'}.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error("Error downloading QR:", err);
                alert("Error al descargar la imagen.");
            }
        }
    };

    const handlePrint = () => {
        if (qrRef.current) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Imprimir QR</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    </style>
                </head>
                <body>
                    ${qrRef.current.innerHTML}
                    <div style="margin-top: 20px; font-family: sans-serif; font-weight: bold; font-size: 24px;">
                        ${type === 'mesa' ? `MESA ${value}` : 'Escanéame'}
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
                <h2 className="text-3xl font-black text-secondary tracking-tight">Generador de Códigos QR</h2>
                <p className="text-gray-500 font-medium mt-1">Crea códigos QR para tus mesas, menú digital o promociones especiales.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Configuración */}
                <div className="bg-white p-6 rounded-3xl shadow-premium border border-gray-100">
                    <h3 className="text-lg font-bold text-secondary mb-4 flex items-center gap-2">
                        <SettingsIcon type={type} /> Configuración
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de QR</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setType('mesa')}
                                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all font-bold text-sm ${type === 'mesa' ? 'bg-primary/10 border-primary text-primary' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Utensils size={18} /> Mesa
                                </button>
                                <button
                                    onClick={() => setType('menu')}
                                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all font-bold text-sm ${type === 'menu' ? 'bg-orange-50 border-orange-500 text-orange-500' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <BookOpenText size={18} /> Menú Digital
                                </button>
                                <button
                                    onClick={() => setType('wifi')}
                                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all font-bold text-sm ${type === 'wifi' ? 'bg-blue-50 border-blue-500 text-blue-500' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Zap size={18} /> Wi-Fi
                                </button>
                                <button
                                    onClick={() => setType('custom')}
                                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all font-bold text-sm ${type === 'custom' ? 'bg-purple-50 border-purple-500 text-purple-500' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <PartyPopper size={18} /> Promo / URL
                                </button>
                            </div>
                        </div>

                        {type === 'mesa' && (
                            <div className="animate-in fade-in slide-in-from-left-2">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Número de Mesa</label>
                                <input
                                    type="number"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-secondary focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    placeholder="Ej. 5"
                                />
                                <p className="text-[10px] text-gray-400 mt-2">Genera un enlace directo a WhatsApp con el mensaje "Estoy en la Mesa {value}..."</p>
                            </div>
                        )}

                        {(type === 'menu' || type === 'custom') && (
                            <div className="animate-in fade-in slide-in-from-left-2">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">URL del Destino</label>
                                <input
                                    type="url"
                                    value={customUrl}
                                    onChange={(e) => setCustomUrl(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-secondary focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    placeholder="https://"
                                />
                            </div>
                        )}

                        {type === 'wifi' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nombre de Red (SSID)</label>
                                    <input
                                        type="text"
                                        value={ssid}
                                        onChange={(e) => setSsid(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-secondary outline-none"
                                        placeholder="MiRestaurante_WiFi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Contraseña</label>
                                    <input
                                        type="text"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-secondary outline-none"
                                        placeholder="secret123"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Previsualización */}
                <div className="flex flex-col items-center justify-center">
                    <div
                        ref={qrRef}
                        className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-gray-900 aspect-square flex items-center justify-center relative group transition-transform hover:scale-105 duration-300"
                    >
                        <div className="absolute top-4 left-0 right-0 text-center text-xs font-black text-gray-300 uppercase tracking-widest pointer-events-none">
                            BS Comunicaciones
                        </div>
                        <QRCode
                            value={getQRValue()}
                            size={200}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                            className="text-secondary"
                        />
                        <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-bold text-gray-300 pointer-events-none">
                            {type === 'mesa' ? `Mesa ${value}` : type.toUpperCase()}
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 w-full max-w-xs">
                        <button
                            onClick={handleDownload}
                            className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={18} /> Descargar
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex-1 bg-white text-secondary border border-gray-200 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Printer size={18} /> Imprimir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsIcon = ({ type }) => {
    switch (type) {
        case 'mesa': return <Utensils className="text-primary" />;
        case 'menu': return <BookOpenText className="text-orange-500" />;
        case 'wifi': return <Zap className="text-blue-500" />;
        case 'custom': return <PartyPopper className="text-purple-500" />;
        default: return <QrCode className="text-gray-500" />;
    }
};

// Necesito este icono extra
const BookOpenText = (props) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        <path d="M6 8h2" />
        <path d="M6 12h2" />
        <path d="M16 8h2" />
        <path d="M16 12h2" />
    </svg>
)

export default TableQRGenerator;
