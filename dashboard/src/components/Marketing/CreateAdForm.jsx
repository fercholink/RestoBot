import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import AdPreview from './AdPreview';
import { supabase } from '../../lib/supabase';

const CreateAdForm = () => {
    const [formData, setFormData] = useState({
        productName: '',
        platform: 'instagram',
        targetAudience: '',
        promoText: ''
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null);

    const products = [
        { id: '1', name: 'Hamburguesa Perro' },
        { id: '2', name: 'Salchipapa Especial' },
        { id: '3', name: 'Hot Dog Clásico' },
        { id: '4', name: 'Refresco Cola' }
    ];

    const handleGenerate = (e) => {
        e.preventDefault();
        setIsGenerating(true);
        setResult(null);

        // Simulación de llamada a API (n8n/Supabase)
        setTimeout(() => {
            setIsGenerating(false);
            setResult({
                imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
                generatedText: `¡Descubre el sabor inigualable de nuestra ${formData.productName}! 🍔✨\n\nPerfecta para ${formData.targetAudience || 'todos los amantes de la comida'}. ¡Pídela ya! #RestoBot #${formData.platform} #Foodie`,
                platform: formData.platform
            });
        }, 2500);
    };

    return (
        <div className="flex h-full gap-6">
            {/* Scroll area for form */}
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20} />
                        Configuración de Campaña
                    </h2>

                    <form onSubmit={handleGenerate} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Producto Estrella</label>
                            <select
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 border"
                                value={formData.productName}
                                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                                required
                            >
                                <option value="">Selecciona un producto...</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma Destino</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['instagram', 'facebook', 'whatsapp'].map(platform => (
                                    <button
                                        key={platform}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, platform })}
                                        className={`py-2 px-4 rounded-xl border text-sm font-medium capitalize transition-all ${formData.platform === platform
                                            ? 'bg-purple-50 border-purple-500 text-purple-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {platform}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Público Objetivo</label>
                            <textarea
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 border"
                                rows="2"
                                placeholder="Ej: Amantes de la comida rápida, jovenes universitarios..."
                                value={formData.targetAudience}
                                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones Adicionales (Prompt)</label>
                            <textarea
                                className="w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2.5 px-3 border"
                                rows="3"
                                placeholder="Describe el estilo: minimalista, vibrante, oscuro, elegante..."
                                value={formData.promoText}
                                onChange={(e) => setFormData({ ...formData, promoText: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isGenerating}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Generando Magia...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    Generar Anuncio con IA
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[500px]">
                {result ? (
                    <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                            <CheckCircle className="text-green-500" size={20} />
                            Resultado Generado
                        </h3>
                        <div className="flex-1 overflow-y-auto flex justify-center">
                            <AdPreview data={result} />
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors">
                                Descargar Imagen
                            </button>
                            <button className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                                Copiar Texto
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-400">
                        <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ImageIcon size={40} className="opacity-50" />
                        </div>
                        <p className="font-medium">Tu anuncio aparecerá aquí</p>
                        <p className="text-sm">Configura los detalles y presiona Generar</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateAdForm;
