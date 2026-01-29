import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart, Check, Trash2, PlusCircle, MinusCircle, AlertCircle, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const NewOrderModal = ({ isOpen, onClose, onAddOrder, orders = [] }) => {
    const { user } = useAuth();
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [orderType, setOrderType] = useState('mesa');
    const [tableId, setTableId] = useState('');
    const [deliveryDetails, setDeliveryDetails] = useState({
        housingType: 'casa',
        city: 'Montería',
        address: '',
        neighborhood: '',
        complex: '',
        unit: '',
        notes: ''
    });
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Estado para la personalización
    const [customizingProduct, setCustomizingProduct] = useState(null);
    const [tempCustomization, setTempCustomization] = useState({
        excluded_ingredients: [],
        added_extras: []
    });

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Cargar productos y categorías desde Supabase
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: prods } = await supabase.from('products').select('*').eq('available', true).order('name');
            const { data: cats } = await supabase.from('categories').select('*').order('id');
            if (prods) setProducts(prods);
            if (cats) setCategories(cats);
        } catch (error) {
            console.error("Error loading menu:", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCustomerName('');
        setCustomerPhone('');
        setOrderType('mesa');
        setTableId('');
        setCart([]);
        setDeliveryDetails({
            housingType: 'casa',
            city: 'Montería',
            address: '',
            neighborhood: '',
            complex: '',
            unit: '',
            notes: ''
        });
    };

    const getProductStock = (productId) => {
        const product = products.find(p => p.id === productId);
        return product ? (product.stock || 0) : 0;
    };

    if (!isOpen) return null;

    const startCustomization = (product) => {
        const currentStock = getProductStock(product.id);
        const inCart = cart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);

        if (currentStock <= inCart) {
            alert('⚠️ No hay más unidades disponibles de este producto.');
            return;
        }

        if ((!product.base_ingredients || product.base_ingredients.length === 0) && (!product.extras || product.extras.length === 0)) {
            addToCart({ ...product, customizations: { excluded_ingredients: [], added_extras: [] } });
            return;
        }
        setCustomizingProduct(product);
        setTempCustomization({ excluded_ingredients: [], added_extras: [] });
    };

    const confirmCustomization = () => {
        if (!customizingProduct) return;

        const extrasCost = tempCustomization.added_extras.reduce((sum, extra) => sum + (extra.price || 0), 0);
        const finalPrice = (customizingProduct.price || 0) + extrasCost;

        const customizedItem = {
            ...customizingProduct,
            price: finalPrice,
            customizations: tempCustomization,
            cartId: Date.now()
        };

        addToCart(customizedItem);
        setCustomizingProduct(null);
        setTempCustomization({ excluded_ingredients: [], added_extras: [] });
    };

    const addToCart = (product) => {
        const currentStock = getProductStock(product.id);
        const inCart = cart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);

        if (currentStock <= inCart) {
            alert('⚠️ No hay más unidades disponibles de este producto.');
            return;
        }

        // Si no tiene personalizaciones, agrupar
        const isSimple = !product.customizations || (product.customizations.excluded_ingredients.length === 0 && product.customizations.added_extras.length === 0);

        if (isSimple) {
            const existing = cart.find(item =>
                item.id === product.id &&
                (!item.customizations || (item.customizations.excluded_ingredients.length === 0 && item.customizations.added_extras.length === 0))
            );
            if (existing) {
                setCart(cart.map(item => item.cartId === existing.cartId ? { ...item, quantity: item.quantity + 1 } : item));
                return;
            }
        }

        setCart([...cart, { ...product, quantity: 1, cartId: product.cartId || Date.now() }]);
    };

    const removeFromCart = (cartId) => {
        const existing = cart.find(item => item.cartId === cartId);
        if (existing.quantity > 1) {
            setCart(cart.map(item => item.cartId === cartId ? { ...item, quantity: item.quantity - 1 } : item));
        } else {
            setCart(cart.filter(item => item.cartId !== cartId));
        }
    };

    const removeExtraFromCartItem = (cartId, extraIndex) => {
        setCart(cart.map(item => {
            if (item.cartId !== cartId) return item;

            // Found the item
            const newExtras = [...item.customizations.added_extras];
            const removedExtra = newExtras.splice(extraIndex, 1)[0];

            // Recalculate price
            const newPrice = item.price - (removedExtra.price || 0);

            return {
                ...item,
                price: newPrice,
                customizations: {
                    ...item.customizations,
                    added_extras: newExtras
                }
            };
        }));
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (cart.length === 0) return alert('El carrito está vacío');

        if (orderType === 'domicilio') {
            if (!deliveryDetails.address || !deliveryDetails.neighborhood) {
                return alert('Por favor completa la Dirección y el Barrio.');
            }
        }

        if (orderType === 'mesa') {
            if (!tableId) return alert('Por favor ingresa el número de mesa');

            // Validar si la mesa ya tiene un pedido activo
            const existingOrder = orders.find(o =>
                (o.table_number === tableId) &&
                o.status !== 'pagado' &&
                o.status !== 'cancelado'
            );

            if (existingOrder) {
                return alert(`⚠️ La Mesa ${tableId} ya tiene un pedido activo (Pedido #${existingOrder.id}). Debe cerrarlo o pagarlo antes de abrir uno nuevo.`);
            }
        }

        setSubmitting(true);

        try {
            // 1. Crear el Pedido
            const deliveryAddressStr = orderType === 'domicilio'
                ? `${deliveryDetails.address}, ${deliveryDetails.neighborhood} (${deliveryDetails.city}) - ${deliveryDetails.housingType} ${deliveryDetails.complex || ''} ${deliveryDetails.unit || ''}. Notas: ${deliveryDetails.notes}`
                : null;

            // Formatear teléfono: Asegurar prefijo +57 si el usuario escribió un número
            let formattedPhone = '';
            if (customerPhone && customerPhone.trim().length > 0) {
                const cleanPhone = customerPhone.replace(/\D/g, ''); // Quitar no-dígitos
                // Si empieza con 57 y es largo, asumimos que ya lo tiene. Si no, lo pegamos.
                // Lógica simple: si tiene 10 dígitos (celular Co), pegar +57.
                formattedPhone = cleanPhone.startsWith('57') && cleanPhone.length > 10
                    ? `+${cleanPhone}`
                    : `+57${cleanPhone}`;
            }

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    customer_name: customerName,
                    table_number: orderType === 'mesa' ? tableId : 'DOMICILIO',
                    status: 'nuevo',
                    total: total,
                    payment_method: 'pendiente',
                    delivery_address: deliveryAddressStr,
                    notes: orderType === 'domicilio' ? `Dir: ${deliveryAddressStr}` : '', // Dejamos las notas limpias de tel
                    customer_phone: formattedPhone, // Nueva columna
                    customer_phone: formattedPhone, // Nueva columna
                    // Usamos delivery_info como metadata flexible ya que user_id no existe
                    delivery_info: {
                        ...(orderType === 'domicilio' ? deliveryDetails : {}),
                        created_by_id: user?.id,
                        created_by_name: user?.name,
                        created_by_role: user?.role
                    },
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Crear Items del Pedido
            const orderItems = cart.map(item => ({
                order_id: orderData.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                customization: item.customizations
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 3. Actualizar Inventario (Simple decremento)
            for (const item of cart) {
                const current = products.find(p => p.id === item.id);
                if (current) {
                    await supabase
                        .from('products')
                        .update({ stock: Math.max(0, current.stock - item.quantity) })
                        .eq('id', item.id);
                }
            }

            // Éxito
            onAddOrder(); // Notificar a App.jsx (opcional si usamos realtime)
            resetForm();
            onClose();

        } catch (error) {
            console.error("Error creating order:", error);
            alert("Error al crear el pedido: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in fade-in duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-secondary to-gray-900 text-white shadow-md z-10">
                    <h2 className="text-lg font-black flex items-center gap-3 tracking-wide">
                        <ShoppingCart className="text-primary" />
                        Punto de Venta
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#f8fafc]">

                    {/* SECCIÓN IZQUIERDA: MENÚ */}
                    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
                        {/* Categorías */}
                        <div className="p-4 bg-white border-b border-gray-100 overflow-x-auto whitespace-nowrap custom-scrollbar">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${selectedCategory === null ? 'bg-secondary text-white shadow-lg scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    Todos
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${selectedCategory === cat.id ? 'bg-secondary text-white shadow-lg scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <span>{cat.icon}</span>
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grid de Productos */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50">
                            {loading ? (
                                <div className="flex justify-center items-center h-full text-primary"><Loader2 className="animate-spin" size={32} /></div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {products
                                        .filter(p => selectedCategory === null || p.category_id === selectedCategory)
                                        .map(product => {
                                            const stock = product.stock || 0;
                                            const isOutOfStock = stock <= 0;
                                            return (
                                                <button
                                                    key={product.id}
                                                    onClick={() => !isOutOfStock && startCustomization(product)}
                                                    disabled={isOutOfStock}
                                                    className={`bg-white p-4 rounded-2xl border border-gray-100 transition-all text-left group hover:shadow-lg hover:border-primary/20 relative overflow-hidden flex flex-col h-full ${isOutOfStock ? 'opacity-60 grayscale' : 'active:scale-95'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-bold text-secondary text-sm leading-tight line-clamp-2">{product.name}</h4>
                                                        <span className="text-[10px] font-black bg-green-50 text-green-600 px-2 py-1 rounded-lg ml-2 whitespace-nowrap">${product.price.toLocaleString()}</span>
                                                    </div>

                                                    <div className="mt-auto flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                                                        <span>{isOutOfStock ? 'Agotado' : `Stock: ${stock}`}</span>
                                                        {!isOutOfStock && <ChevronRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECCIÓN DERECHA: CARRITO Y FORMULARIO */}
                    <div className="w-full md:w-[420px] bg-white flex flex-col shadow-xl z-20">
                        <form onSubmit={handleSubmit} className="flex flex-col h-full">

                            {/* Datos del Cliente */}
                            <div className="p-5 border-b border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex gap-2">
                                    <select
                                        value={orderType}
                                        onChange={(e) => setOrderType(e.target.value)}
                                        className="bg-white border-0 ring-1 ring-gray-200 rounded-xl px-3 py-2 text-xs font-black shadow-sm focus:ring-primary w-1/3"
                                    >
                                        <option value="mesa">🍽️ Mesa</option>
                                        <option value="domicilio">🛵 Domicilio</option>
                                    </select>

                                    {orderType === 'mesa' && (
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                placeholder="# Mesa"
                                                value={tableId}
                                                onChange={(e) => setTableId(e.target.value)}
                                                className={`w-full bg-white ring-1 rounded-xl px-3 py-2 text-xs font-bold outline-none shadow-sm ${orders.some(o => o.table_number === tableId && o.status !== 'pagado' && o.status !== 'cancelado')
                                                    ? 'ring-red-500 text-red-500 bg-red-50'
                                                    : 'ring-gray-200 focus:ring-primary'
                                                    }`}
                                                required
                                            />
                                            {tableId && orders.some(o => o.table_number === tableId && o.status !== 'pagado' && o.status !== 'cancelado') && (
                                                <p className="text-[9px] font-black text-red-500 mt-1 animate-pulse">
                                                    ⚠️ Mesa Ocupada
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nombre Cliente"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="bg-white ring-1 ring-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-primary shadow-sm"
                                        required={orderType === 'domicilio'}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Teléfono"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        className="bg-white ring-1 ring-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-primary shadow-sm"
                                        required={orderType === 'domicilio'}
                                    />
                                </div>

                                {/* Campos Extra para Domicilio */}
                                {orderType === 'domicilio' && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 pt-2 border-t border-gray-100 mt-2">
                                        <div className="flex gap-2">
                                            <input
                                                className="w-1/3 bg-white ring-1 ring-gray-200 rounded-xl px-3 py-2 text-xs outline-none"
                                                placeholder="Ciudad"
                                                value={deliveryDetails.city}
                                                onChange={e => setDeliveryDetails({ ...deliveryDetails, city: e.target.value })}
                                            />
                                            <input
                                                className="flex-1 bg-white ring-1 ring-gray-200 rounded-xl px-3 py-2 text-xs outline-none font-bold"
                                                placeholder="Barrio"
                                                value={deliveryDetails.neighborhood}
                                                onChange={e => setDeliveryDetails({ ...deliveryDetails, neighborhood: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <input
                                            className="w-full bg-white ring-1 ring-gray-200 rounded-xl px-3 py-2 text-xs outline-none font-bold"
                                            placeholder="Dirección completa"
                                            value={deliveryDetails.address}
                                            onChange={e => setDeliveryDetails({ ...deliveryDetails, address: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Lista del Carrito */}
                            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-3">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                                        <ShoppingCart size={32} />
                                        <p className="text-xs font-bold uppercase">Tu pedido está vacío</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.cartId} className="flex justify-between items-start p-3 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-md transition-all">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-primary text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-md">{item.quantity}</span>
                                                    <span className="text-xs font-bold text-secondary">{item.name}</span>
                                                </div>
                                                {/* Customizations */}
                                                {(item.customizations?.excluded_ingredients?.length > 0 || item.customizations?.added_extras?.length > 0) && (
                                                    <div className="mt-1 pl-7 space-y-0.5">
                                                        {item.customizations.excluded_ingredients.map(ing => (
                                                            <div key={ing} className="text-[9px] text-red-400 flex items-center gap-1"><MinusCircle size={8} /> Sin {ing}</div>
                                                        ))}
                                                        {item.customizations.added_extras.map((extra, idx) => (
                                                            <div key={`${extra.name}-${idx}`} className="text-[9px] text-green-500 flex items-center gap-1 font-bold group/extra w-full">
                                                                <PlusCircle size={8} /> {extra.name}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeExtraFromCartItem(item.cartId, idx)}
                                                                    className="ml-auto text-gray-400 hover:text-red-500 opacity-0 group-hover/extra:opacity-100 transition-opacity p-0.5"
                                                                    title="Eliminar adicional"
                                                                >
                                                                    <Trash2 size={10} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="mt-2 pl-7 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button type="button" onClick={() => removeFromCart(item.cartId)} className="text-gray-400 hover:text-red-500"><MinusCircle size={14} /></button>
                                                    <button type="button" onClick={() => addToCart(item)} className="text-gray-400 hover:text-green-500"><PlusCircle size={14} /></button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="text-xs font-black text-secondary">${(item.price * item.quantity).toLocaleString()}</span>
                                                <button type="button" onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Total y Acción */}
                            <div className="p-5 border-t border-gray-100 bg-white shadow-[0_-4px_30px_rgba(0,0,0,0.03)] z-10">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total a Pagar</span>
                                    <span className="text-2xl font-black text-secondary tracking-tight">${total.toLocaleString()}</span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={cart.length === 0 || submitting}
                                    className="w-full bg-secondary text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-premium hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="animate-spin" /> : <Check size={18} />}
                                    {submitting ? 'Enviando...' : 'Confirmar Pedido'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Modal Personalización (Inner) */}
            {customizingProduct && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-secondary/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in slide-in-from-bottom-8">
                        <h3 className="text-xl font-black text-secondary mb-1">{customizingProduct.name}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Personaliza tu producto</p>

                        <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto">
                            {/* Ingredientes */}
                            {customizingProduct.base_ingredients?.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-red-400 mb-2 block">¿Quitar Ingredientes?</label>
                                    <div className="flex flex-wrap gap-2">
                                        {customizingProduct.base_ingredients.map(ing => {
                                            const isExcluded = tempCustomization.excluded_ingredients.includes(ing);
                                            return (
                                                <button
                                                    key={ing}
                                                    onClick={() => setTempCustomization(prev => ({ ...prev, excluded_ingredients: isExcluded ? prev.excluded_ingredients.filter(i => i !== ing) : [...prev.excluded_ingredients, ing] }))}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isExcluded ? 'bg-red-50 border-red-500 text-red-500' : 'border-gray-100 text-gray-500'}`}
                                                >
                                                    {isExcluded ? 'Sin ' : 'Con '}{ing}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Extras */}
                            {customizingProduct.extras?.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-green-500 mb-2 block">¿Añadir Extras?</label>
                                    <div className="space-y-2">
                                        {customizingProduct.extras.map(extra => {
                                            const isAdded = tempCustomization.added_extras.some(e => e.name === extra.name);
                                            return (
                                                <button
                                                    key={extra.name}
                                                    onClick={() => setTempCustomization(prev => ({ ...prev, added_extras: isAdded ? prev.added_extras.filter(e => e.name !== extra.name) : [...prev.added_extras, extra] }))}
                                                    className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition-all ${isAdded ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}
                                                >
                                                    <span className="text-xs font-bold">{extra.name}</span>
                                                    <span className="text-xs font-black">+${extra.price}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={confirmCustomization} className="flex-1 bg-primary text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest">Guardar</button>
                            <button onClick={() => setCustomizingProduct(null)} className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewOrderModal;
