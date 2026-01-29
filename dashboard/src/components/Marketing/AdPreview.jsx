import React from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';

const AdPreview = ({ data }) => {
    const { imageUrl, generatedText, platform } = data;

    if (platform === 'instagram') {
        return (
            <div className="bg-white border border-gray-200 rounded-xl w-[320px] shadow-sm font-sans text-sm mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[2px]">
                            <div className="w-full h-full rounded-full bg-white p-[2px]">
                                <img
                                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=RestoBot"
                                    alt="Profile"
                                    className="w-full h-full rounded-full bg-gray-100"
                                />
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-xs text-gray-900">restobot_official</p>
                            <p className="text-[10px] text-gray-500 leading-none">Publicidad</p>
                        </div>
                    </div>
                    <MoreHorizontal size={18} className="text-gray-600" />
                </div>

                {/* Image */}
                <div className="aspect-square bg-gray-100 w-full overflow-hidden">
                    <img src={imageUrl} alt="Ad Content" className="w-full h-full object-cover" />
                </div>

                {/* Actions */}
                <div className="p-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-4">
                            <Heart size={22} className="text-gray-900 hover:text-red-500 cursor-pointer" />
                            <MessageCircle size={22} className="text-gray-900 -rotate-90" />
                            <Send size={22} className="text-gray-900" />
                        </div>
                        <Bookmark size={22} className="text-gray-900" />
                    </div>
                    <p className="font-semibold text-xs mb-1">2,453 Me gusta</p>
                    <div className="text-xs text-gray-800">
                        <span className="font-semibold mr-1">restobot_official</span>
                        <span className="whitespace-pre-wrap">{generatedText}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (platform === 'facebook') {
        return (
            <div className="bg-white border border-gray-200 rounded-lg w-[320px] shadow-sm font-sans text-sm mx-auto">
                {/* Header */}
                <div className="p-3 flex items-center gap-2 mb-1">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                        <img
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=RestoBot"
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-sm">RestoBot</h3>
                        <p className="text-xs text-gray-500">Publicidad · <span className="text-gray-400">🌍</span></p>
                    </div>
                </div>

                {/* Text */}
                <div className="px-3 pb-2 text-sm text-gray-900 whitespace-pre-wrap">
                    {generatedText}
                </div>

                {/* Image */}
                <div className="w-full aspect-video bg-gray-100 overflow-hidden">
                    <img src={imageUrl} alt="Ad Content" className="w-full h-full object-cover" />
                </div>

                {/* Footer Mock */}
                <div className="bg-gray-50 p-2 text-xs text-gray-500 border-t">
                    CORREO / SITIO WEB
                    <p className="font-semibold text-gray-900 text-sm">Más información</p>
                </div>
            </div>
        );
    }

    // Default / WhatsApp
    return (
        <div className="bg-[#e5ddd5] p-4 rounded-xl w-[300px] mx-auto shadow-sm relative border border-[#d1d7db]">
            <div className="bg-white rounded-lg p-1 shadow-sm max-w-[85%] ml-auto relative">
                <div className="rounded-lg overflow-hidden mb-1">
                    <img src={imageUrl} alt="Ad Content" className="w-full h-auto object-cover" />
                </div>
                <p className="text-sm text-gray-800 p-1 whitespace-pre-wrap">{generatedText}</p>
                <div className="flex justify-end items-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-500">12:30 PM</span>
                </div>
            </div>
        </div>
    );
};

export default AdPreview;
