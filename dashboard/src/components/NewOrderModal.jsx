import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, Check, Trash2, PlusCircle, MinusCircle, AlertCircle, ChevronRight, MapPin } from 'lucide-react';



const NewOrderModal = ({ isOpen, onClose, onAddOrder, onUpdateOrder, editingOrder = null, orders = [] }) => {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [orderType, setOrderType] = useState('mesa');
    const [tableId, setTableId] = useState('');
    const [deliveryDetails, setDeliveryDetails] = useState({
        housingType: 'casa', // 'casa' | 'apto'
        city: 'Montería',
        address: '',
        neighborhood: '',
        complex: '',
        unit: '',
        notes: ''
    });
    const [cart, setCart] = useState([]);

    // Cargar datos si estamos editando
    React.useEffect(() => {
        if (editingOrder && isOpen) {
            setCustomerName(editingOrder.customer_name || '');
            setCustomerPhone(editingOrder.customer_phone || '');
            setOrderType(editingOrder.type || 'mesa');
            setTableId(editingOrder.table_id || '');
            // Convertir items del pedido al formato del carrito
            const itemsForCart = editingOrder.items.map(item => ({
                id: item.id,
                name: item.product_name,
                price: item.unit_price,
                quantity: item.quantity,
                customizations: item.customizations || { excluded_ingredients: [], added_extras: [] },
                cartId: Math.random() // Generar nuevos ids para el carrito de edición
            }));
            setCart(itemsForCart);
        } else if (!editingOrder && isOpen) {
            // Limpiar si es nuevo
            setCustomerName('');
            setCustomerPhone('');
            setOrderType('mesa');
            setTableId('');
            setCart([]);
        }
    }, [editingOrder, isOpen]);

    // Estado para la personalización de un producto
    const [customizingProduct, setCustomizingProduct] = useState(null);
    const [tempCustomization, setTempCustomization] = useState({
        excluded_ingredients: [],
        added_extras: []
    });

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Cargar productos y categorias desde localStorage
    React.useEffect(() => {
        const loadData = () => {
            const savedProducts = localStorage.getItem('restobot_products');
            if (savedProducts) {
                setProducts(JSON.parse(savedProducts));
            }
            const savedCategories = localStorage.getItem('restobot_categories');
            if (savedCategories) {
                setCategories(JSON.parse(savedCategories));
            }
        };

        loadData();
        // Escuchar cambios en localStorage para actualizar stock/categorias en tiempo real
        window.addEventListener('storage', loadData);
        return () => window.removeEventListener('storage', loadData);
    }, [isOpen]);

    const getProductStock = (productId) => {
        const product = products.find(p => p.id === productId);
        return product ? (product.stock || 0) : 0;
    };

    if (!isOpen) return null;

    const startCustomization = (product) => {
        // Validar stock disponible
        const currentStock = getProductStock(product.id);
        const inCart = cart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);

        if (currentStock <= inCart) {
            alert('⚠️ No hay más unidades disponibles de este producto.');
            return;
        }

        if (!product.base_ingredients?.length && !product.extras?.length) {
            addToCart({ ...product, customizations: { excluded_ingredients: [], added_extras: [] } });
            return;
        }
        setCustomizingProduct(product);
        setTempCustomization({ excluded_ingredients: [], added_extras: [] });
    };

    const confirmCustomization = () => {
        if (!customizingProduct) return;

        // Calcular precio total incluyendo extras
        const extrasCost = tempCustomization.added_extras.reduce((sum, extra) => sum + (extra.price || 0), 0);
        const finalPrice = (customizingProduct.price || 0) + extrasCost;

        const customizedItem = {
            ...customizingProduct,
            price: finalPrice, // Actualizamos el precio unitario con los extras
            customizations: tempCustomization,
            cartId: Date.now()
        };

        addToCart(customizedItem);
        setCustomizingProduct(null);
        setTempCustomization({ excluded_ingredients: [], added_extras: [] });
    };

    const addToCart = (product) => {
        // Validar stock
        const currentStock = getProductStock(product.id);
        const inCart = cart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);

        if (currentStock <= inCart) {
            alert('⚠️ No hay más unidades disponibles de este producto.');
            return;
        }

        // Si no tiene personalizaciones, agrupamos por ID
        // ... (rest of function)
        if (!product.customizations || (product.customizations.excluded_ingredients.length === 0 && product.customizations.added_extras.length === 0)) {
            const existing = cart.find(item => item.id === product.id && (!item.customizations || (item.customizations.excluded_ingredients.length === 0 && item.customizations.added_extras.length === 0)));
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

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (cart.length === 0) return alert('El carrito está vacío');

        if (orderType === 'domicilio') {
            if (!deliveryDetails.address || !deliveryDetails.neighborhood) {
                return alert('Por favor completa la Dirección y el Barrio para el domicilio.');
            }
        }

        // Validar si la mesa ya está ocupada
        if (orderType === 'mesa') {
            if (!tableId) return alert('Por favor ingresa el número de mesa');
            const isTableOccupied = orders.some(o =>
                o.type === 'mesa' &&
                o.table_id === tableId &&
                o.status !== 'pagado' &&
                o.status !== 'cancelado' &&
                (!editingOrder || o.id !== editingOrder.id)
            );

            if (isTableOccupied) {
                return alert(`⚠️ La Mesa ${tableId} ya está ocupada por un pedido activo.`);
            }
        }

        const orderData = {
            id: editingOrder ? editingOrder.id : Math.floor(Math.random() * 1000) + 200,
            status: editingOrder ? editingOrder.status : 'nuevo',
            type: orderType,
            table_id: orderType === 'mesa' ? tableId : null,
            total_price: total,
            created_at: editingOrder ? editingOrder.created_at : new Date().toISOString(),
            customer_name: customerName,
            customer_phone: customerPhone,
            items: cart.map(item => ({
                id: item.id,
                quantity: item.quantity,
                product_name: item.name,
                unit_price: item.price,
                customizations: item.customizations
            })),
            delivery: orderType === 'domicilio' ? deliveryDetails : null,
        };

        if (editingOrder) {
            onUpdateOrder(orderData);
        } else {
            onAddOrder(orderData);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in fade-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-secondary text-white">
                    <h2 className="text-xl font-black flex items-center gap-3">
                        <ShoppingCart className="text-primary" />
                        Punto de Venta Directo
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Menu Selection */}
                    {/* Menu Selection */}
                    <div className="flex-1 p-8 overflow-y-auto border-r bg-gray-50/50">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Menú Disponible</h3>
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                <span
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-3 py-1 border rounded-full text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${selectedCategory === null
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white border-gray-100 text-gray-400 hover:border-primary hover:text-primary'
                                        }`}
                                >
                                    Todos
                                </span>
                                {categories.map(cat => (
                                    <span
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`px-3 py-1 border rounded-full text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${selectedCategory === cat.id
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white border-gray-100 text-gray-400 hover:border-primary hover:text-primary'
                                            }`}
                                    >
                                        {cat.emoji || ''} {cat.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {products
                                .filter(p => selectedCategory === null || p.categoryId === selectedCategory)
                                .map(product => {
                                    const stock = product.stock || 0;
                                    const isOutOfStock = stock <= 0;
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => !isOutOfStock && startCustomization(product)}
                                            disabled={isOutOfStock}
                                            className={`bg-white p-5 rounded-2xl border border-transparent transition-all text-left shadow-premium group flex flex-col gap-2 relative overflow-hidden ${isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-primary/30 active:scale-[0.98]'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start relative z-10 w-full">
                                                <h4 className="font-black text-secondary group-hover:text-primary transition-colors flex-1">{product.name}</h4>
                                                <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-xs font-black shrink-0 ml-2">${product.price.toLocaleString()}</div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-medium line-clamp-1 w-full flex justify-between items-center">
                                                <span className="truncate flex-1">{product.base_ingredients?.join(', ') || 'Sin descripción'}</span>
                                                {isOutOfStock ? (
                                                    <span className="text-[9px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full ml-1 shrink-0 uppercase tracking-wider">Agotado</span>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full ml-1 shrink-0">{stock} disp.</span>
                                                )}
                                            </p>
                                            {!isOutOfStock && <ChevronRight className="absolute -right-4 top-1/2 -translate-y-1/2 text-primary/20 group-hover:right-3 transition-all" size={24} />}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Form & Cart */}
                    <div className="w-full md:w-[400px] p-8 overflow-y-auto flex flex-col bg-white">
                        <form onSubmit={handleSubmit} className="space-y-6 flex-1 flex flex-col">
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 pb-2">Datos de Entrega</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-accent tracking-tighter ml-1">Cliente</label>
                                        <input
                                            type="text"
                                            required
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                            placeholder="Nombre"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-accent tracking-tighter ml-1">Celular</label>
                                        <input
                                            type="text"
                                            required
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                            placeholder="300..."
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[9px] font-black uppercase text-accent tracking-tighter ml-1">Servicio</label>
                                        <select
                                            value={orderType}
                                            onChange={(e) => setOrderType(e.target.value)}
                                            className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 text-sm font-black appearance-none outline-none focus:ring-2 focus:ring-primary/20"
                                        >
                                            <option value="mesa">🏠 Mesa</option>
                                            <option value="domicilio">🛵 Domicilio</option>
                                        </select>
                                    </div>
                                    {orderType === 'mesa' && (
                                        <div className="w-24 space-y-1">
                                            <label className="text-[9px] font-black uppercase text-accent tracking-tighter ml-1">Mesa</label>
                                            <input
                                                type="text"
                                                required
                                                value={tableId}
                                                onChange={(e) => setTableId(e.target.value)}
                                                className="w-full bg-gray-50 border-gray-100 rounded-xl p-3 text-sm font-black text-center focus:ring-2 focus:ring-primary/20 outline-none"
                                                placeholder="00"
                                            />
                                        </div>
                                    )}
                                </div>
                                {orderType === 'domicilio' && (
                                    <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2">

                                        {/* Tipo de Vivienda */}
                                        <div className="flex gap-2">
                                            {[
                                                { id: 'casa', label: '🏡 Casa' },
                                                { id: 'apto', label: '🏢 Apto / Conjunto' }
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => setDeliveryDetails({ ...deliveryDetails, housingType: type.id })}
                                                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${deliveryDetails.housingType === type.id
                                                            ? 'bg-secondary text-white border-secondary'
                                                            : 'bg-white text-gray-400 border-gray-200 hover:border-secondary'
                                                        }`}
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                placeholder="Ciudad"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                                value={deliveryDetails.city}
                                                onChange={e => setDeliveryDetails({ ...deliveryDetails, city: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Barrio *"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                                value={deliveryDetails.neighborhood}
                                                onChange={e => setDeliveryDetails({ ...deliveryDetails, neighborhood: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                placeholder="Dirección Exacta *"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                                value={deliveryDetails.address}
                                                onChange={e => setDeliveryDetails({ ...deliveryDetails, address: e.target.value })}
                                            />
                                        </div>

                                        {deliveryDetails.housingType === 'apto' && (
                                            <div className="grid grid-cols-2 gap-3 animate-in zoom-in duration-200">
                                                <input
                                                    type="text"
                                                    placeholder="Conjunto / Edificio"
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                                    value={deliveryDetails.complex}
                                                    onChange={e => setDeliveryDetails({ ...deliveryDetails, complex: e.target.value })}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Torre / Apto / Interior"
                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                                    value={deliveryDetails.unit}
                                                    onChange={e => setDeliveryDetails({ ...deliveryDetails, unit: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        <input
                                            type="text"
                                            placeholder="Notas de Entrega (Opcional)"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                                            value={deliveryDetails.notes}
                                            onChange={e => setDeliveryDetails({ ...deliveryDetails, notes: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>


                            <div className="flex-1 flex flex-col pt-4 border-t border-gray-50 min-h-[300px]">
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex justify-between items-center">
                                    Resumen Sugerido
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">${total.toLocaleString()}</span>
                                </h3>
                                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                                    {cart.map(item => (
                                        <div key={item.cartId} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 relative group transition-all hover:bg-white hover:shadow-premium">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded mr-1">x{item.quantity}</span>
                                                    <span className="font-bold text-secondary text-sm">{item.name}</span>
                                                </div>
                                                <span className="font-black text-secondary text-sm">${(item.price * item.quantity).toLocaleString()}</span>
                                            </div>

                                            {/* Detalles de personalización */}
                                            {item.customizations && (item.customizations.excluded_ingredients.length > 0 || item.customizations.added_extras.length > 0) && (
                                                <div className="pl-6 space-y-1 mt-2">
                                                    {item.customizations.excluded_ingredients.map(ing => (
                                                        <div key={ing} className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase">
                                                            <MinusCircle size={10} /> Sin {ing}
                                                        </div>
                                                    ))}
                                                    {item.customizations.added_extras.map(extra => (
                                                        <div key={extra.name} className="flex items-center gap-1 text-[9px] font-black text-success uppercase">
                                                            <PlusCircle size={10} /> + {extra.name} (${extra.price})
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button type="button" onClick={() => removeFromCart(item.cartId)} className="p-2 bg-white text-danger hover:bg-red-50 rounded-xl shadow-sm border border-red-50"><Minus size={14} /></button>
                                                <button type="button" onClick={() => addToCart(item)} className="p-2 bg-white text-success hover:bg-green-50 rounded-xl shadow-sm border border-green-50"><Plus size={14} /></button>
                                                <button type="button" onClick={() => setCart(cart.filter(i => i.cartId !== item.cartId))} className="ml-auto p-2 text-gray-300 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {cart.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full py-10 grayscale opacity-20">
                                            <ShoppingCart size={40} />
                                            <p className="text-[10px] font-black uppercase tracking-widest mt-2">Carrito Vacío</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={cart.length === 0}
                                className="w-full bg-secondary text-white font-black py-4 rounded-2xl shadow-premium hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:grayscale disabled:pointer-events-none mt-auto"
                            >
                                Confirmar y Enviar a Cocina
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Modal de Personalización (Overlay) */}
            {
                customizingProduct && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-secondary/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300">
                            <div className="p-8 pb-4">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-secondary tracking-tight">Personalizar</h3>
                                        <p className="text-primary font-black text-lg">${(customizingProduct.price || 0).toLocaleString()} base</p>
                                    </div>
                                    <button onClick={() => setCustomizingProduct(null)} className="p-2 text-gray-300 hover:text-secondary transition-colors"><X size={28} /></button>
                                </div>

                                <div className="space-y-8 py-4">
                                    {/* Ingredientes Base (Permitir quitar) */}
                                    {customizingProduct.base_ingredients?.length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                                ¿Quitar algo? (Opcional)
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {customizingProduct.base_ingredients?.map(ing => {
                                                    if (!ing) return null;
                                                    const isExcluded = tempCustomization.excluded_ingredients.includes(ing);
                                                    return (
                                                        <button
                                                            key={ing}
                                                            onClick={() => {
                                                                setTempCustomization(prev => ({
                                                                    ...prev,
                                                                    excluded_ingredients: isExcluded
                                                                        ? prev.excluded_ingredients.filter(i => i !== ing)
                                                                        : [...prev.excluded_ingredients, ing]
                                                                }));
                                                            }}
                                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black transition-all border ${isExcluded
                                                                ? 'bg-red-50 border-red-200 text-red-500 scale-95'
                                                                : 'bg-gray-50 border-gray-100 text-secondary hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            {isExcluded ? <X size={12} /> : <Check size={12} className="text-success" />}
                                                            {ing}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Extras (Permitir añadir) */}
                                    {customizingProduct.extras?.length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-success rounded-full" />
                                                ¿Añadir extras? (+ costo)
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {customizingProduct.extras?.map(extra => {
                                                    if (!extra || !extra.name) return null;
                                                    const isAdded = tempCustomization.added_extras.some(e => e.name === extra.name);
                                                    return (
                                                        <button
                                                            key={extra.name}
                                                            onClick={() => {
                                                                setTempCustomization(prev => ({
                                                                    ...prev,
                                                                    added_extras: isAdded
                                                                        ? prev.added_extras.filter(e => e.name !== extra.name)
                                                                        : [...prev.added_extras, extra]
                                                                }));
                                                            }}
                                                            className={`flex items-center justify-between px-5 py-4 rounded-3xl text-xs font-black transition-all border ${isAdded
                                                                ? 'bg-success/5 border-success text-success ring-1 ring-success animate-in pulse duration-500'
                                                                : 'bg-white border-gray-100 text-secondary hover:border-success/30'
                                                                }`}
                                                        >
                                                            <div className="flex flex-col items-start translate-y-[-1px]">
                                                                <span>{extra.name}</span>
                                                                <span className="text-[10px] font-bold opacity-60">+${(extra.price || 0).toLocaleString()}</span>
                                                            </div>
                                                            {isAdded ? <CheckCircle2 size={18} /> : <PlusCircle size={18} className="text-gray-200 group-hover:text-success transition-colors" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 flex gap-4">
                                <button
                                    onClick={confirmCustomization}
                                    className="flex-1 bg-primary text-white py-5 rounded-[1.5rem] font-black shadow-premium hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
                                >
                                    Añadir {customizingProduct.name} al Carrito
                                </button>
                                <button
                                    onClick={() => setCustomizingProduct(null)}
                                    className="px-8 py-5 bg-white border border-gray-200 text-secondary rounded-[1.5rem] font-black hover:bg-gray-100 transition-all text-xs uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

const CheckCircle2 = ({ size, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

export default NewOrderModal;
